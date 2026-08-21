const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  const { rows } = await client.query("UPDATE public.profiles SET role = 'admin' WHERE LOWER(email) = 'ms71766@gmail.com' RETURNING *");
  console.log('UPDATED PROFILE:', rows);
  await client.end();
}

main().catch(console.error);
