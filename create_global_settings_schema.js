const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log('🚀 Running FUTRIX Global Settings & Feature Flags migrations...');
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create Feature Flags table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        module VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        enabled BOOLEAN DEFAULT false,
        rollout_strategy VARCHAR(50) DEFAULT '100% Rollout',
        rollout_rules JSONB DEFAULT '{}'::JSONB,
        owner UUID,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
    `);
    console.log('✓ Created public.feature_flags table.');

    // 2. Create Configuration Overrides table (for inheritance)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.config_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id UUID REFERENCES public.platform_configs(id) ON DELETE CASCADE,
        level VARCHAR(50) NOT NULL, -- 'country', 'state', 'institute', 'batch', 'role', 'user'
        level_value VARCHAR(255) NOT NULL, -- e.g. 'IN', 'AP', 'inst_uuid', 'student', 'user_uuid'
        value JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        UNIQUE(config_id, level, level_value)
      );
      CREATE INDEX IF NOT EXISTS idx_config_overrides_lookup ON public.config_overrides(config_id, level, level_value);
    `);
    console.log('✓ Created public.config_overrides table.');

    // 3. Create Experiments table (A/B testing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.experiments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Running', 'Paused', 'Concluded'
        variants JSONB NOT NULL DEFAULT '[]'::JSONB, -- e.g., [{ "key": "control", "weight": 50 }, { "key": "variant_a", "weight": 50 }]
        metrics JSONB DEFAULT '{"impressions": {}, "conversions": {}}'::JSONB,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_experiments_key ON public.experiments(key);
    `);
    console.log('✓ Created public.experiments table.');

    // 4. Create Feature Dependencies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feature_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flag_key VARCHAR(100) REFERENCES public.feature_flags(key) ON DELETE CASCADE,
        depends_on_key VARCHAR(100) REFERENCES public.feature_flags(key) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT now(),
        UNIQUE(flag_key, depends_on_key)
      );
      CREATE INDEX IF NOT EXISTS idx_feature_dependencies_keys ON public.feature_dependencies(flag_key, depends_on_key);
    `);
    console.log('✓ Created public.feature_dependencies table.');

    // ── SEED INITIAL FEATURE FLAGS ──
    console.log('🌱 Seeding initial feature flags...');
    const seedFlags = [
      { key: 'llm_service', name: 'Primary LLM Engine', module: 'Infrastructure', enabled: true, strategy: '100% Rollout', rules: {} },
      { key: 'ai_credits', name: 'AI Credit Balance Service', module: 'Billing', enabled: true, strategy: '100% Rollout', rules: {} },
      { key: 'ai_tutor_enabled', name: 'AI Chatbot Mentor Widget', module: 'AI', enabled: true, strategy: '100% Rollout', rules: {} },
      { key: 'smart_revision_enabled', name: 'Memory Lab Spaced Revision', module: 'Revision', enabled: true, strategy: 'Percentage Rollout', rules: { percentage: 50 } },
      { key: 'stripe_payments_enabled', name: 'Stripe Secure Payments Checkout', module: 'Business', enabled: false, strategy: '100% Rollout', rules: {} }
    ];

    for (const f of seedFlags) {
      await client.query(`
        INSERT INTO public.feature_flags (key, display_name, module, enabled, rollout_strategy, rollout_rules)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (key) DO UPDATE
        SET display_name = EXCLUDED.display_name, module = EXCLUDED.module, enabled = EXCLUDED.enabled,
            rollout_strategy = EXCLUDED.rollout_strategy, rollout_rules = EXCLUDED.rollout_rules;
      `, [f.key, f.name, f.module, f.enabled, f.strategy, JSON.stringify(f.rules)]);
    }

    // ── SEED INITIAL DEPENDENCIES ──
    console.log('🌱 Seeding default feature dependencies...');
    const seedDeps = [
      { flag: 'ai_tutor_enabled', dependsOn: 'llm_service' },
      { flag: 'ai_tutor_enabled', dependsOn: 'ai_credits' }
    ];
    for (const d of seedDeps) {
      await client.query(`
        INSERT INTO public.feature_dependencies (flag_key, depends_on_key)
        VALUES ($1, $2)
        ON CONFLICT (flag_key, depends_on_key) DO NOTHING;
      `, [d.flag, d.dependsOn]);
    }

    // ── SEED MOCK EXPERIMENT ──
    console.log('🌱 Seeding default A/B Testing experiment...');
    await client.query(`
      INSERT INTO public.experiments (key, display_name, description, status, variants, metrics)
      VALUES (
        'mock_difficulty_algorithm',
        'Adaptive Mock Test Difficulty Matching',
        'Comparing standard difficulty levels with dynamic Bloom-level adaptive scaling.',
        'Running',
        '[{"key": "control", "weight": 50}, {"key": "adaptive_v1", "weight": 50}]'::JSONB,
        '{"impressions": {"control": 0, "adaptive_v1": 0}, "conversions": {"control": 0, "adaptive_v1": 0}}'::JSONB
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('🎉 Global Settings & Feature Flags database migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
