const { Client } = require('pg');

async function checkTriggers() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    const triggersRes = await client.query(`
      SELECT event_object_table AS table_name, trigger_name, action_statement
      FROM information_schema.triggers
      WHERE event_object_schema IN ('auth', 'public')
    `);
    console.log("Triggers found:", triggersRes.rows);

  } catch (err) {
    console.error("Error fetching triggers:", err);
  } finally {
    await client.end();
  }
}

checkTriggers();
