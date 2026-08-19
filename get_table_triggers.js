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
      SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'profiles';
    `);
    console.log("Triggers on public.profiles:");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
