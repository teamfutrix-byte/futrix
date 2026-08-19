const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Curriculum Intelligence Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create curriculum_analysis table
    console.log("- Creating public.curriculum_analysis table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.curriculum_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject VARCHAR(100) NOT NULL,
        total_chapters INTEGER DEFAULT 0,
        covered_chapters INTEGER DEFAULT 0,
        coverage_pct NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create blueprint_templates table
    console.log("- Creating public.blueprint_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.blueprint_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        target_exam VARCHAR(30) DEFAULT 'NEET', -- 'NEET', 'JEE Main'
        weightage_distribution_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create blueprint_reports table
    console.log("- Creating public.blueprint_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.blueprint_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES public.blueprint_templates(id) ON DELETE CASCADE,
        gap_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create exam_patterns table
    console.log("- Creating public.exam_patterns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.exam_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        exam_type VARCHAR(30) DEFAULT 'NEET',
        subject_ratios_json JSONB DEFAULT '{}'::jsonb,
        difficulty_ratios_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create content_gaps table
    console.log("- Creating public.content_gaps table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.content_gaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject VARCHAR(100) NOT NULL,
        chapter VARCHAR(100),
        topic VARCHAR(100),
        gap_description TEXT NOT NULL,
        priority_level VARCHAR(20) DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create audit_reports table
    console.log("- Creating public.audit_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        total_questions_scanned INTEGER DEFAULT 0,
        total_duplicates_found INTEGER DEFAULT 0,
        total_grammar_issues INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create chapter_intelligence table
    console.log("- Creating public.chapter_intelligence table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.chapter_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_name VARCHAR(150) NOT NULL,
        total_questions INTEGER DEFAULT 0,
        difficulty_distribution_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create topic_intelligence table
    console.log("- Creating public.topic_intelligence table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.topic_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_name VARCHAR(150) NOT NULL,
        question_count INTEGER DEFAULT 0,
        missing_concepts_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create future_exam_predictions table
    console.log("- Creating public.future_exam_predictions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_exam_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_year INTEGER DEFAULT 2026,
        target_exam VARCHAR(30) DEFAULT 'NEET',
        predicted_topics_json JSONB DEFAULT '[]'::jsonb,
        confidence_pct NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create curriculum_analytics table
    console.log("- Creating public.curriculum_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.curriculum_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trend_month VARCHAR(20) NOT NULL,
        growth_pct NUMERIC DEFAULT 0.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Curriculum Intelligence Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
