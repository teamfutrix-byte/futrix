const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  const { rows } = await client.query("SELECT * FROM public.platform_configs WHERE key = 'email_gateway_config'");
  console.log('PLATFORM CONFIG:', rows);
  await client.end();
}

main().catch(console.error);
