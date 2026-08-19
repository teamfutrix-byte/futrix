const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Multi-Tenant DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Extend tenants table with new columns if they do not exist
    console.log("- Extending public.tenants table schema...");
    await client.query(`
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS short_name VARCHAR(150);
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS org_type VARCHAR(50) DEFAULT 'Coaching Institute';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'Free';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'US';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100) DEFAULT 'system';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS profile_details JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS academic_config JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS storage_limits JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb;
    `);
    console.log("✓ tenants table updated.");

    // 2. Create institute_batches
    console.log("- Creating institute_batches table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.institute_batches (
        id VARCHAR PRIMARY KEY,
        tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
        academic_year VARCHAR(20) NOT NULL,
        session VARCHAR(50) NOT NULL,
        course VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        section VARCHAR(50),
        timing VARCHAR(100),
        teacher_id VARCHAR(100),
        student_ids VARCHAR(100)[] DEFAULT '{}',
        capacity INT NOT NULL DEFAULT 50,
        status VARCHAR(50) DEFAULT 'Active',
        schedule JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_batches_tenant ON public.institute_batches(tenant_id);
    `);
    console.log("✓ institute_batches table created.");

    // 3. Create institute_members
    console.log("- Creating institute_members table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.institute_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        joined_at TIMESTAMP DEFAULT now(),
        UNIQUE(tenant_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_members_tenant ON public.institute_members(tenant_id);
    `);
    console.log("✓ institute_members table created.");

    // 4. Create institute_billing
    console.log("- Creating institute_billing table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.institute_billing (
        id VARCHAR PRIMARY KEY,
        tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100) NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        outstanding NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        billing_date TIMESTAMP DEFAULT now(),
        due_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Paid',
        breakdown JSONB DEFAULT '{}'::jsonb,
        payment_method VARCHAR(50)
      );
      CREATE INDEX IF NOT EXISTS idx_billing_tenant ON public.institute_billing(tenant_id);
    `);
    console.log("✓ institute_billing table created.");

    // 5. Create tenant_audit_logs
    console.log("- Creating tenant_audit_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
        actor_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSONB DEFAULT '{}'::jsonb,
        timestamp TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_logs_tenant ON public.tenant_audit_logs(tenant_id);
    `);
    console.log("✓ tenant_audit_logs table created.");

    // 6. Seed default tenant
    console.log("- Seeding default tenant 'Apex Coaching Academy'...");
    const tenantName = 'Apex Coaching Academy';
    const branding = {
      primaryColor: '#4d8eff',
      secondaryColor: '#06b6d4',
      accentColor: '#10b981',
      typography: 'Geist',
      logoUrl: '/assets/apex-logo.png',
      darkLogoUrl: '/assets/apex-logo-dark.png'
    };
    const profile = {
      address: 'Apex Towers, Sector-12, Dwarka',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      phone: '+91 9988776655',
      email: 'support@apex.io',
      principal: 'Dr. R. K. Apex',
      verification_status: 'Verified'
    };
    const academic = {
      exam_types: ['JEE Main', 'JEE Advanced', 'NEET Sectional'],
      boards: ['CBSE', 'ICSE', 'State Board'],
      subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology']
    };
    const aiConfig = {
      enabled: true,
      daily_limit_tokens: 100000,
      tutor_enabled: true
    };
    const limits = {
      max_students: 500,
      max_teachers: 30,
      max_media_bytes: 1073741824 // 1GB
    };

    // Upsert the seeded tenant profile
    await client.query(`
      INSERT INTO public.tenants (name, domain, subdomain, branding_config, status, short_name, org_type, subscription_plan, region, timezone, owner_id, profile_details, academic_config, ai_config, storage_limits)
      VALUES ($1, 'apex.futrix.io', 'apex', $2, 'Active', 'Apex Academy', 'Coaching Institute', 'Starter', 'IN', 'Asia/Kolkata', 'admin_test', $3, $4, $5, $6)
      ON CONFLICT (name) DO UPDATE SET
        domain = EXCLUDED.domain,
        subdomain = EXCLUDED.subdomain,
        branding_config = EXCLUDED.branding_config,
        profile_details = EXCLUDED.profile_details,
        academic_config = EXCLUDED.academic_config,
        ai_config = EXCLUDED.ai_config,
        storage_limits = EXCLUDED.storage_limits;
    `, [tenantName, JSON.stringify(branding), JSON.stringify(profile), JSON.stringify(academic), JSON.stringify(aiConfig), JSON.stringify(limits)]);

    console.log("✓ Default tenant seeded successfully.");
    console.log("Migrations completed.");

  } catch (err) {
    console.error("Multi-Tenant Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
