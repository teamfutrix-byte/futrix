/**
 * Enterprise Ranking & Leaderboard Intelligence Engine Database Schema Migration
 * Module 4E-2: rankings, leaderboards, league_positions, rank_history,
 * leaderboard_snapshots, competitive_analytics, tie_break_rules,
 * achievement_events, historical_rankings, future_competition_models
 */
const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  const db = new Client(dbConfig);
  await db.connect();
  console.log('[RANKING SCHEMA] Connected. Creating ranking tables...');

  // 1. rankings
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.rankings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      ranking_type VARCHAR(50) NOT NULL, -- 'Global', 'AIR', 'Institute', 'League', 'XP'
      rank_value INTEGER NOT NULL,
      score_basis NUMERIC(8,2) NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_user_ranking_type UNIQUE (user_id, ranking_type)
    )
  `);
  console.log('  ✓ rankings');

  // 2. leaderboards
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.leaderboards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      leaderboard_name VARCHAR(100) UNIQUE NOT NULL,
      leaderboard_type VARCHAR(50) NOT NULL, -- 'Daily', 'Weekly', 'Monthly', 'Season', 'XP'
      rules_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ leaderboards');

  // Seed default leaderboard
  await db.query(`
    INSERT INTO public.leaderboards (leaderboard_name, leaderboard_type, rules_json)
    VALUES ('Daily Biology Sprint Leaderboard', 'Daily', '{"subject": "Biology"}'::jsonb)
    ON CONFLICT (leaderboard_name) DO NOTHING
  `);
  console.log('  ✓ leaderboards seed');

  // 3. league_positions
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.league_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
      current_league VARCHAR(50) DEFAULT 'Bronze', -- 'Bronze', 'Silver', 'Gold', 'Diamond'
      league_rank INTEGER DEFAULT 1,
      promotion_zone BOOLEAN DEFAULT false,
      demotion_zone BOOLEAN DEFAULT false,
      required_xp_for_promotion NUMERIC(8,2) DEFAULT 1000.00,
      season_progress_pct NUMERIC(5,2) DEFAULT 0.00,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ league_positions');

  // 4. rank_history
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.rank_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      ranking_type VARCHAR(50) NOT NULL,
      old_rank INTEGER,
      new_rank INTEGER,
      recorded_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ rank_history');

  // 5. leaderboard_snapshots
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
      snapshot_date DATE DEFAULT CURRENT_DATE,
      rankings_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ leaderboard_snapshots');

  // 6. competitive_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.competitive_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
      rank_movement INTEGER DEFAULT 0,
      league_growth_pct NUMERIC(5,2) DEFAULT 0.00,
      xp_growth_pct NUMERIC(5,2) DEFAULT 0.00,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ competitive_analytics');

  // 7. tie_break_rules
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.tie_break_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name VARCHAR(100) UNIQUE NOT NULL,
      priority_list JSONB NOT NULL, -- e.g. ["Higher Score", "Higher Accuracy", "Lower Time"]
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ tie_break_rules');

  // Seed default tie break rule
  await db.query(`
    INSERT INTO public.tie_break_rules (rule_name, priority_list)
    VALUES ('NEET Tie Breaker standard configuration', '["Higher Accuracy", "Lower Wrong Answers", "Lower Time"]'::jsonb)
    ON CONFLICT (rule_name) DO NOTHING
  `);
  console.log('  ✓ tie_break_rules seed');

  // 8. achievement_events
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.achievement_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      achievement_name VARCHAR(100) NOT NULL, -- 'Top Performer', 'Fast Solver'
      evidence TEXT,
      unlocked_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ achievement_events');

  // 9. historical_rankings
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.historical_rankings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      season VARCHAR(30) NOT NULL,
      final_rank INTEGER,
      final_xp NUMERIC(8,2),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ historical_rankings');

  // 10. future_competition_models
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_competition_models (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      competition_name VARCHAR(100) UNIQUE NOT NULL,
      config_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_competition_models');

  // Seed future global competition configuration model
  await db.query(`
    INSERT INTO public.future_competition_models (competition_name, config_json)
    VALUES ('National Merit Olympiad predictive AI parameters', '{"duration_weeks": 4, "global_rewards_pool_xp": 10000}'::jsonb)
    ON CONFLICT (competition_name) DO NOTHING
  `);
  console.log('  ✓ future_competition_models seed');

  console.log('[RANKING SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[RANKING SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
