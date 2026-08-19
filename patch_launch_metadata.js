const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Futrix Launch metadata DB patch...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Create public.ai_token_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_token_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        operation VARCHAR NOT NULL,
        model_name VARCHAR NOT NULL,
        input_tokens INT DEFAULT 0,
        output_tokens INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'ai_token_logs' verified/created.");

    // 2. Create public.session_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.session_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        login_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'session_logs' verified/created.");

    // 3. Ensure test_series has a price column
    await client.query(`
      ALTER TABLE public.test_series 
      ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0.00
    `).catch(e => console.log('price column might already exist:', e.message));

    // 4. Update the default XP rules
    await client.query(`
      INSERT INTO public.xp_rules (id, name, description, xp_amount, multiplier, active)
      VALUES 
        ('test_submitted', 'Test Submission', 'Earned when submitting a mock test', 50, 1.0, TRUE),
        ('flashcard_reviewed', 'Flashcard Review', 'Earned when reviewing a card in Memory Lab', 5, 1.0, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        xp_amount = EXCLUDED.xp_amount,
        active = TRUE
    `);
    console.log("- Platform XP rules verified.");

    await client.query('COMMIT');
    console.log("[✓] DB Launch Patch completed successfully.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
