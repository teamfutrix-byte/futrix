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
    const res = await client.query(`
      SELECT id, email, full_name, otp_code, created_at 
      FROM public.profiles 
      WHERE email LIKE 'testcandidate_%' 
      ORDER BY created_at DESC LIMIT 10;
    `);
    console.log("Recent test candidate profiles in DB:");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
