const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Question Quality Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create question_quality table
    console.log("- Creating public.question_quality table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_quality (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        educational_quality_score NUMERIC DEFAULT 100.0,
        language_quality_score NUMERIC DEFAULT 100.0,
        option_quality_score NUMERIC DEFAULT 100.0,
        explanation_quality_score NUMERIC DEFAULT 100.0,
        difficulty_accuracy_score NUMERIC DEFAULT 100.0,
        overall_quality_score NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create quality_history table
    console.log("- Creating public.quality_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quality_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        previous_score NUMERIC,
        new_score NUMERIC NOT NULL,
        trigger_event VARCHAR(100) NOT NULL, -- 'Edited', 'Attempted', 'AIReview'
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create quality_metrics table
    console.log("- Creating public.quality_metrics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quality_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        correct_pct NUMERIC DEFAULT 0.0,
        wrong_pct NUMERIC DEFAULT 0.0,
        skip_pct NUMERIC DEFAULT 0.0,
        average_time_seconds NUMERIC DEFAULT 0.0,
        discrimination_index NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create quality_reviews table
    console.log("- Creating public.quality_reviews table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quality_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        priority_level VARCHAR(20) DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
        trigger_reason VARCHAR(255) NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create quality_recommendations table
    console.log("- Creating public.quality_recommendations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quality_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        recommendation_type VARCHAR(100) DEFAULT 'General',
        recommended_action TEXT NOT NULL,
        priority_score NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create question_health table
    console.log("- Creating public.question_health table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        health_score NUMERIC DEFAULT 100.0,
        completeness_ratio NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create difficulty_drift table
    console.log("- Creating public.difficulty_drift table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.difficulty_drift (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        original_difficulty VARCHAR(20) NOT NULL,
        estimated_difficulty VARCHAR(20) NOT NULL,
        live_difficulty VARCHAR(20) NOT NULL,
        drift_detected_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create content_improvements table
    console.log("- Creating public.content_improvements table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.content_improvements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        improvement_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        applied_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create quality_analytics table
    console.log("- Creating public.quality_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quality_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        average_quality_score NUMERIC DEFAULT 100.0,
        total_low_quality INTEGER DEFAULT 0,
        total_enterprise_grade INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise AI Question Quality Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
