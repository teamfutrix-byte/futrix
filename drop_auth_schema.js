const { Client } = require('pg');

async function dropAuth() {
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

    console.log("Attempting to DROP SCHEMA auth CASCADE...");
    await client.query('DROP SCHEMA auth CASCADE');
    console.log("[✓] auth schema dropped successfully!");

  } catch (err) {
    console.error("[✗] Failed to drop schema:", err.message);
  } finally {
    await client.end();
  }
}

dropAuth();
