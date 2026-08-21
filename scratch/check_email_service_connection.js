const { Client } = require('pg');

async function getEmailConfigFromDb() {
  const db = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
  try {
    await db.connect();
    const { rows } = await db.query("SELECT value FROM public.platform_configs WHERE key = 'email_gateway_config'");
    await db.end();
    return rows;
  } catch (err) {
    console.error('ERROR:', err);
    try { await db.end(); } catch (_) {}
  }
  return null;
}

getEmailConfigFromDb().then(console.log);
