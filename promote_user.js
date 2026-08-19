const { Client } = require('pg');

async function promote() {
  let email = process.argv[2];
  const role = process.argv[3];

  if (!email || !role) {
    console.log("\nFUTRIX Staff Promotion Utility");
    console.log("===============================");
    console.log("Usage: node promote_user.js <email> <role>");
    console.log("Example: node promote_user.js admin@futrix.com admin");
    console.log("Example: node promote_user.js teacher@futrix.com teacher\n");
    process.exit(1);
  }

  email = email.trim();
  if (email === "teamfutrix-byte's Project") {
    email = "teamfutrix-bytes-project@futrix.internal";
  }

  const targetRole = role.toLowerCase().trim();
  if (!['student', 'teacher', 'admin'].includes(targetRole)) {
    console.error("Error: Role must be 'student', 'teacher', or 'admin'.");
    process.exit(1);
  }

  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log(`Connected to database. Querying profile for: ${email}...`);

    // Verify if profile exists
    const check = await client.query('SELECT id, full_name, role FROM public.profiles WHERE email = $1', [email]);
    if (check.rows.length === 0) {
      console.error(`Error: No user found with email '${email}'. Please make sure they have registered on the website first.`);
      process.exit(1);
    }

    const user = check.rows[0];
    console.log(`Found profile: ${user.full_name} (Current Role: ${user.role})`);

    // Enforce single Super Admin constraint
    if (targetRole === 'admin') {
      const adminCheck = await client.query("SELECT email FROM public.profiles WHERE role = 'admin' AND id != $1", [user.id]);
      if (adminCheck.rows.length > 0) {
        console.error(`\nError: A Super Admin account already exists (${adminCheck.rows[0].email}). Only ONE Super Admin account is allowed on the FUTRIX platform!\n`);
        process.exit(1);
      }
    }

    // Update role
    await client.query('UPDATE public.profiles SET role = $1 WHERE id = $2', [targetRole, user.id]);
    
    // Log audit event
    await client.query(`
      INSERT INTO public.audit_logs (user_id, action, details, ip_address) 
      VALUES ($1, $2, $3, $4)
    `, [user.id, 'RolePromotion', JSON.stringify({ email, newRole: targetRole, oldRole: user.role }), 'server-script']);

    console.log(`\nSuccess: ${email} has been successfully promoted to '${targetRole}'!`);
    console.log(`They can now sign in at admin-login.html to access their staff dashboard.\n`);

  } catch (err) {
    console.error("Database error:", err.message);
  } finally {
    await client.end();
  }
}

promote();
