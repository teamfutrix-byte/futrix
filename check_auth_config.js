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
    console.log("Connected to database.");

    // Query auth.config
    try {
      const configRes = await client.query('SELECT * FROM auth.config');
      console.log("=== auth.config ===");
      console.log(configRes.rows);
    } catch(e) {
      console.log("Could not query auth.config directly:", e.message);
    }

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
