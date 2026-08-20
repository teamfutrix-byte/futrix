const { Client } = require('pg');

async function run() {
  console.log('Testing direct connection to db.dsduytkikxfgiyptdwex.supabase.co on port 5432 with old password...');
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ SUCCESS: Connected directly with old password!');
    const { rows } = await client.query('SELECT NOW()');
    console.log('Query result:', rows[0]);
  } catch (err) {
    console.error('✗ FAILED with old password:', err.message);
  } finally {
    await client.end();
  }
}

run();
