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
    console.log("Connected. Querying pg_stat_activity...");
    const res = await client.query(`
      SELECT pid, query_start, state, query 
      FROM pg_stat_activity 
      WHERE state IS NOT NULL AND query NOT LIKE '%pg_stat_activity%';
    `);
    console.log("Active Database Queries/States:");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
