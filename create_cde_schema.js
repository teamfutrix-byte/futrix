/**
 * Enterprise Content Distribution Engine (CDE) Database Schema Migration
 * Module 4D-3: content_distribution, distribution_rules, routing_history,
 * content_recommendation_engine, channel_mapping, distribution_schedule, promotion_rules,
 * distribution_analytics, optimization_history, future_distribution_models
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
  console.log('[CDE SCHEMA] Connected. Creating content distribution tables...');

  // 1. content_distribution
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_distribution (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL, -- 'Question', 'Test', etc.
      content_id VARCHAR(100) NOT NULL,
      status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Routed', 'Distributed', 'Expired', 'Retired'
      priority INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT content_distribution_unique_item UNIQUE (content_type, content_id)
    )
  `);
  console.log('  ✓ content_distribution');

  // 2. distribution_rules
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.distribution_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name VARCHAR(100) UNIQUE NOT NULL,
      target_channel VARCHAR(50) NOT NULL, -- 'Daily Test', 'Weekly Test', 'Memory Lab', etc.
      criteria_json JSONB DEFAULT '{}'::jsonb,
      priority_weight INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ distribution_rules');

  // Seed default distribution rules
  await db.query(`
    INSERT INTO public.distribution_rules (rule_name, target_channel, criteria_json, priority_weight)
    VALUES
      ('High Quality Bio questions to Flashcards', 'Flashcards', '{"subject": "Biology", "minQualityScore": 85}'::jsonb, 3),
      ('Tricky physics questions to Daily challenge', 'Challenge Mode', '{"subject": "Physics", "difficulty": "Hard"}'::jsonb, 2),
      ('Low accuracy topics to Revision Queue', 'Revision Queue', '{"maxAccuracyPct": 50}'::jsonb, 1)
    ON CONFLICT (rule_name) DO NOTHING
  `);
  console.log('  ✓ distribution_rules default seed');

  // 3. routing_history
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.routing_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      assigned_channel VARCHAR(50) NOT NULL,
      routed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      routing_reason TEXT,
      ai_confidence_score NUMERIC(5,2) DEFAULT 90.00,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ routing_history');

  // 4. content_recommendation_engine
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_recommendation_engine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      recommended_channel VARCHAR(50) NOT NULL,
      reasoning TEXT,
      confidence_score NUMERIC(5,2) DEFAULT 85.00,
      priority INTEGER DEFAULT 2,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_recommendation_engine');

  // 5. channel_mapping
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.channel_mapping (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      channel_name VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT channel_mapping_unique_mapping UNIQUE (content_type, content_id, channel_name)
    )
  `);
  console.log('  ✓ channel_mapping');

  // 6. distribution_schedule
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.distribution_schedule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      channel_name VARCHAR(50) NOT NULL,
      publish_at TIMESTAMPTZ NOT NULL,
      expire_at TIMESTAMPTZ,
      status VARCHAR(30) DEFAULT 'Scheduled', -- 'Scheduled', 'Published', 'Expired'
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ distribution_schedule');

  // 7. promotion_rules
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.promotion_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name VARCHAR(100) UNIQUE NOT NULL,
      trigger_metric VARCHAR(50) NOT NULL, -- 'Quality Score', 'Usage Frequency', 'Retention Value'
      threshold_value NUMERIC(8,2) NOT NULL,
      action_type VARCHAR(50) NOT NULL, -- 'Move to Premium', 'Add to Memory Lab'
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ promotion_rules');

  // Seed default promotion rules
  await db.query(`
    INSERT INTO public.promotion_rules (rule_name, trigger_metric, threshold_value, action_type)
    VALUES
      ('Promote Popular Free questions to Premium', 'Usage Frequency', 100.00, 'Move to Premium'),
      ('Promote High Quality to Memory Lab', 'Quality Score', 88.00, 'Add to Memory Lab')
    ON CONFLICT (rule_name) DO NOTHING
  `);
  console.log('  ✓ promotion_rules default seed');

  // 8. distribution_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.distribution_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_name VARCHAR(50) NOT NULL,
      content_reach INTEGER DEFAULT 0,
      student_engagement INTEGER DEFAULT 0,
      click_rate_pct NUMERIC(5,2) DEFAULT 0.00,
      attempt_rate_pct NUMERIC(5,2) DEFAULT 0.00,
      completion_rate_pct NUMERIC(5,2) DEFAULT 0.00,
      recorded_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT distribution_analytics_unique_channel UNIQUE (channel_name, recorded_date)
    )
  `);
  console.log('  ✓ distribution_analytics');

  // Seed default analytics
  await db.query(`
    INSERT INTO public.distribution_analytics (channel_name, content_reach, student_engagement, click_rate_pct, attempt_rate_pct, completion_rate_pct)
    VALUES
      ('Mock Test', 1200, 300, 25.00, 20.00, 18.00),
      ('Memory Lab', 950, 450, 47.37, 40.00, 38.50)
    ON CONFLICT (channel_name, recorded_date) DO NOTHING
  `);
  console.log('  ✓ distribution_analytics default seed');

  // 9. optimization_history
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.optimization_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      optimization_metric VARCHAR(100) NOT NULL,
      improvement_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ optimization_history');

  // 10. future_distribution_models
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_distribution_models (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name VARCHAR(100) UNIQUE NOT NULL,
      config_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_distribution_models');

  // Seed future distribution config
  await db.query(`
    INSERT INTO public.future_distribution_models (model_name, config_json)
    VALUES ('Offline AR/VR delivery node mapping', '{"supported_devices": ["Quest 3", "Apple Vision Pro"], "caching_mode": "Edge"}'::jsonb)
    ON CONFLICT (model_name) DO NOTHING
  `);
  console.log('  ✓ future_distribution_models default seed');

  console.log('[CDE SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[CDE SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
