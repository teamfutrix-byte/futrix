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

    // Query auth.users
    const usersRes = await client.query('SELECT id, email, encrypted_password, email_confirmed_at, created_at FROM auth.users LIMIT 10');
    console.log("=== auth.users ===");
    console.log(usersRes.rows);

    // Query public.profiles
    const profilesRes = await client.query('SELECT id, full_name, email, phone, role, xp_balance, preparation_for FROM public.profiles LIMIT 10');
    console.log("=== public.profiles ===");
    console.log(profilesRes.rows);

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
