const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Question Metadata & Classification Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create question_taxonomy table
    console.log("- Creating public.question_taxonomy table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.question_taxonomy (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID REFERENCES public.question_taxonomy(id) ON DELETE CASCADE,
        node_name VARCHAR(100) NOT NULL,
        node_type VARCHAR(50) NOT NULL, -- 'Exam', 'Subject', 'Unit', 'Chapter', 'Topic', 'Sub Topic', 'Concept', 'Objective'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create tag_relationships table
    console.log("- Creating public.tag_relationships table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tag_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tag_id UUID REFERENCES public.question_tags(id) ON DELETE CASCADE,
        related_tag_id UUID REFERENCES public.question_tags(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) DEFAULT 'Synonym',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create semantic_vectors table
    console.log("- Creating public.semantic_vectors table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.semantic_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        vector_json JSONB DEFAULT '[]'::jsonb,
        model_name VARCHAR(100) DEFAULT 'gemini-embedding-001',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create knowledge_relationships table
    console.log("- Creating public.knowledge_relationships table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.knowledge_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        related_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) NOT NULL, -- 'Prerequisite', 'Similarity', 'AlternativeMethod', 'WrongNotebookLink'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create search_history table
    console.log("- Creating public.search_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.search_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        query_string TEXT NOT NULL,
        filters_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create search_analytics table
    console.log("- Creating public.search_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.search_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        search_term VARCHAR(100) UNIQUE NOT NULL,
        hit_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_searched_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Question Metadata & Classification Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
