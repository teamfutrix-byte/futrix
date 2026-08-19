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

    // Query test_series
    const res = await client.query('SELECT * FROM public.test_series');
    console.log("=== test_series ===");
    console.log(res.rows);

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
