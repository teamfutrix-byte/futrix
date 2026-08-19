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
    console.log("Connected.");

    // Check profiles
    const profileRes = await client.query(`
      SELECT id, email, role, is_blocked
      FROM public.profiles
      WHERE email = '$uperadmin@futrix.com';
    `);
    console.log("Profile search:");
    console.log(profileRes.rows);

    // Check auth.users
    const authRes = await client.query(`
      SELECT id, email, role
      FROM auth.users
      WHERE email = '$uperadmin@futrix.com';
    `);
    console.log("Auth users search:");
    console.log(authRes.rows);

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
