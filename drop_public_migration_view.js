const { Client } = require('pg');

async function dropView() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    console.log("Dropping public.schema_migrations view...");
    await client.query('DROP VIEW IF EXISTS public.schema_migrations');
    console.log("[✓] View successfully dropped!");

  } catch (err) {
    console.error("[✗] Error dropping view:", err.message);
  } finally {
    await client.end();
  }
}

dropView();
