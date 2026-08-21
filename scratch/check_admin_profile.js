const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  const { rows } = await client.query("SELECT id, email, role, full_name FROM public.profiles WHERE LOWER(email) = 'ms71766@gmail.com'");
  console.log('ADMIN PROFILE:', rows);
  await client.end();
}

main().catch(console.error);
