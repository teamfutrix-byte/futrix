const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Classification Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create ai_classifications table
    console.log("- Creating public.ai_classifications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        subject VARCHAR(100),
        chapter VARCHAR(100),
        topic VARCHAR(100),
        sub_topic VARCHAR(100),
        concept_name TEXT,
        question_type VARCHAR(50),
        difficulty VARCHAR(20),
        language VARCHAR(30),
        bloom_taxonomy VARCHAR(50), -- 'Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'
        confidence_pct NUMERIC DEFAULT 100.0,
        reasoning TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create classification_confidence table
    console.log("- Creating public.classification_confidence table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.classification_confidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        confidence_score NUMERIC DEFAULT 100.0,
        trigger_review_flag BOOLEAN DEFAULT FALSE,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Modified'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create learning_objectives table
    console.log("- Creating public.learning_objectives table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.learning_objectives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        bloom_level VARCHAR(50) NOT NULL,
        objective_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create concept_mapping table
    console.log("- Creating public.concept_mapping table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.concept_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        primary_concept VARCHAR(200) NOT NULL,
        secondary_concept VARCHAR(200),
        related_formulas_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create knowledge_graph_links table
    console.log("- Creating public.knowledge_graph_links table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.knowledge_graph_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_node VARCHAR(200) NOT NULL,
        target_node VARCHAR(200) NOT NULL,
        link_type VARCHAR(50) NOT NULL, -- 'Prerequisite', 'Similarity', 'Derivation'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create classification_history table
    console.log("- Creating public.classification_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.classification_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        previous_classification_json JSONB DEFAULT '{}'::jsonb,
        new_classification_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create classification_feedback table
    console.log("- Creating public.classification_feedback table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.classification_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        feedback_text TEXT,
        accuracy_score NUMERIC DEFAULT 100.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create classification_models table
    console.log("- Creating public.classification_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.classification_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active_flag BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise AI Classification Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
