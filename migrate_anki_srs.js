const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("=== RUNNING ANKI SRS DATABASE MIGRATION ===");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Add SRS columns to public.revision_queue
    console.log("- Adding card_state, ease_factor, step_index to public.revision_queue...");
    await client.query(`
      ALTER TABLE public.revision_queue
      ADD COLUMN IF NOT EXISTS card_state VARCHAR(20) DEFAULT 'new',
      ADD COLUMN IF NOT EXISTS ease_factor INTEGER DEFAULT 2500,
      ADD COLUMN IF NOT EXISTS step_index INTEGER DEFAULT 0;
    `);
    
    // Add check constraint if it doesn't exist
    const { rows: checkExists } = await client.query(`
      SELECT conname FROM pg_constraint 
      WHERE conname = 'chk_revision_queue_card_state'
    `);
    if (checkExists.length === 0) {
      console.log("- Adding CHECK constraint for card_state...");
      await client.query(`
        ALTER TABLE public.revision_queue
        ADD CONSTRAINT chk_revision_queue_card_state 
        CHECK (card_state IN ('new', 'learning', 'review', 'relearning'));
      `);
    }

    // 2. Add memory_lab_config row in public.platform_configs
    console.log("- Inserting default memory_lab_config preset in public.platform_configs...");
    await client.query(`
      INSERT INTO public.platform_configs (category, key, value, version, status)
      VALUES (
        'Revision', 
        'memory_lab_config', 
        '{"learning_steps": "1m, 10m", "relearning_steps": "10m", "graduating_interval": 1, "easy_interval": 4, "starting_ease": 250, "easy_bonus": 130, "interval_modifier": 100, "leech_threshold": 8, "bgm_enabled": true}'::jsonb, 
        1, 
        'Approved'
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
