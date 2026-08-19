const crypto = require('crypto');

/**
 * Ensures a gamification profile exists for the student.
 */
async function ensureGamificationProfile(db, studentId) {
  const { rows } = await db.query(
    "SELECT * FROM public.gamification_profiles WHERE student_id = $1",
    [studentId]
  );
  if (rows.length > 0) {
    return rows[0];
  }

  // Insert default profile
  const { rows: newProfile } = await db.query(`
    INSERT INTO public.gamification_profiles (student_id, coins, energy, lives, current_streak, longest_streak, current_league_id, last_active_date)
    VALUES ($1, 100, 100, 5, 1, 1, 'league_beginner', CURRENT_DATE)
    RETURNING *
  `, [studentId]);
  return newProfile[0];
}

/**
 * Awards XP points to a student based on configurable rules and multipliers,
 * with anti-cheat detection.
 */
async function awardXp(db, { studentId, ruleId, referenceId, customMultiplier = 1.0 }) {
  // 1. Fetch XP rule
  const { rows: ruleRows } = await db.query(
    "SELECT * FROM public.xp_rules WHERE id = $1 AND active = TRUE",
    [ruleId]
  );
  if (ruleRows.length === 0) {
    return { success: false, reason: `Active XP rule '${ruleId}' not found.` };
  }
  const rule = ruleRows[0];

  // Ensure profile exists
  await ensureGamificationProfile(db, studentId);

  // 2. Anti-Cheat Check: Rate limit verification
  // If user has received > 10 XP rewards in the last 10 seconds, flag as suspicious
  const tenSecondsAgo = new Date(Date.now() - 10000);
  const { rows: recentTxs } = await db.query(`
    SELECT COUNT(*)::int as count FROM public.xp_transactions 
    WHERE user_id = $1 AND created_at >= $2
  `, [studentId, tenSecondsAgo]);

  if (recentTxs[0].count > 10) {
    // Flag suspicious farming behavior
    await db.query(`
      UPDATE public.profiles 
      SET suspicion_score = COALESCE(suspicion_score, 0) + 20 
      WHERE id = $1
    `, [studentId]);

    await db.query(`
      INSERT INTO public.validation_audit_logs (user_id, action, details)
      VALUES ($1, 'XP_FARMING_DETECTION', $2)
    `, [studentId, `Anti-cheat flagged: student triggered ${recentTxs[0].count} XP awards within 10 seconds. Suspicion score incremented.`]);

    throw new Error("Anti-cheat validation failure: rate limit exceeded for XP awards. Suspicious activity flagged.");
  }

  // 3. Compute Multipliers
  let multiplier = parseFloat(rule.multiplier || 1.0) * parseFloat(customMultiplier);

  // Weekend Boost (1.5x)
  const day = new Date().getDay();
  const isWeekend = (day === 0 || day === 6); // Sunday = 0, Saturday = 6
  if (isWeekend) {
    multiplier *= 1.5;
  }

  // Pro Subscription Boost (2.0x)
  const { rows: subRows } = await db.query(
    "SELECT * FROM public.subscriptions WHERE student_id = $1 AND status = 'Active'",
    [studentId]
  );
  if (subRows.length > 0) {
    multiplier *= 2.0;
  }

  const finalXp = Math.round(rule.xp_amount * multiplier);

  // 4. Log XP Transaction
  const txId = crypto.randomUUID();
  await db.query(`
    INSERT INTO public.xp_transactions (id, user_id, amount, transaction_type, reference_id, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [txId, studentId, finalXp, ruleId, referenceId || 'system-triggered']);

  // 5. Update profiles.xp_balance
  await db.query(`
    UPDATE public.profiles 
    SET xp_balance = COALESCE(xp_balance, 0) + $1 
    WHERE id = $2
  `, [finalXp, studentId]);

  // Fetch updated total XP to check for Level Up
  const { rows: profileRows } = await db.query(
    "SELECT xp_balance, unlocked_level FROM public.profiles WHERE id = $1",
    [studentId]
  );
  const currentXp = parseFloat(profileRows[0].xp_balance || 0);
  const currentLevel = parseInt(profileRows[0].unlocked_level || 1);

  // Check if student qualifies for level upgrade
  const { rows: nextLevelRows } = await db.query(`
    SELECT * FROM public.levels 
    WHERE xp_requirement <= $1 AND level_number > $2
    ORDER BY level_number DESC LIMIT 1
  `, [currentXp, currentLevel]);

  let leveledUp = false;
  let newLevel = currentLevel;
  if (nextLevelRows.length > 0) {
    newLevel = nextLevelRows[0].level_number;
    leveledUp = true;

    // Persist level update and award Level up coins
    await db.query(`
      UPDATE public.profiles 
      SET unlocked_level = $1 
      WHERE id = $2
    `, [newLevel, studentId]);

    await db.query(`
      UPDATE public.gamification_profiles 
      SET coins = COALESCE(coins, 0) + $1 
      WHERE student_id = $2
    `, [nextLevelRows[0].coin_reward || 50, studentId]);

    // Audit Log Level Up
    await db.query(`
      INSERT INTO public.validation_audit_logs (user_id, action, details)
      VALUES ($1, 'LEVEL_UP', $2)
    `, [studentId, `Leveled up to Lvl ${newLevel}. Awarded ${nextLevelRows[0].coin_reward} level coins.`]);
  }

  // 6. Evaluate Achievements (hook)
  await evaluateAchievements(db, { studentId });

  return {
    success: true,
    xpAwarded: finalXp,
    totalXp: currentXp,
    leveledUp,
    newLevel
  };
}

/**
 * Tracks mission completions and increments current counts.
 */
async function evaluateMissions(db, { studentId, actionKey, count = 1 }) {
  // Find active missions matching action key
  const { rows: missions } = await db.query(
    "SELECT * FROM public.missions WHERE action_key = $1 AND active = TRUE",
    [actionKey]
  );

  const results = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (const mission of missions) {
    // Retrieve/upsert student progress row
    const { rows: progressRows } = await db.query(`
      SELECT * FROM public.student_missions 
      WHERE student_id = $1 AND mission_id = $2 AND date = $3
    `, [studentId, mission.id, todayStr]);

    let progress = null;
    if (progressRows.length === 0) {
      const { rows: insRows } = await db.query(`
        INSERT INTO public.student_missions (student_id, mission_id, date, current_count, completed)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING *
      `, [studentId, mission.id, todayStr, count]);
      progress = insRows[0];
    } else {
      progress = progressRows[0];
      if (!progress.completed) {
        const newCount = progress.current_count + count;
        const completed = newCount >= mission.target_count;
        
        const { rows: updRows } = await db.query(`
          UPDATE public.student_missions 
          SET current_count = $1, completed = $2
          WHERE student_id = $3 AND mission_id = $4 AND date = $5
          RETURNING *
        `, [newCount, completed, studentId, mission.id, todayStr]);
        progress = updRows[0];

        // Award rewards if newly completed
        if (completed) {
          await awardXp(db, {
            studentId,
            ruleId: 'revision', // fallback rule, or dynamically configure
            referenceId: `mission_${mission.id}`
          });
          
          await db.query(`
            UPDATE public.gamification_profiles 
            SET coins = COALESCE(coins, 0) + $1 
            WHERE student_id = $2
          `, [mission.coin_reward, studentId]);

          await db.query(`
            INSERT INTO public.validation_audit_logs (user_id, action, details)
            VALUES ($1, 'MISSION_COMPLETED', $2)
          `, [studentId, `Completed mission ${mission.id}. Received ${mission.xp_reward} XP and ${mission.coin_reward} coins.`]);
        }
      }
    }
    results.push(progress);
  }

  return results;
}

/**
 * Validates criteria for student achievements and unlocks rewards.
 */
async function evaluateAchievements(db, { studentId }) {
  // Get all active achievements
  const { rows: achievements } = await db.query(
    "SELECT * FROM public.achievements WHERE active = TRUE"
  );

  // Get already unlocked achievements
  const { rows: unlocked } = await db.query(
    "SELECT achievement_id FROM public.student_achievements WHERE student_id = $1",
    [studentId]
  );
  const unlockedSet = new Set(unlocked.map(u => u.achievement_id));

  // Get student stats
  const profile = await ensureGamificationProfile(db, studentId);
  const { rows: correctCountRows } = await db.query(`
    SELECT COUNT(*)::int as count FROM public.xp_transactions 
    WHERE user_id = $1 AND transaction_type = 'question_correct'
  `, [studentId]);
  const correctSolves = correctCountRows[0].count;

  const { rows: aiLogsRows } = await db.query(`
    SELECT COUNT(*)::int as count FROM public.xp_transactions 
    WHERE user_id = $1 AND transaction_type = 'ai_tutor_session'
  `, [studentId]);
  const aiSessions = aiLogsRows[0].count;

  const { rows: perfectMockRows } = await db.query(`
    SELECT COUNT(*)::int as count FROM public.xp_transactions 
    WHERE user_id = $1 AND transaction_type = 'perfect_score'
  `, [studentId]);
  const perfectMocks = perfectMockRows[0].count;

  for (const ach of achievements) {
    if (unlockedSet.has(ach.id)) continue;

    // Evaluate dynamic rules
    let match = false;
    const reqs = ach.requirements_json || {};

    if (reqs.streak_days && profile.longest_streak >= reqs.streak_days) {
      match = true;
    }
    if (reqs.correct_solves && correctSolves >= reqs.correct_solves) {
      match = true;
    }
    if (reqs.ai_sessions && aiSessions >= reqs.ai_sessions) {
      match = true;
    }
    if (reqs.perfect_mocks && perfectMocks >= reqs.perfect_mocks) {
      match = true;
    }

    if (match) {
      // Unlock achievement!
      await db.query(`
        INSERT INTO public.student_achievements (student_id, achievement_id, unlocked_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `, [studentId, ach.id]);

      // Award Rewards
      await awardXp(db, {
        studentId,
        ruleId: 'revision',
        referenceId: `achievement_${ach.id}`
      });

      await db.query(`
        UPDATE public.gamification_profiles 
        SET coins = COALESCE(coins, 0) + $1 
        WHERE student_id = $2
      `, [ach.coin_reward, studentId]);

      // Log audit trail
      await db.query(`
        INSERT INTO public.validation_audit_logs (user_id, action, details)
        VALUES ($1, 'ACHIEVEMENT_UNLOCKED', $2)
      `, [studentId, `Unlocked achievement '${ach.name}' (${ach.difficulty}). Reward: ${ach.xp_reward} XP, ${ach.coin_reward} Coins.`]);
    }
  }
}

/**
 * Purchases a store cosmetic or streak freeze item.
 */
async function purchaseStoreItem(db, { studentId, itemId }) {
  // 1. Fetch item
  const { rows: itemRows } = await db.query(
    "SELECT * FROM public.store_items WHERE id = $1 AND active = TRUE",
    [itemId]
  );
  if (itemRows.length === 0) {
    throw new Error(`Store item '${itemId}' is not active or does not exist.`);
  }
  const item = itemRows[0];

  // 2. Fetch student coins balance
  const profile = await ensureGamificationProfile(db, studentId);
  if (profile.coins < item.price_coins) {
    throw new Error("Insufficient coins balance to purchase store item.");
  }

  // 3. Complete Transaction
  await db.query(`
    UPDATE public.gamification_profiles 
    SET coins = coins - $1 
    WHERE student_id = $2
  `, [item.price_coins, studentId]);

  // Apply power-up entitlements directly
  if (itemId === 'powerup_lives_refill') {
    await db.query(`
      UPDATE public.gamification_profiles 
      SET lives = 5 
      WHERE student_id = $1
    `, [studentId]);
  } else if (itemId === 'powerup_streak_freeze') {
    // Add custom handling logic or audit log marker
  }

  // 4. Log Store Purchase
  await db.query(`
    INSERT INTO public.store_purchases (student_id, item_id, price_paid)
    VALUES ($1, $2, $3)
  `, [studentId, itemId, item.price_coins]);

  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'STORE_PURCHASE', $2)
  `, [studentId, `Purchased store item: ${item.name} for ${item.price_coins} coins.`]);

  return { success: true, item, remainingCoins: profile.coins - item.price_coins };
}

/**
 * Retrieves the league leaderboard rankings.
 */
async function getLeaderboard(db, { leagueId, limit = 100 }) {
  const { rows } = await db.query(`
    SELECT 
      p.id as student_id,
      p.full_name,
      p.xp_balance,
      gp.coins,
      gp.current_streak,
      gp.longest_streak,
      gp.current_league_id
    FROM public.profiles p
    JOIN public.gamification_profiles gp ON gp.student_id = p.id
    WHERE gp.current_league_id = $1
    ORDER BY p.xp_balance DESC, gp.longest_streak DESC
    LIMIT $2
  `, [leagueId, limit]);
  return rows;
}

module.exports = {
  ensureGamificationProfile,
  awardXp,
  evaluateMissions,
  evaluateAchievements,
  purchaseStoreItem,
  getLeaderboard
};
