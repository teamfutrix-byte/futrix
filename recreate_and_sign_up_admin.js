const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

async function main() {
  const pgClient = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  const email = 'teamfutrix-bytes-project@futrix.internal';
  const password = 'FutrixAdmin#2026';

  try {
    await pgClient.connect();
    console.log("Connected to PostgreSQL.");

    // Delete existing admin user to free up email
    console.log("Deleting existing admin user records...");
    await pgClient.query('DELETE FROM auth.users WHERE email = $1', [email]);
    await pgClient.query('DELETE FROM public.profiles WHERE email = $1', [email]);
    console.log("Deleted existing user records successfully.");

    // Register user via Supabase Auth client
    console.log("Signing up user via Supabase Auth API...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: 'Super Admin',
          phone: '9999999999'
        }
      }
    });

    if (signUpError) {
      throw signUpError;
    }

    const userId = signUpData.user.id;
    console.log(`[✓] Supabase signUp succeeded. User ID: ${userId}`);

    // Confirm email in auth.users
    console.log("Confirming email in auth.users...");
    await pgClient.query("UPDATE auth.users SET email_confirmed_at = now(), confirmed_at = now() WHERE id = $1", [userId]);

    // Insert profile role to admin in PostgreSQL
    console.log("Inserting public.profiles record with role='admin'...");
    const profileRes = await pgClient.query(`
      INSERT INTO public.profiles (id, full_name, email, phone, role, xp_balance, preparation_for)
      VALUES ($1, 'Super Admin', $2, '9999999999', 'admin', 500.00, 'NEET')
      ON CONFLICT (id) DO UPDATE 
      SET role = 'admin', full_name = 'Super Admin', phone = '9999999999', xp_balance = 500.00
      RETURNING *
    `, [userId, email]);

    console.log("[✓] Updated profile:", profileRes.rows[0]);
    console.log("\nSUPER ADMIN RE-CREATION AND PROMOTION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("Error recreating admin:", err);
  } finally {
    await pgClient.end();
  }
}

main();
