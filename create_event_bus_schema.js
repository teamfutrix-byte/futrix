const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Memory Lab Event Bus & Orchestration Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create event_logs table
    console.log("- Creating public.event_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.event_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(100) NOT NULL,
        payload_json JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'Processed', -- 'Processed', 'Failed', 'Retrying'
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create dead_letter_queue table
    console.log("- Creating public.dead_letter_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES public.event_logs(id) ON DELETE CASCADE,
        event_name VARCHAR(100) NOT NULL,
        payload_json JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Memory Lab Event Bus & Orchestration Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
