const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  const targetVersions = ['20260115000000', '20260121000000', '20260219120000', '20260302000000'];

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    console.log("Deleting 2026 migrations from auth.schema_migrations...");
    const res = await client.query(`
      DELETE FROM auth.schema_migrations 
      WHERE version = ANY($1) 
      RETURNING version
    `, [targetVersions]);
    
    console.log("Deleted versions:", res.rows.map(r => r.version));

    console.log("Testing client SDK login...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'teamfutrix-bytes-project@futrix.internal',
      password: 'FutrixAdmin#2026'
    });

    if (error) {
      console.error("[✗] Sign-in failed after deleting migrations:", error.message);
      
      // Restore the deleted versions
      console.log("Restoring deleted migrations...");
      for (const v of targetVersions) {
        await client.query('INSERT INTO auth.schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [v]);
      }
      console.log("Restored successfully.");
    } else {
      console.log("[✓] Sign-in SUCCESSFUL after removing 2026 migrations!");
      console.log("User Email:", data.user.email);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
