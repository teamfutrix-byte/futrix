const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to database.");

    console.log("Adding email_verified and otp_code columns to public.profiles...");
    await client.query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;');
    await client.query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS otp_code text;');
    console.log("[✓] Columns added successfully.");

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

main();
