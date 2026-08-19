const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to database. Executing QA Validation tables creation...");

    // 1. Question Versions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        series_id TEXT NOT NULL REFERENCES public.test_series(series_id),
        question_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer CHARACTER(1) NOT NULL,
        marks NUMERIC NOT NULL DEFAULT 4.00,
        negative_marks NUMERIC NOT NULL DEFAULT -1.00,
        topic TEXT NOT NULL,
        ai_metadata JSONB NOT NULL,
        revision_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        UNIQUE (question_id, version)
      );
    `);
    console.log("[✓] Created table: public.question_versions");

    // 2. Validation Results
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.validation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        quality_score NUMERIC NOT NULL,
        results_json JSONB NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("[✓] Created table: public.validation_results");

    // 3. Approval Workflow
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.approval_workflow (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        version INTEGER NOT NULL,
        reviewer_id UUID REFERENCES auth.users(id),
        comments TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (question_id, version)
      );
    `);
    console.log("[✓] Created table: public.approval_workflow");

    // 4. Validation Rules
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.validation_rules (
        rule_id TEXT PRIMARY KEY,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("[✓] Created table: public.validation_rules");

    // Seed default rules
    await client.query(`
      INSERT INTO public.validation_rules (rule_id, rule_name, rule_type, description) VALUES
      ('curriculum', 'Curriculum Syllabus Validator', 'mandatory', 'Cross-checks exam, subject, chapter alignment'),
      ('latex', 'LaTeX Formatting Validator', 'mandatory', 'Verifies MathJax/LaTeX balanced brackets'),
      ('options', 'Option Symmetry Validator', 'mandatory', 'Validates unique answers and option layout balance'),
      ('duplicates', 'Jaccard Duplicate Validator', 'mandatory', 'Ensures question stem Jaccard similarity < 85%'),
      ('calculation', 'Numerical Solver Validator', 'mandatory', 'Step-solves math calculations via LLM double pass'),
      ('safety', 'Safety & Bias Policy Filter', 'mandatory', 'Blocks political, sensitive, or offensive inputs')
      ON CONFLICT (rule_id) DO NOTHING;
    `);
    console.log("[✓] Seeded default rules in public.validation_rules");

    // 5. Validation Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.validation_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        action TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("[✓] Created table: public.validation_audit_logs");

    console.log("[✓] All QA Validation tables completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
