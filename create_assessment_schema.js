const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Assessment Intelligence Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Alter public.questions to support lifecycle, categorization, and metadata
    console.log("- Adjusting public.questions columns...");
    await client.query(`
      ALTER TABLE public.questions 
      ADD COLUMN IF NOT EXISTS subject VARCHAR(100) DEFAULT 'Biology',
      ADD COLUMN IF NOT EXISTS chapter VARCHAR(100) DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS sub_topic VARCHAR(100) DEFAULT 'General Topic',
      ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'Medium',
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Draft', -- 'Draft', 'Pending AI Review', 'Approved', 'Published', 'Archived'
      ADD COLUMN IF NOT EXISTS explanation TEXT,
      ADD COLUMN IF NOT EXISTS hint TEXT,
      ADD COLUMN IF NOT EXISTS estimated_time INTEGER DEFAULT 60,
      ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC DEFAULT 100.0,
      ADD COLUMN IF NOT EXISTS ai_quality_score NUMERIC DEFAULT 100.0,
      ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
    `);

    // 2. Create question_metadata table
    console.log("- Creating public.question_metadata table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_metadata (
        question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
        correct_pct NUMERIC DEFAULT 0.0,
        wrong_pct NUMERIC DEFAULT 0.0,
        skip_pct NUMERIC DEFAULT 0.0,
        average_time_sec INTEGER DEFAULT 0,
        difficulty_index NUMERIC DEFAULT 0.5,
        discrimination_index NUMERIC DEFAULT 0.3,
        last_used_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create question_categories table
    console.log("- Creating public.question_categories table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID REFERENCES public.question_categories(id) ON DELETE CASCADE,
        category_name VARCHAR(100) UNIQUE NOT NULL,
        level INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default categories
    await client.query(`
      INSERT INTO public.question_categories (category_name, level)
      VALUES 
        ('NEET Physics', 1),
        ('NEET Chemistry', 1),
        ('NEET Biology', 1)
      ON CONFLICT (category_name) DO NOTHING;
    `);

    // 4. Create question_tags table
    console.log("- Creating public.question_tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        tag_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE(question_id, tag_name)
      );
    `);

    // 5. Create question_versions table
    console.log("- Creating public.question_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        previous_question_text TEXT,
        updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create question_history table
    console.log("- Creating public.question_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL, -- 'Created', 'Updated', 'Published', 'Archived'
        state_from VARCHAR(30),
        state_to VARCHAR(30),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create question_uploads table
    console.log("- Creating public.question_uploads table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploader_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        file_name VARCHAR(200) NOT NULL,
        questions_added INTEGER DEFAULT 0,
        questions_updated INTEGER DEFAULT 0,
        duplicates_count INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Processed', 'Failed'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create question_audit table
    console.log("- Creating public.question_audit table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        details_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create future_question_models table
    console.log("- Creating public.future_question_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_question_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Assessment Intelligence Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
