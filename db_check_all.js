const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    const tables = ['profiles', 'battles', 'xp_transactions', 'attempts', 'questions', 'test_series'];
    for (const t of tables) {
      const cols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${t}' AND table_schema = 'public'
      `);
      console.log(`Columns in '${t}':`, cols.rows.map(r => `${r.column_name} (${r.data_type})`));
    }

  } catch (err) {
    console.error("Database connection/query error:", err);
  } finally {
    await client.end();
  }
}

checkDb();
