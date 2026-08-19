const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise AI Duplicate Detection Engine Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create duplicate_matches table
    console.log("- Creating public.duplicate_matches table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.duplicate_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        matched_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        text_similarity_pct NUMERIC DEFAULT 0.0,
        concept_similarity_pct NUMERIC DEFAULT 0.0,
        explanation_similarity_pct NUMERIC DEFAULT 0.0,
        overall_similarity_pct NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create semantic_embeddings table
    console.log("- Creating public.semantic_embeddings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.semantic_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        embedding_vector JSONB NOT NULL, -- using JSONB array for cross-platform vector compatibility
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create similarity_scores table
    console.log("- Creating public.similarity_scores table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.similarity_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        matched_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        score NUMERIC NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create duplicate_reviews table
    console.log("- Creating public.duplicate_reviews table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.duplicate_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        matched_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Merged', 'KeptBoth', 'Rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create merge_history table
    console.log("- Creating public.merge_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.merge_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merged_question_ids_json JSONB DEFAULT '[]'::jsonb,
        target_question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        merged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create content_versions table
    console.log("- Creating public.content_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.content_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL DEFAULT 1,
        parent_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
        edit_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create duplicate_analytics table
    console.log("- Creating public.duplicate_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.duplicate_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        total_duplicates_found INTEGER DEFAULT 0,
        total_merged_count INTEGER DEFAULT 0,
        overall_duplicate_ratio NUMERIC DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create embedding_cache table
    console.log("- Creating public.embedding_cache table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.embedding_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key TEXT UNIQUE NOT NULL,
        embedding_json JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    console.log("Enterprise AI Duplicate Detection Engine Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
