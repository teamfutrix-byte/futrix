const { getDbClient } = require('../config/db');

async function main() {
  const db = getDbClient();
  await db.connect();
  const { rows } = await db.query("SELECT key, value FROM public.platform_configs");
  console.log('ALL CONFIGS:');
  rows.forEach(r => {
    console.log(`Key: ${r.key}`);
    console.log(`Value: ${JSON.stringify(r.value, null, 2)}`);
    console.log('-------------------');
  });
  await db.end();
}

main().catch(console.error);
