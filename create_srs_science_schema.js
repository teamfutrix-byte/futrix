const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Spaced Repetition Science Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create memory_strength table
    console.log("- Creating public.memory_strength table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_strength (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        strength_score INTEGER DEFAULT 100,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create retention_scores table
    console.log("- Creating public.retention_scores table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.retention_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        retention_rate_pct NUMERIC DEFAULT 100.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create forgetting_predictions table
    console.log("- Creating public.forgetting_predictions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.forgetting_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        predicted_forgetting_time TIMESTAMP WITH TIME ZONE,
        decay_rate NUMERIC DEFAULT 1.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create review_intervals table
    console.log("- Creating public.review_intervals table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.review_intervals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        calculated_interval_days INTEGER DEFAULT 1,
        difficulty_level VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create review_calendar table
    console.log("- Creating public.review_calendar table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.review_calendar (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Done'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create memory_decay table
    console.log("- Creating public.memory_decay table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_decay (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        decay_speed_index NUMERIC DEFAULT 1.0,
        alert_triggered BOOLEAN DEFAULT FALSE,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create concept_stability table
    console.log("- Creating public.concept_stability table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.concept_stability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        stability_index NUMERIC DEFAULT 1.0,
        review_count INTEGER DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create future_memory_models table
    console.log("- Creating public.future_memory_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_memory_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Spaced Repetition Science Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
