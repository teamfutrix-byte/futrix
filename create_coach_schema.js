const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Memory Coach Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create ai_coach_sessions table
    console.log("- Creating public.ai_coach_sessions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_coach_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
        end_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create ai_coach_history table
    console.log("- Creating public.ai_coach_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_coach_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES public.ai_coach_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create learning_profiles table
    console.log("- Creating public.learning_profiles table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.learning_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        learning_speed NUMERIC DEFAULT 1.0,
        study_hours_preferred_json JSONB DEFAULT '[]'::jsonb,
        learning_style VARCHAR(50) DEFAULT 'Practice', -- 'Visual', 'Reading', 'Practice'
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create coach_recommendations table
    console.log("- Creating public.coach_recommendations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        rec_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create coach_feedback table
    console.log("- Creating public.coach_feedback table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        session_id UUID REFERENCES public.ai_coach_sessions(id) ON DELETE CASCADE,
        rating_score INTEGER CHECK (rating_score BETWEEN 1 AND 5),
        feedback_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create coach_analytics table
    console.log("- Creating public.coach_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        recommendations_followed_count INTEGER DEFAULT 0,
        motivation_index INTEGER DEFAULT 100,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create coach_context table
    console.log("- Creating public.coach_context table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_context (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        recent_errors_json JSONB DEFAULT '[]'::jsonb,
        current_goal_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create coach_ai_logs table
    console.log("- Creating public.coach_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        prompt_sent TEXT NOT NULL,
        raw_response TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        cost NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create coach_preferences table
    console.log("- Creating public.coach_preferences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coach_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        language VARCHAR(20) DEFAULT 'English',
        tone VARCHAR(50) DEFAULT 'Motivational', -- 'Strict', 'Motivational', 'Scientific'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create future_ai_models table
    console.log("- Creating public.future_ai_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_ai_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise AI Memory Coach Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
