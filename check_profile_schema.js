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

    // Check columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'profiles'
    `);
    console.log("=== profiles columns ===");
    console.log(columnsRes.rows);

    // Check existing profile for testcandidate3
    const profileRes = await client.query("SELECT * FROM public.profiles WHERE email = 'testcandidate3@gmail.com'");
    console.log("=== testcandidate3 profile ===");
    console.log(profileRes.rows);

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

main();
