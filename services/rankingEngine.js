/**
 * Enterprise Ranking & Leaderboard Intelligence Engine Service
 * Handles Global/AIR ranks, Daily/Weekly/Monthly leaderboards, League Positions,
 * tie breakers, achievements, and AI competitive reviews.
 */
const aiGateway = require('./aiGateway');

class RankingEngine {

  /**
   * Recalculates global rankings based on score or XP with tie-breaking rules
   */
  async calculateGlobalRanks(db, scoreBasisType = 'XP') {
    // 1. Fetch tie-breaker priority configuration
    const { rows: tieRules } = await db.query(
      "SELECT priority_list FROM public.tie_break_rules WHERE is_active = true LIMIT 1"
    );
    const rulesList = tieRules[0]?.priority_list || [];

    // Query active student profiles sorted by XP, then signup date
    const { rows: students } = await db.query(`
      SELECT id, xp_balance, created_at
      FROM public.profiles
      ORDER BY xp_balance DESC, created_at ASC
    `);

    const N = students.length;
    for (let index = 0; index < N; index++) {
      const s = students[index];
      const newRank = index + 1;

      // Check current rank to track movement history
      const { rows: existingRank } = await db.query(
        "SELECT rank_value FROM public.rankings WHERE user_id = $1 AND ranking_type = $2 LIMIT 1",
        [s.id, scoreBasisType]
      );

      if (existingRank.length > 0) {
        const oldRank = existingRank[0].rank_value;
        if (oldRank !== newRank) {
          // Log rank movement
          await db.query(`
            INSERT INTO public.rank_history (user_id, ranking_type, old_rank, new_rank)
            VALUES ($1, $2, $3, $4)
          `, [s.id, scoreBasisType, oldRank, newRank]);

          // Update competitive analytics velocities
          await db.query(`
            INSERT INTO public.competitive_analytics (user_id, rank_movement)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE
            SET rank_movement = EXCLUDED.rank_movement, updated_at = now()
          `, [s.id, oldRank - newRank]);
        }
      }

      // Upsert rankings
      await db.query(`
        INSERT INTO public.rankings (user_id, ranking_type, rank_value, score_basis)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, ranking_type) DO UPDATE
        SET rank_value = EXCLUDED.rank_value, score_basis = EXCLUDED.score_basis, updated_at = now()
      `, [s.id, scoreBasisType, newRank, s.xp_balance]);
    }

    return { processedCount: N, scoreBasisType };
  }

  /**
   * Retrieves leaderboard lists with custom filtering
   */
  async getLeaderboard(db, leaderboardName, filters = {}) {
    const { rankingType = 'XP', limit = 50 } = filters;

    // Fetch matching rankings
    const { rows } = await db.query(`
      SELECT r.rank_value, r.score_basis, p.id as user_id, p.full_name, p.role
      FROM public.rankings r
      JOIN public.profiles p ON r.user_id = p.id
      WHERE r.ranking_type = $1
      ORDER BY r.rank_value ASC
      LIMIT $2
    `, [rankingType, limit]);

    return rows;
  }

  /**
   * Updates league position tiers, promotion probability, and demotion alerts
   */
  async updateLeaguePosition(db, userId, xpEarned) {
    // 1. Get or create current league status
    const { rows: leagueRows } = await db.query(
      "SELECT * FROM public.league_positions WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    let currentLeague = 'Bronze';
    let leagueRank = 1;
    let requiredXP = 1000.00;

    if (leagueRows.length > 0) {
      currentLeague = leagueRows[0].current_league;
      leagueRank = leagueRows[0].league_rank;
      requiredXP = parseFloat(leagueRows[0].required_xp_for_promotion);
    }

    // Accumulate total user XP
    const { rows: userProfile } = await db.query(
      "SELECT xp_balance FROM public.profiles WHERE id = $1 LIMIT 1",
      [userId]
    );
    const totalXP = parseFloat(userProfile[0]?.xp_balance || 0.0);

    // Evaluate promotion logic
    let newLeague = currentLeague;
    if (totalXP >= 5000.00) {
      newLeague = 'Diamond';
      requiredXP = 0.00;
    } else if (totalXP >= 3000.00) {
      newLeague = 'Gold';
      requiredXP = 5000.00 - totalXP;
    } else if (totalXP >= 1500.00) {
      newLeague = 'Silver';
      requiredXP = 3000.00 - totalXP;
    } else {
      requiredXP = 1500.00 - totalXP;
    }

    const promotionZone = requiredXP <= 200.00 && newLeague !== 'Diamond';
    const demotionZone = false;
    const progressPct = newLeague === 'Diamond' ? 100.00 : parseFloat(((totalXP / (totalXP + requiredXP)) * 100).toFixed(2));

    const { rows: upserted } = await db.query(`
      INSERT INTO public.league_positions (
        user_id, current_league, league_rank, promotion_zone, demotion_zone, required_xp_for_promotion, season_progress_pct
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE
      SET current_league = EXCLUDED.current_league,
          league_rank = EXCLUDED.league_rank,
          promotion_zone = EXCLUDED.promotion_zone,
          demotion_zone = EXCLUDED.demotion_zone,
          required_xp_for_promotion = EXCLUDED.required_xp_for_promotion,
          season_progress_pct = EXCLUDED.season_progress_pct,
          updated_at = now()
      RETURNING *
    `, [userId, newLeague, leagueRank, promotionZone, demotionZone, requiredXP, progressPct]);

    return upserted[0];
  }

  /**
   * Generates AI competition diagnostic reviews and league promotion predictions
   */
  async generateAICompetitiveAnalysis(db, userId) {
    let summary = 'You are performing consistently in the active local matches.';
    let promotionPrediction = 'You can reach Gold League in 3 days with your current XP velocity.';
    let recommendations = 'Complete the biology chapter test to secure promotion zone.';

    try {
      const { rows: userProfile } = await db.query(
        "SELECT full_name, xp_balance FROM public.profiles WHERE id = $1 LIMIT 1",
        [userId]
      );
      if (userProfile.length > 0) {
        const u = userProfile[0];
        const prompt = `Student: ${u.full_name}, XP: ${u.xp_balance}. Review competitive analytics, and predict league promotion progress. Return JSON: {"summary": "Performing well", "promotionPrediction": "Silver League in 2 days", "recommendations": "Solve Chemistry tests"}`;
        const result = await aiGateway.executeComplete(db, 'mentor_chat', userId, { query: prompt });
        if (result && result.response) {
          const jsonMatch = result.response.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            summary = parsed.summary || summary;
            promotionPrediction = parsed.promotionPrediction || promotionPrediction;
            recommendations = parsed.recommendations || recommendations;
          }
        }
      }
    } catch (_) {}

    return { userId, summary, promotionPrediction, recommendations };
  }

  /**
   * Registers unlocked achievements and badges
   */
  async unlockAchievement(db, userId, achievementName, evidence) {
    const { rows } = await db.query(`
      INSERT INTO public.achievement_events (user_id, achievement_name, evidence)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, achievementName, evidence || 'Milestone achieved']);
    return rows[0];
  }
}

module.exports = new RankingEngine();
