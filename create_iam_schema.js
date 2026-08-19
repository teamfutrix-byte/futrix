const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise IAM DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log("- Dropping existing IAM tables if they exist...");
    await client.query(`
      DROP TABLE IF EXISTS public.iam_access_requests CASCADE;
      DROP TABLE IF EXISTS public.iam_verification_states CASCADE;
      DROP TABLE IF EXISTS public.iam_sessions CASCADE;
      DROP TABLE IF EXISTS public.iam_role_permissions CASCADE;
      DROP TABLE IF EXISTS public.iam_permissions CASCADE;
    `);

    // 1. Create iam_permissions table
    console.log("- Creating public.iam_permissions table...");
    await client.query(`
      CREATE TABLE public.iam_permissions (
        id VARCHAR PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL
      );
    `);
    console.log("✓ iam_permissions created.");

    // 2. Create iam_role_permissions table
    console.log("- Creating public.iam_role_permissions table...");
    await client.query(`
      CREATE TABLE public.iam_role_permissions (
        role VARCHAR(50) NOT NULL,
        permission_id VARCHAR(50) REFERENCES public.iam_permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role, permission_id)
      );
    `);
    console.log("✓ iam_role_permissions created.");

    // 3. Create iam_sessions table
    console.log("- Creating public.iam_sessions table...");
    await client.query(`
      CREATE TABLE public.iam_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        device_id VARCHAR(100),
        browser VARCHAR(150),
        operating_system VARCHAR(150),
        ip_address VARCHAR(50),
        location VARCHAR(100),
        login_time TIMESTAMP DEFAULT now(),
        last_active TIMESTAMP DEFAULT now(),
        risk_score INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Active'
      );
    `);
    console.log("✓ iam_sessions created.");

    // 4. Create iam_verification_states table
    console.log("- Creating public.iam_verification_states table...");
    await client.query(`
      CREATE TABLE public.iam_verification_states (
        user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_secret VARCHAR(100),
        email_verified BOOLEAN DEFAULT false,
        phone_verified BOOLEAN DEFAULT false,
        identity_verified BOOLEAN DEFAULT false,
        account_status VARCHAR(50) DEFAULT 'Active',
        failed_logins INT DEFAULT 0,
        lock_expires_at TIMESTAMP
      );
    `);
    console.log("✓ iam_verification_states created.");

    // 5. Create iam_access_requests table
    console.log("- Creating public.iam_access_requests table...");
    await client.query(`
      CREATE TABLE public.iam_access_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        requested_role VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        approved_by VARCHAR(100),
        status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✓ iam_access_requests created.");

    // 6. Seed granular permissions catalog
    console.log("Seeding IAM permissions catalog...");
    await client.query(`
      INSERT INTO public.iam_permissions (id, display_name, category)
      VALUES
        ('user:create', 'Create user accounts', 'users'),
        ('user:delete', 'Delete user accounts', 'users'),
        ('user:modify_role', 'Modify user roles (RBAC)', 'users'),
        ('payments:manage', 'Manage payments & invoices', 'payments'),
        ('payments:refund', 'Process payment refunds', 'payments'),
        ('ai:configure', 'Configure gateway & model routing', 'ai'),
        ('ai:test', 'Sandbox test prompt templates', 'ai'),
        ('cms:publish', 'Publish landing pages & blogs', 'cms'),
        ('cms:rollback', 'Rollback CMS version histories', 'cms'),
        ('system:configure', 'Modify global settings & feature flags', 'system'),
        ('reports:export', 'Export audit logs & compliance reports', 'system')
    `);

    // 7. Seed role-based permissions mappings
    console.log("Seeding role permissions maps...");
    // Admin has full control
    // Teacher manages cms & some tests
    // Student has general access
    await client.query(`
      INSERT INTO public.iam_role_permissions (role, permission_id)
      VALUES
        ('admin', 'user:create'),
        ('admin', 'user:delete'),
        ('admin', 'user:modify_role'),
        ('admin', 'payments:manage'),
        ('admin', 'payments:refund'),
        ('admin', 'ai:configure'),
        ('admin', 'ai:test'),
        ('admin', 'cms:publish'),
        ('admin', 'cms:rollback'),
        ('admin', 'system:configure'),
        ('admin', 'reports:export'),
        
        ('teacher', 'cms:publish'),
        ('teacher', 'ai:test'),
        
        ('student', 'ai:test')
    `);

    // 8. Bootstrap verification state records for all existing profile UUIDs
    console.log("Bootstrapping verification records for existing profiles...");
    await client.query(`
      INSERT INTO public.iam_verification_states (user_id, email_verified, phone_verified, identity_verified, account_status)
      SELECT id, true, false, false, 'Active' FROM public.profiles
      ON CONFLICT (user_id) DO NOTHING
    `);

    console.log("✓ Seeding complete. IAM migrations finished.");

  } catch (err) {
    console.error("IAM Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
