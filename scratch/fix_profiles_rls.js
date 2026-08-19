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

    console.log("Updating profiles insert policy...");
    await client.query(`
      DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
      DROP POLICY IF EXISTS "Allow anyone to insert their profile" ON public.profiles;
      CREATE POLICY "Allow anyone to insert their profile" 
      ON public.profiles FOR INSERT TO public WITH CHECK (true);
    `);

    console.log("Updating xp_transactions insert policy...");
    await client.query(`
      DROP POLICY IF EXISTS "Allow public insert to xp_transactions" ON public.xp_transactions;
      CREATE POLICY "Allow public insert to xp_transactions" 
      ON public.xp_transactions FOR INSERT TO public WITH CHECK (true);
    `);

    console.log("Updating referrals insert policy...");
    await client.query(`
      DROP POLICY IF EXISTS "Allow public insert to referrals" ON public.referrals;
      CREATE POLICY "Allow public insert to referrals" 
      ON public.referrals FOR INSERT TO public WITH CHECK (true);
    `);

    console.log("[✓] All database RLS policies updated successfully.");

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

main();
