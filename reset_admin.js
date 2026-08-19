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

  const adminEmail = 'teamfutrix-bytes-project@futrix.internal';
  const tempEmail = `temp_${Date.now()}@futrix.internal`;
  const targetPassword = 'FutrixAdmin#2026';

  try {
    await pgClient.connect();
    console.log("Connected to PostgreSQL.");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    // 1. Sign up temp user to generate bcrypt hash
    console.log(`Signing up temporary user: ${tempEmail} to harvest bcrypt hash...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: tempEmail,
      password: targetPassword
    });

    if (signUpError) throw signUpError;
    const tempId = signUpData.user.id;
    console.log(`- Temp user signed up with ID: ${tempId}`);

    // 2. Fetch the bcrypt hash from auth.users
    const { rows: hashRows } = await pgClient.query(
      "SELECT encrypted_password FROM auth.users WHERE id = $1",
      [tempId]
    );

    if (hashRows.length === 0) {
      throw new Error("Could not retrieve password hash for temp user.");
    }
    const hash = hashRows[0].encrypted_password;
    console.log(`- Retrieved Bcrypt hash: ${hash}`);

    // 3. Update the admin user's password hash in auth.users
    console.log(`Updating password hash for admin user (${adminEmail})...`);
    const updateRes = await pgClient.query(
      "UPDATE auth.users SET encrypted_password = $1, email_confirmed_at = now() WHERE email = $2 RETURNING id",
      [hash, adminEmail]
    );

    if (updateRes.rows.length === 0) {
      console.log("- Admin user record not found. We will create it.");
      // If admin user doesn't exist, we can just promote the temp user to admin!
      await pgClient.query(
        "UPDATE auth.users SET email = $1, email_confirmed_at = now() WHERE id = $2",
        [adminEmail, tempId]
      );
      await pgClient.query(`
        INSERT INTO public.profiles (id, full_name, email, phone, role, xp_balance, preparation_for)
        VALUES ($1, 'Super Admin', $2, '9999999999', 'admin', 100.0, 'NEET Prep')
        ON CONFLICT (email) DO UPDATE SET role = 'admin'
      `, [tempId, adminEmail]);
      console.log("✓ Promoted temp user to Admin.");
    } else {
      const adminId = updateRes.rows[0].id;
      console.log(`✓ Admin user password updated. ID: ${adminId}`);
      // Ensure profile role is admin
      await pgClient.query(
        "UPDATE public.profiles SET role = 'admin' WHERE id = $1",
        [adminId]
      );
      // 4. Clean up temp user from auth.users
      console.log("Cleaning up temporary user...");
      await pgClient.query("DELETE FROM auth.users WHERE id = $1", [tempId]);
      await pgClient.query("DELETE FROM public.profiles WHERE id = $1", [tempId]);
      console.log("✓ Temporary user deleted.");
    }

    console.log("\n=== ADMIN PASSWORD RESET SUCCESSFULLY COMPLETED! ===");

  } catch (err) {
    console.error("Reset failed:", err);
  } finally {
    await pgClient.end();
  }
}

main();
