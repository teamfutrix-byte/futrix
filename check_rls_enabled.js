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

    // Query tables and RLS status
    const res = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      JOIN pg_class ON pg_class.relname = pg_tables.tablename
      WHERE pg_tables.schemaname = 'public'
    `);
    console.log("=== RLS Status on Tables ===");
    console.log(res.rows);

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
