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
    
    // Inspect columns of questions
    const colRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'questions'
    `);
    console.log("questions columns:", colRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
