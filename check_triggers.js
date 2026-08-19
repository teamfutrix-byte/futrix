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

    // Query pg_stat_activity
    const res = await client.query(`
      SELECT pid, query, state, wait_event_type, wait_event 
      FROM pg_stat_activity 
      WHERE state IS NOT NULL
    `);
    console.log("=== Active connections ===");
    console.log(JSON.stringify(res.rows, null, 2));

    // Also let's check functions
    const funcsRes = await client.query(`
      SELECT routine_name, routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name LIKE '%user%'
    `);
    console.log("=== Public functions containing 'user' ===");
    console.log(JSON.stringify(funcsRes.rows, null, 2));

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
