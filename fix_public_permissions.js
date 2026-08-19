const { Client } = require('pg');

async function fixPublicPermissions() {
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

    console.log("Granting public schema privileges to auth roles...");
    await client.query('GRANT ALL ON SCHEMA public TO supabase_auth_admin, supabase_admin');
    await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin, supabase_admin');
    await client.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin, supabase_admin');
    await client.query('GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin, supabase_admin');

    console.log("[✓] Public schema privileges successfully granted!");

  } catch (err) {
    console.error("[✗] Error executing GRANT commands:", err);
  } finally {
    await client.end();
  }
}

fixPublicPermissions();
