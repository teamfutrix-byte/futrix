const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Smart Revision Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create revision_sessions table
    console.log("- Creating public.revision_sessions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
        end_time TIMESTAMP WITH TIME ZONE,
        total_items_reviewed INTEGER DEFAULT 0,
        session_rating VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create revision_history table
    console.log("- Creating public.revision_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        concept_id UUID,
        concept_title TEXT,
        duration_sec INTEGER DEFAULT 0,
        completion_rate NUMERIC DEFAULT 100.0,
        performance_score INTEGER DEFAULT 0,
        confidence_level VARCHAR(50),
        retention_rate NUMERIC DEFAULT 100.0,
        next_revision_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create revision_priorities table
    console.log("- Creating public.revision_priorities table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_priorities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        queue_id UUID REFERENCES public.revision_queue(id) ON DELETE CASCADE,
        priority_level VARCHAR(20) CHECK (priority_level IN ('Critical', 'High', 'Medium', 'Low')),
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create adaptive_models table
    console.log("- Creating public.adaptive_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.adaptive_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        learning_speed NUMERIC DEFAULT 1.0,
        accuracy_trend NUMERIC DEFAULT 1.0,
        study_frequency NUMERIC DEFAULT 1.0,
        retention_curve_decay NUMERIC DEFAULT 0.05,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create study_schedule table
    console.log("- Creating public.study_schedule table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.study_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        daily_plan_json JSONB DEFAULT '{}'::jsonb,
        weekly_plan_json JSONB DEFAULT '{}'::jsonb,
        monthly_plan_json JSONB DEFAULT '{}'::jsonb,
        countdown_days INTEGER DEFAULT 365,
        scheduled_for DATE DEFAULT current_date,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create revision_analytics table
    console.log("- Creating public.revision_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        total_completed INTEGER DEFAULT 0,
        average_revision_time_sec INTEGER DEFAULT 0,
        missed_revisions INTEGER DEFAULT 0,
        retention_trend NUMERIC DEFAULT 100.0,
        mastery_percent NUMERIC DEFAULT 0.0,
        consistency_score INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create revision_preferences table
    console.log("- Creating public.revision_preferences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        revision_mode VARCHAR(50) DEFAULT 'Standard',
        preferred_study_times_json JSONB DEFAULT '[]'::jsonb,
        daily_duration_goal_min INTEGER DEFAULT 30,
        sound_enabled BOOLEAN DEFAULT FALSE,
        motion_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create future_revision_models table
    console.log("- Creating public.future_revision_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_revision_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        model_config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Smart Revision Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
