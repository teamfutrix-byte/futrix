const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Test Scheduling & Publishing Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create test_schedule table
    console.log("- Creating public.test_schedule table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        publish_at TIMESTAMP WITH TIME ZONE,
        expire_at TIMESTAMP WITH TIME ZONE,
        grace_period_minutes INTEGER DEFAULT 15,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create test_visibility table
    console.log("- Creating public.test_visibility table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_visibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        visibility_tier VARCHAR(50) DEFAULT 'Public', -- 'Public', 'Private', 'Free', 'Premium', 'Institute Only'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create test_access table
    console.log("- Creating public.test_access table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        allowed_subscription_tiers_json JSONB DEFAULT '[]'::jsonb,
        allowed_leagues_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create test_approvals table
    console.log("- Creating public.test_approvals table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
        review_comments TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create test_notifications table
    console.log("- Creating public.test_notifications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        target_audience VARCHAR(100) DEFAULT 'All Students',
        notification_sent_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create test_archive table
    console.log("- Creating public.test_archive table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_archive (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create test_recycle_bin table
    console.log("- Creating public.test_recycle_bin table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_recycle_bin (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create test_activity_logs table
    console.log("- Creating public.test_activity_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        event_name VARCHAR(100) NOT NULL, -- 'Status Transition', 'Visibility Change'
        details_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Test Scheduling & Publishing Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
