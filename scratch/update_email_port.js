const { getDbClient } = require('../config/db');

async function main() {
  const db = getDbClient();
  await db.connect();
  
  const { rows } = await db.query("SELECT value FROM public.platform_configs WHERE key = 'email_gateway_config'");
  if (rows.length > 0) {
    const config = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    config.smtp_port = 587; // Change port to 587
    
    await db.query("UPDATE public.platform_configs SET value = $1 WHERE key = 'email_gateway_config'", [JSON.stringify(config)]);
    console.log('Successfully updated email gateway config port to 587 in database!');
  } else {
    console.log('No config found to update.');
  }
  
  await db.end();
}

main().catch(console.error);
