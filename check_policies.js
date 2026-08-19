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

    // Query RLS policies
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('xp_transactions', 'referrals')
    `);
    console.log("=== RLS Policies on gamification/referral tables ===");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await client.end();
  }
}

main();
