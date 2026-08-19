const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Test Generation Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create paper_generation table
    console.log("- Creating public.paper_generation table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_generation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        criteria_json JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'Draft', -- 'Draft', 'Completed', 'Failed'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create paper_selection table
    console.log("- Creating public.paper_selection table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_selection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL,
        selected_questions_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create paper_validation table
    console.log("- Creating public.paper_validation table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_validation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL,
        is_valid BOOLEAN DEFAULT TRUE,
        validation_errors_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create paper_quality table
    console.log("- Creating public.paper_quality table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_quality (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL,
        overall_health_score NUMERIC DEFAULT 100.0,
        details_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create paper_blueprint table
    console.log("- Creating public.paper_blueprint table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_blueprint (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL,
        blueprint_id UUID,
        compliance_pct NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create paper_versions table
    console.log("- Creating public.paper_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.paper_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL,
        version_number INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create question_rotation table
    console.log("- Creating public.question_rotation table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_rotation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        last_used_at TIMESTAMP WITH TIME ZONE,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create psychometric_metrics table
    console.log("- Creating public.psychometric_metrics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.psychometric_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        difficulty_index NUMERIC DEFAULT 0.5,
        discrimination_index NUMERIC DEFAULT 0.3,
        guess_probability NUMERIC DEFAULT 0.25,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create test_health table
    console.log("- Creating public.test_health table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        overall_health_score NUMERIC DEFAULT 100.0,
        parameters_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create future_adaptive_tests table
    console.log("- Creating public.future_adaptive_tests table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_adaptive_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        weakness_profile_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise AI Test Generation Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
