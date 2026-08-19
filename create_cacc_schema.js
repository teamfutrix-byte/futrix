/**
 * Enterprise Content Access Control Center (CACC) Database Schema Migration
 * Module 4D-1: content_access, content_visibility, content_policies,
 * subscription_rules, premium_content, feature_access, policy_versions,
 * content_lock_logs, content_access_analytics, future_policy_engine
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
  console.log('[CACC SCHEMA] Connected. Creating content access control tables...');

  // 1. content_access
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL, -- 'Question', 'Topic Test', 'Memory Lab', 'AI Mentor', etc.
      content_id VARCHAR(100), -- ID of resource in public.questions or public.tests
      resource_key VARCHAR(100), -- key identifier for memory lab, coach, etc.
      visibility_level VARCHAR(50) DEFAULT 'Free', -- 'Free', 'Limited Free', 'Premium', 'Institute Only', 'Teacher Only', 'Admin Only', 'Hidden', 'Beta', 'Coming Soon', 'Archived', 'Retired'
      is_locked BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT content_access_unique_resource UNIQUE (content_type, content_id, resource_key)
    )
  `);
  console.log('  ✓ content_access');

  // 2. content_visibility
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_visibility (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_access_id UUID REFERENCES public.content_access(id) ON DELETE CASCADE,
      preview_allowed BOOLEAN DEFAULT true,
      preview_limit INTEGER DEFAULT 3,
      release_at TIMESTAMPTZ,
      expire_at TIMESTAMPTZ,
      time_based_rule TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_visibility');

  // 3. content_policies
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_name VARCHAR(100) NOT NULL UNIQUE,
      content_type VARCHAR(50),
      visibility_level VARCHAR(50) DEFAULT 'Premium',
      allowed_plans_json JSONB DEFAULT '[]'::jsonb, -- e.g. ["PREMIUM", "PRO", "INSTITUTE"]
      allowed_leagues_json JSONB DEFAULT '[]'::jsonb, -- e.g. ["Gold", "Diamond"]
      required_xp INTEGER DEFAULT 0,
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_policies');

  // Seed default policies
  await db.query(`
    INSERT INTO public.content_policies (policy_name, content_type, visibility_level, allowed_plans_json, allowed_leagues_json)
    VALUES
      ('Premium Tests Access', 'Mock Test', 'Premium', '["PREMIUM", "PRO", "INSTITUTE"]'::jsonb, '[]'::jsonb),
      ('Memory Coach Access', 'AI Coach', 'Premium', '["PREMIUM", "PRO"]'::jsonb, '[]'::jsonb),
      ('Institute Tests Access', 'Institute Tests', 'Institute Only', '["INSTITUTE"]'::jsonb, '[]'::jsonb)
    ON CONFLICT (policy_name) DO NOTHING
  `);
  console.log('  ✓ content_policies default seed');

  // 4. subscription_rules
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.subscription_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_name VARCHAR(50) NOT NULL, -- 'FREE', 'PREMIUM', 'PRO', 'INSTITUTE'
      feature_key VARCHAR(100) NOT NULL, -- 'ai_mentor', 'memory_lab', 'wrong_notebook'
      access_granted BOOLEAN DEFAULT true,
      daily_limit INTEGER DEFAULT -1, -- -1 represents unlimited
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT subscription_rules_plan_feature UNIQUE (plan_name, feature_key)
    )
  `);
  console.log('  ✓ subscription_rules');

  // Seed default rules
  await db.query(`
    INSERT INTO public.subscription_rules (plan_name, feature_key, access_granted, daily_limit)
    VALUES
      ('FREE', 'memory_lab', true, 5),
      ('FREE', 'ai_coach', false, 0),
      ('PREMIUM', 'memory_lab', true, -1),
      ('PREMIUM', 'ai_coach', true, -1),
      ('PRO', 'memory_lab', true, -1),
      ('PRO', 'ai_coach', true, -1)
    ON CONFLICT (plan_name, feature_key) DO NOTHING
  `);
  console.log('  ✓ subscription_rules default seed');

  // 5. premium_content
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.premium_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      price_credits INTEGER DEFAULT 0,
      custom_preview_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT premium_content_unique UNIQUE (content_type, content_id)
    )
  `);
  console.log('  ✓ premium_content');

  // 6. feature_access
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.feature_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      institute_id UUID,
      feature_key VARCHAR(100) NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ feature_access');

  // 7. policy_versions
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.policy_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id UUID NOT NULL,
      version_number INTEGER DEFAULT 1,
      editor_id UUID,
      policy_data_json JSONB NOT NULL,
      change_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ policy_versions');

  // 8. content_lock_logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_lock_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100),
      resource_key VARCHAR(100),
      upgrade_clicked BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_lock_logs');

  // 9. content_access_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_access_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      free_content_count INTEGER DEFAULT 0,
      premium_content_count INTEGER DEFAULT 0,
      institute_content_count INTEGER DEFAULT 0,
      locked_clicks_count INTEGER DEFAULT 0,
      conversion_count INTEGER DEFAULT 0,
      recorded_date DATE DEFAULT CURRENT_DATE UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_access_analytics');

  // Seed default analytics row
  await db.query(`
    INSERT INTO public.content_access_analytics (free_content_count, premium_content_count, institute_content_count, locked_clicks_count, conversion_count)
    VALUES (5000, 1500, 200, 45, 12)
    ON CONFLICT (recorded_date) DO NOTHING
  `);
  console.log('  ✓ content_access_analytics default seed');

  // 10. future_policy_engine
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_policy_engine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      feature_name VARCHAR(100) NOT NULL UNIQUE,
      config_json JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_policy_engine');

  // Seed some future tutoring config
  await db.query(`
    INSERT INTO public.future_policy_engine (feature_name, config_json)
    VALUES ('AI Tutor Voice & Video Room', '{"multi_llm_routing": true, "offline_ready": false, "voice_stream_limit_mins": 30}'::jsonb)
    ON CONFLICT (feature_name) DO NOTHING
  `);
  console.log('  ✓ future_policy_engine default seed');

  console.log('[CACC SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[CACC SCHEMA] Migration execution failed:', err.stack);
  process.exit(1);
});
