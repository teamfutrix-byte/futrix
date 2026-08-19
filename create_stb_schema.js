const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Smart Test Builder (STB) Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create tests table
    console.log("- Creating public.tests table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        exam_type VARCHAR(50) DEFAULT 'NEET',
        duration_minutes INTEGER DEFAULT 180,
        max_marks INTEGER DEFAULT 720,
        status VARCHAR(30) DEFAULT 'Draft', -- 'Draft', 'Published', 'Scheduled', 'Archived'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create test_questions table
    console.log("- Creating public.test_questions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create test_templates table
    console.log("- Creating public.test_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        template_config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create test_blueprints table
    console.log("- Creating public.test_blueprints table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_blueprints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        blueprint_config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create test_validation table
    console.log("- Creating public.test_validation table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_validation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        is_valid BOOLEAN DEFAULT TRUE,
        validation_errors_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create test_generation table
    console.log("- Creating public.test_generation table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_generation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        criteria_json JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'Completed', -- 'Processing', 'Completed', 'Failed'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create test_drafts table
    console.log("- Creating public.test_drafts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        draft_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create test_versions table
    console.log("- Creating public.test_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        version_number INTEGER DEFAULT 1,
        updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        edit_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create test_history table
    console.log("- Creating public.test_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
        action_taken VARCHAR(100) NOT NULL, -- 'Generated', 'Edited', 'Published', 'Archived'
        action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Smart Test Builder (STB) Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
