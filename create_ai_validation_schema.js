const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Upload Assistant & Content Intelligence Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create ai_upload_reports table
    console.log("- Creating public.ai_upload_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_upload_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
        overall_health_score NUMERIC DEFAULT 100.0,
        total_rows INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        invalid_count INTEGER DEFAULT 0,
        grammar_issues_count INTEGER DEFAULT 0,
        uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create question_quality_scores table
    console.log("- Creating public.question_quality_scores table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_quality_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        score NUMERIC DEFAULT 100.0,
        concept_accuracy_score NUMERIC DEFAULT 100.0,
        grammar_score NUMERIC DEFAULT 100.0,
        formatting_score NUMERIC DEFAULT 100.0,
        status VARCHAR(30) DEFAULT 'Good', -- 'Excellent', 'Good', 'Needs Review', 'Rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create duplicate_analysis table
    console.log("- Creating public.duplicate_analysis table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.duplicate_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        matched_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        duplicate_pct_confidence NUMERIC DEFAULT 0.0,
        action_taken VARCHAR(30) DEFAULT 'Ignore', -- 'Merge', 'Replace', 'Ignore', 'SendForReview'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create grammar_reports table
    console.log("- Creating public.grammar_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.grammar_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        issues_count INTEGER DEFAULT 0,
        suggestions_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create validation_reports table
    console.log("- Creating public.validation_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.validation_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        is_valid BOOLEAN DEFAULT TRUE,
        warning_messages_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create content_health table
    console.log("- Creating public.content_health table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.content_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID REFERENCES public.question_uploads(id) ON DELETE CASCADE,
        average_quality_score NUMERIC DEFAULT 100.0,
        duplicate_ratio NUMERIC DEFAULT 0.0,
        completeness_ratio NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create review_queue table
    console.log("- Creating public.review_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.review_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        trigger_reason VARCHAR(255) NOT NULL,
        reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Resolved', 'Approved', 'Rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create recommendation_engine table
    console.log("- Creating public.recommendation_engine table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.recommendation_engine (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        recommendation_type VARCHAR(50) DEFAULT 'General',
        recommended_action TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise AI Upload Assistant & Content Intelligence Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
