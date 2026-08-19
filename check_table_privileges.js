const { Client } = require('pg');

async function checkPrivileges() {
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
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'schema_migrations' AND table_schema = 'auth'
    `);
    console.log("Privileges on auth.schema_migrations:", res.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkPrivileges();
