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

    // Run CREATE POLICY command
    console.log("Creating INSERT policy on profiles table...");
    await client.query(`
      CREATE POLICY "Allow users to insert their own profile" 
      ON public.profiles 
      FOR INSERT 
      WITH CHECK (auth.uid() = id);
    `);
    console.log("[✓] Policy created successfully.");

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

main();
