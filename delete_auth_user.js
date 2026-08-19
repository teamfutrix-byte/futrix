const { Client } = require('pg');

async function deleteAuthUser() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  const email = 'teamfutrix-bytes-project@futrix.internal';

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    const res = await client.query('DELETE FROM auth.users WHERE email = $1 RETURNING id', [email]);
    console.log("Deleted from auth.users:", res.rows);

    const res2 = await client.query('DELETE FROM public.profiles WHERE email = $1 RETURNING id', [email]);
    console.log("Deleted from public.profiles:", res2.rows);

  } catch (err) {
    console.error("Error deleting user:", err);
  } finally {
    await client.end();
  }
}

deleteAuthUser();
