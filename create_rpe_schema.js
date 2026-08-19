/**
 * Enterprise Result Processing Engine (RPE) Database Schema Migration
 * Module 4E-1: results, result_details, score_engine, result_xp_ledger,
 * ranking_engine, percentile_engine, performance_analytics, ai_result_reports,
 * historical_results, future_prediction_models
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
  console.log('[RPE SCHEMA] Connected. Creating result processing tables...');

  // 1. results
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE SET NULL,
      total_questions INTEGER DEFAULT 0,
      correct_answers INTEGER DEFAULT 0,
      wrong_answers INTEGER DEFAULT 0,
      skipped_answers INTEGER DEFAULT 0,
      final_score NUMERIC(6,2) DEFAULT 0.00,
      percentage NUMERIC(5,2) DEFAULT 0.00,
      normalized_score NUMERIC(6,2) DEFAULT 0.00,
      xp_earned NUMERIC(6,2) DEFAULT 0.00,
      status VARCHAR(30) DEFAULT 'Processing', -- 'Draft', 'Processing', 'Published', 'Re-evaluation', 'Locked', 'Archived', 'Cancelled'
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_user_test_result UNIQUE (user_id, test_id)
    )
  `);
  console.log('  ✓ results');

  // 2. result_details
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.result_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
      student_answer TEXT,
      correct_answer TEXT,
      is_correct BOOLEAN DEFAULT false,
      is_skipped BOOLEAN DEFAULT false,
      marks_awarded NUMERIC(5,2) DEFAULT 0.00,
      time_spent_sec INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ result_details');

  // 3. score_engine
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.score_engine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      test_id UUID UNIQUE REFERENCES public.tests(id) ON DELETE CASCADE,
      correct_marks NUMERIC(4,2) DEFAULT 4.00,
      negative_marks NUMERIC(4,2) DEFAULT -1.00,
      partial_marks_allowed BOOLEAN DEFAULT false,
      grace_marks NUMERIC(4,2) DEFAULT 0.00,
      bonus_marks NUMERIC(4,2) DEFAULT 0.00,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ score_engine');

  // 4. result_xp_ledger
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.result_xp_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      base_xp NUMERIC(6,2) DEFAULT 0.00,
      correct_xp NUMERIC(6,2) DEFAULT 0.00,
      bonus_xp NUMERIC(6,2) DEFAULT 0.00,
      streak_xp NUMERIC(6,2) DEFAULT 0.00,
      league_bonus_xp NUMERIC(6,2) DEFAULT 0.00,
      penalty_xp NUMERIC(6,2) DEFAULT 0.00,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ result_xp_ledger');

  // 5. ranking_engine
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ranking_engine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      global_rank INTEGER,
      air_rank INTEGER,
      institute_rank INTEGER,
      league_rank INTEGER,
      batch_rank INTEGER,
      subject_rank INTEGER,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ ranking_engine');

  // 6. percentile_engine
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.percentile_engine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      overall_percentile NUMERIC(5,2),
      subject_percentile NUMERIC(5,2),
      chapter_percentile NUMERIC(5,2),
      topic_percentile NUMERIC(5,2),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ percentile_engine');

  // 7. performance_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.performance_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      accuracy_pct NUMERIC(5,2),
      avg_speed_sec NUMERIC(8,2),
      attempt_rate_pct NUMERIC(5,2),
      skip_rate_pct NUMERIC(5,2),
      negative_score_pct NUMERIC(5,2),
      strength_index_json JSONB DEFAULT '{}'::jsonb,
      weakness_index_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ performance_analytics');

  // 8. ai_result_reports
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ai_result_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID REFERENCES public.results(id) ON DELETE CASCADE,
      performance_summary TEXT,
      strengths TEXT,
      weaknesses TEXT,
      critical_mistakes TEXT,
      concept_gaps TEXT,
      revision_strategy TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ ai_result_reports');

  // 9. historical_results
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.historical_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
      score_history_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ historical_results');

  // 10. future_prediction_models
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_prediction_models (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      predicted_neet_score NUMERIC(6,2),
      predicted_neet_rank INTEGER,
      confidence_interval NUMERIC(5,2),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_prediction_models');

  console.log('[RPE SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[RPE SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
