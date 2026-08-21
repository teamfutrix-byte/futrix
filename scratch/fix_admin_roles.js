const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  
  // Update ms71766@gmail.com to student
  const r1 = await client.query("UPDATE public.profiles SET role = 'student' WHERE LOWER(email) = 'ms71766@gmail.com' RETURNING *");
  console.log('UPDATED ms71766@gmail.com:', r1.rows);
  
  // Update $uperadmin@futrix.com to superadmin
  const r2 = await client.query("UPDATE public.profiles SET role = 'superadmin' WHERE LOWER(email) = '$uperadmin@futrix.com' RETURNING *");
  console.log('UPDATED $uperadmin@futrix.com:', r2.rows);
  
  await client.end();
}

main().catch(console.error);
