const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function main() {
  console.log("Starting User Directory & Block Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log("- Checking/Adding User Directory columns to public.profiles...");
    await client.query(`
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS dob VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS guardian_name VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS city VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS qualification VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS institute_id UUID DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS pin_code VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS device_id VARCHAR DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS browser_fingerprint VARCHAR DEFAULT NULL;
    `);

    console.log("✅ User Directory schema migration completed successfully!");
  } catch (err) {
    console.error("❌ Schema migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
