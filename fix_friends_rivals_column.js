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

    // Rename target_id to rival_id
    console.log("Renaming target_id column...");
    await client.query('ALTER TABLE public.friends_rivals RENAME COLUMN target_id TO rival_id;');
    console.log("[✓] Renamed target_id to rival_id.");

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

main();
