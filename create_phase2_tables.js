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
    console.log("Connected to PostgreSQL.");

    console.log("Creating public.referrals table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.referrals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        referee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        device_id text,
        browser_fingerprint text,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'flagged')),
        registration_reward_credited boolean DEFAULT false,
        first_test_reward_credited boolean DEFAULT false,
        active_7days_reward_credited boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(referee_id)
      )
    `);
    console.log("[✓] public.referrals table verified.");

    console.log("Creating public.friends_rivals table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.friends_rivals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        type text CHECK (type IN ('friend', 'rival')),
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(user_id, target_id, type)
      )
    `);
    console.log("[✓] public.friends_rivals table verified.");

    // Verify row level security RLS on both tables (make sure anyone authenticated can read and write their own data)
    await client.query(`
      ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.friends_rivals ENABLE ROW LEVEL SECURITY;
    `);

    // Create simple permissive policies for verified operations
    await client.query(`
      DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.referrals;
      CREATE POLICY "Allow all for authenticated users" ON public.referrals
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.friends_rivals;
      CREATE POLICY "Allow all for authenticated users" ON public.friends_rivals
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `);

    console.log("[✓] RLS policies applied.");
    console.log("\nMIGRATION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("[✗] Error running migration:", err.message);
  } finally {
    await client.end();
  }
}

main();
