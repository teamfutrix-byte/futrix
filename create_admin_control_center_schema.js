const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log('🚀 Running FUTRIX Super Admin Control Center migrations...');
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        inherited_roles TEXT[] DEFAULT '{}'::TEXT[],
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log('✓ Created public.roles table.');

    // 2. Permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
        scope VARCHAR(50) NOT NULL,
        actions VARCHAR(50)[] NOT NULL,
        conditions JSONB DEFAULT '{}'::JSONB,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_permissions_role_id ON public.permissions(role_id);
    `);
    console.log('✓ Created public.permissions table.');

    // 3. Tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) UNIQUE NOT NULL,
        domain VARCHAR(255) UNIQUE,
        branding_config JSONB DEFAULT '{}'::JSONB,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log('✓ Created public.tenants table.');

    // 4. Platform Configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.platform_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        version INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Approved',
        updated_by UUID,
        updated_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_platform_configs_category ON public.platform_configs(category);
    `);
    console.log('✓ Created public.platform_configs table.');

    // 5. Config Versions history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.config_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id UUID REFERENCES public.platform_configs(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        value JSONB NOT NULL,
        change_summary TEXT,
        changed_by UUID,
        approved_by UUID,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_config_versions_id_ver ON public.config_versions(config_id, version);
    `);
    console.log('✓ Created public.config_versions table.');

    // 6. Approval Requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        requested_by UUID,
        approvers JSONB DEFAULT '[]'::JSONB,
        comments TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log('✓ Created public.approval_requests table.');

    // 7. Emergency States table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.emergency_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state_name VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT false,
        updated_by UUID,
        updated_at TIMESTAMP DEFAULT now(),
        reason TEXT
      );
    `);
    console.log('✓ Created public.emergency_states table.');

    // 8. Admin Preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.admin_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        language VARCHAR(10) DEFAULT 'en',
        theme VARCHAR(20) DEFAULT 'dark',
        timezone VARCHAR(50) DEFAULT 'UTC',
        dashboard_layout JSONB DEFAULT '{}'::JSONB,
        shortcuts JSONB DEFAULT '{}'::JSONB,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log('✓ Created public.admin_preferences table.');

    // ── SEED INITIAL ROLES ──
    console.log('🌱 Seeding initial roles...');
    const seedRoles = [
      { name: 'Platform Owner', desc: 'Highest authority. Complete platform and tenant control.', priority: 100, inherit: [] },
      { name: 'Chief Administrator', desc: 'Manages systems, operations, and business billing.', priority: 90, inherit: ['System Administrator', 'Business Administrator'] },
      { name: 'System Administrator', desc: 'Maintains configs, databases, and platform integrations.', priority: 80, inherit: ['Support Administrator'] },
      { name: 'Business Administrator', desc: 'Manages sales, payments, subscriptions, and billing.', priority: 70, inherit: [] },
      { name: 'Content Administrator', desc: 'Governs question bank, tests, syllabus and chapters.', priority: 60, inherit: [] },
      { name: 'AI Administrator', desc: 'Maintains AI setting configuration keys, prompts, and rates.', priority: 50, inherit: [] },
      { name: 'Support Administrator', desc: 'Platform support, user ticket resolutions.', priority: 40, inherit: [] },
      { name: 'Institute Administrator', desc: 'Controls single institute tenant scope.', priority: 30, inherit: [] },
      { name: 'Teacher', desc: 'Creates questions, views classroom analytics, assigns tasks.', priority: 20, inherit: [] },
      { name: 'Student', desc: 'Solves mocks, uses smart revisions, gains XP.', priority: 10, inherit: [] }
    ];

    for (const r of seedRoles) {
      await client.query(`
        INSERT INTO public.roles (name, description, priority, inherited_roles)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE 
        SET description = EXCLUDED.description, priority = EXCLUDED.priority, inherited_roles = EXCLUDED.inherited_roles;
      `, [r.name, r.desc, r.priority, r.inherit]);
    }
    console.log('✓ Seeded system roles.');

    // ── SEED EMERGENCY STATES ──
    console.log('🌱 Seeding default emergency state variables...');
    const states = [
      'read_only_mode',
      'disable_registrations',
      'disable_payments',
      'disable_ai',
      'disable_mocks',
      'lockdown_active'
    ];
    for (const st of states) {
      await client.query(`
        INSERT INTO public.emergency_states (state_name, is_active, reason)
        VALUES ($1, false, 'Initial state setup.')
        ON CONFLICT (state_name) DO NOTHING;
      `, [st]);
    }
    console.log('✓ Seeded emergency states.');

    // ── SEED DUMMY CONFIGS ──
    console.log('🌱 Seeding default platform configurations...');
    const seedConfigs = [
      {
        category: 'ai',
        key: 'ai_daily_limit_free',
        value: { limit: 5, reset_period_hours: 24 }
      },
      {
        category: 'ai',
        key: 'ai_daily_limit_pro',
        value: { limit: 500, reset_period_hours: 24 }
      },
      {
        category: 'gamification',
        key: 'xp_multipliers',
        value: { easy: 1.0, medium: 1.5, hard: 2.5 }
      },
      {
        category: 'security',
        key: 'password_policy',
        value: { min_length: 8, require_digits: true, require_special: true }
      },
      {
        category: 'localization',
        key: 'supported_languages',
        value: ['en', 'hi', 'te', 'ta']
      }
    ];

    for (const cfg of seedConfigs) {
      await client.query(`
        INSERT INTO public.platform_configs (category, key, value, version, status)
        VALUES ($1, $2, $3, 1, 'Approved')
        ON CONFLICT (key) DO UPDATE 
        SET value = EXCLUDED.value;
      `, [cfg.category, cfg.key, JSON.stringify(cfg.value)]);
    }
    console.log('✓ Seeded default configurations.');

    console.log('🎉 Super Admin Control Center database migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
