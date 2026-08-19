const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Question Import Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create import_jobs table
    console.log("- Creating public.import_jobs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        file_name VARCHAR(200) NOT NULL,
        status VARCHAR(30) DEFAULT 'Queued', -- 'Queued', 'Processing', 'Completed', 'Failed', 'Cancelled'
        total_rows INTEGER DEFAULT 0,
        imported_rows INTEGER DEFAULT 0,
        rejected_rows INTEGER DEFAULT 0,
        duplicates_count INTEGER DEFAULT 0,
        rollback_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create import_rows table
    console.log("- Creating public.import_rows table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_rows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES public.import_jobs(id) ON DELETE CASCADE,
        raw_row_data_json JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'Valid', -- 'Valid', 'Needs Review', 'Duplicate', 'Invalid', 'Rejected', 'Imported'
        error_message TEXT,
        processed_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create import_templates table
    console.log("- Creating public.import_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(50) NOT NULL,
        columns_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default import templates
    await client.query(`
      INSERT INTO public.import_templates (template_name, category, columns_json)
      VALUES 
        ('Basic MCQ Template', 'MCQ', '["Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Subject", "Chapter", "Topic", "Difficulty"]'),
        ('NEET MCQ Template', 'NEET', '["Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Subject", "Chapter", "Topic", "Difficulty", "Explanation", "Estimated Time"]')
      ON CONFLICT (template_name) DO NOTHING;
    `);

    // 4. Create import_queue table
    console.log("- Creating public.import_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID UNIQUE REFERENCES public.import_jobs(id) ON DELETE CASCADE,
        priority VARCHAR(20) DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create import_errors table
    console.log("- Creating public.import_errors table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES public.import_jobs(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        column_name VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Question Import Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
