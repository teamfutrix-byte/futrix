const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  const { rows } = await client.query("SELECT id, email, role, full_name FROM public.profiles WHERE role IN ('admin', 'superadmin') OR LOWER(email) LIKE '%admin%'");
  console.log('ADMINS & SUPERADMINS IN DATABASE:', rows);
  await client.end();
}

main().catch(console.error);
