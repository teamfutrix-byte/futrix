const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function main() {
  console.log("Starting Onboarding & Welcome Kit DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Add onboarding_completed to public.profiles
    console.log("- Checking/Adding onboarding_completed to public.profiles...");
    await client.query(`
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
    `);

    // 2. Create public.onboarding_assets
    console.log("- Creating onboarding_assets table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.onboarding_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR NOT NULL UNIQUE,
        user_type VARCHAR NOT NULL, -- 'candidate', 'teacher'
        version VARCHAR NOT NULL DEFAULT '1.0.0',
        status VARCHAR NOT NULL DEFAULT 'published', -- 'published', 'archived'
        file_path VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Create public.onboarding_metrics
    console.log("- Creating onboarding_metrics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.onboarding_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        user_type VARCHAR NOT NULL,
        email_sent BOOLEAN DEFAULT false,
        email_delivered BOOLEAN DEFAULT false,
        email_opened BOOLEAN DEFAULT false,
        download_count INTEGER DEFAULT 0,
        onboarding_completed BOOLEAN DEFAULT false,
        first_login_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Create public.onboarding_downloads
    console.log("- Creating onboarding_downloads table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.onboarding_downloads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        filename VARCHAR NOT NULL,
        downloaded_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Onboarding & Welcome Kit DB Migrations completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

main();
