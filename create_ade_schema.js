/**
 * Enterprise Assessment Delivery Engine (ADE) Database Schema Migration
 * Module 4D-4: assessment_sessions, assessment_attempts, session_tokens,
 * answer_snapshots, runtime_events, anti_cheat_logs, risk_scores,
 * delivery_analytics, resume_checkpoints, future_proctoring
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
  console.log('[ADE SCHEMA] Connected. Creating assessment delivery tables...');

  // 1. assessment_sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.assessment_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
      session_id VARCHAR(100) UNIQUE NOT NULL,
      encrypted_attempt_token TEXT NOT NULL,
      device_fingerprint VARCHAR(255),
      browser_fingerprint VARCHAR(255),
      ip_hash VARCHAR(64),
      session_signature TEXT,
      status VARCHAR(30) DEFAULT 'Active', -- 'Active', 'Suspended', 'Submitted', 'Interrupted'
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ assessment_sessions');

  // 2. assessment_attempts
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.assessment_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ,
      score NUMERIC(6,2),
      status VARCHAR(30) DEFAULT 'In Progress', -- 'In Progress', 'Completed', 'Abandoned'
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ assessment_attempts');

  // 3. session_tokens
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.session_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ session_tokens');

  // 4. answer_snapshots
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.answer_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
      selected_option TEXT,
      time_spent_sec INTEGER DEFAULT 0,
      visit_count INTEGER DEFAULT 1,
      marked_for_review BOOLEAN DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_session_question_snapshot UNIQUE (assessment_session_id, question_id)
    )
  `);
  console.log('  ✓ answer_snapshots');

  // 5. runtime_events
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.runtime_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL, -- 'Heartbeat', 'Disconnect', 'TabSwitch', 'WindowBlur', etc.
      payload_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ runtime_events');

  // 6. anti_cheat_logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.anti_cheat_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      rule_name VARCHAR(100) NOT NULL,
      evidence TEXT,
      severity VARCHAR(30) DEFAULT 'Low', -- 'Low', 'Medium', 'High', 'Critical'
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ anti_cheat_logs');

  // 7. risk_scores
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID UNIQUE REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      risk_score INTEGER DEFAULT 0, -- 0 to 100
      risk_level VARCHAR(30) DEFAULT 'Low', -- 'Low', 'Medium', 'High', 'Critical'
      evidence_summary TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ risk_scores');

  // 8. delivery_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.delivery_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      test_id UUID UNIQUE NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
      total_started INTEGER DEFAULT 0,
      total_submitted INTEGER DEFAULT 0,
      avg_completion_time_sec INTEGER DEFAULT 0,
      cheat_alerts_triggered INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ delivery_analytics');

  // 9. resume_checkpoints
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.resume_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID UNIQUE REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      checkpoint_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ resume_checkpoints');

  // 10. future_proctoring
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_proctoring (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
      ai_analysis_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_proctoring');

  console.log('[ADE SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[ADE SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
