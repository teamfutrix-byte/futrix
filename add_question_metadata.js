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
    console.log("Connected to database. Adding column public.questions.ai_metadata...");
    await client.query(`
      ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_metadata jsonb;
    `);
    console.log("[✓] Database migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
