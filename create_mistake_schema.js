const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Mistake Intelligence Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // Alter public.wrong_questions schema
    console.log("- Adjusting public.wrong_questions schema...");
    await client.query(`
      ALTER TABLE public.wrong_questions 
      ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS student_answer TEXT,
      ADD COLUMN IF NOT EXISTS time_taken_sec INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'Neutral',
      ADD COLUMN IF NOT EXISTS mistake_type VARCHAR(50) DEFAULT 'Conceptual Error',
      ADD COLUMN IF NOT EXISTS revision_status VARCHAR(50) DEFAULT 'Active',
      ADD COLUMN IF NOT EXISTS retention_score INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS subject VARCHAR(50),
      ADD COLUMN IF NOT EXISTS chapter VARCHAR(100),
      ADD COLUMN IF NOT EXISTS topic VARCHAR(100);
    `);

    // 1. Create mistake_analysis table
    console.log("- Creating public.mistake_analysis table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.mistake_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wrong_question_id UUID REFERENCES public.wrong_questions(id) ON DELETE CASCADE,
        root_cause VARCHAR(100) NOT NULL,
        ai_explanation TEXT,
        knowledge_gap TEXT,
        correct_approach TEXT,
        exam_strategy TEXT,
        prevention_tips TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create mistake_clusters table
    console.log("- Creating public.mistake_clusters table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.mistake_clusters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        cluster_name VARCHAR(100) NOT NULL,
        subject VARCHAR(50),
        tag VARCHAR(50),
        card_ids_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create weak_concepts table
    console.log("- Creating public.weak_concepts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.weak_concepts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        chapter VARCHAR(100) NOT NULL,
        topic VARCHAR(100) NOT NULL,
        mistake_count INTEGER DEFAULT 1,
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create error_patterns table
    console.log("- Creating public.error_patterns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.error_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        pattern_type VARCHAR(100) NOT NULL,
        repeated_count INTEGER DEFAULT 1,
        trigger_alert BOOLEAN DEFAULT FALSE,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create concept_recovery table
    console.log("- Creating public.concept_recovery table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.concept_recovery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        topic VARCHAR(100) NOT NULL,
        recovery_rate_pct NUMERIC DEFAULT 0.0,
        last_tested_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create wrong_question_tags table
    console.log("- Creating public.wrong_question_tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.wrong_question_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wrong_question_id UUID REFERENCES public.wrong_questions(id) ON DELETE CASCADE,
        tag_name VARCHAR(50) NOT NULL
      );
    `);

    // 7. Create wrong_question_analytics table
    console.log("- Creating public.wrong_question_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.wrong_question_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        total_mistakes INTEGER DEFAULT 0,
        total_corrected INTEGER DEFAULT 0,
        repeated_mistakes_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create mistake_ai_logs table
    console.log("- Creating public.mistake_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.mistake_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        details_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create future_mistake_models table
    console.log("- Creating public.future_mistake_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_mistake_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Mistake Intelligence Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
