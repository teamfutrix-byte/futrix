const { getDbClient } = require('../config/db');

async function main() {
  const client = getDbClient();
  await client.connect();
  const { rows } = await client.query("SELECT id, email, encrypted_password FROM auth.users WHERE LOWER(email) = '$uperadmin@futrix.com'");
  console.log('AUTH USER FOR $uperadmin@futrix.com:', rows);
  await client.end();
}

main().catch(console.error);
