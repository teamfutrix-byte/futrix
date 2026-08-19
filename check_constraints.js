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

    // Query constraints on profiles
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'public.profiles'::regclass;
    `);
    console.log("=== Constraints on profiles ===");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
