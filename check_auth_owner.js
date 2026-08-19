const { Client } = require('pg');

async function checkOwner() {
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

    const res = await client.query(`
      SELECT schema_name, schema_owner 
      FROM information_schema.schemata 
      WHERE schema_name = 'auth'
    `);
    console.log("Schema Owner details:", res.rows);

    const tbls = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'auth'
      LIMIT 5
    `);
    console.log("Sample Tables:", tbls.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkOwner();
