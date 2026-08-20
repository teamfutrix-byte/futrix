const { Client } = require('pg');

async function run() {
  console.log('Testing connection to pooler host aws-1-ap-south-1.pooler.supabase.com on port 6543 with old password...');
  const client = new Client({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.dsduytkikxfgiyptdwex',
    password: '$anjana@123man',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ SUCCESS: Connected to pooler with old password!');
    const { rows } = await client.query('SELECT NOW()');
    console.log('Query result:', rows[0]);
  } catch (err) {
    console.error('✗ FAILED:', err.message);
  } finally {
    await client.end();
  }
}

run();
