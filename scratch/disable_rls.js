const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  console.log('Connected to database to disable RLS...');
  
  const tables = [
    'battles',
    'revision_queue',
    'profiles',
    'attempts',
    'user_goals',
    'friends_rivals',
    'xp_transactions',
    'assessment_attempts'
  ];
  
  for (const table of tables) {
    try {
      await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
      console.log(`Successfully disabled RLS for table: ${table}`);
    } catch (err) {
      console.error(`Failed to disable RLS for table: ${table}`, err.message);
    }
  }
  
  await client.end();
  console.log('Finished RLS cleanup!');
}

main().catch(console.error);
