const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function main() {
  const client = new Client(dbConfig);
  await client.connect();
  console.log('Connected.');
  try {
    const res = await client.query(`
      UPDATE auth.users
      SET email_confirmed_at = now()
      WHERE email = 'teamfutrix-bytes-project@futrix.internal'
      RETURNING id, email, email_confirmed_at
    `);
    console.log('Result:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
