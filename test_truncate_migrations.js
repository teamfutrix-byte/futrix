const { Client } = require('pg');

async function testTruncate() {
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

    console.log("Attempting TRUNCATE auth.schema_migrations...");
    await client.query('TRUNCATE TABLE auth.schema_migrations CASCADE');
    console.log("[✓] Truncate successful!");

  } catch (err) {
    console.error("[✗] Failed to truncate:", err.message);
  } finally {
    await client.end();
  }
}

testTruncate();
