const { Client } = require('pg');

async function createView() {
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

    console.log("Creating public.schema_migrations view...");
    await client.query(`
      CREATE OR REPLACE VIEW public.schema_migrations AS 
      SELECT version FROM auth.schema_migrations
    `);
    console.log("[✓] View public.schema_migrations successfully created!");

  } catch (err) {
    console.error("[✗] Error creating view:", err.message);
  } finally {
    await client.end();
  }
}

createView();
