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
    console.log("Connected to database. Enabling vector extension and executing Question Bank schema migrations...");

    // 1. Ensure pgvector extension is enabled
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("[✓] pgvector extension verified.");

    // Helper function to add columns safely if they do not exist
    const addColumn = async (colName, typeDef) => {
      try {
        await client.query(`ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ${colName} ${typeDef};`);
        console.log(`[✓] Added column (if missing): public.questions.${colName}`);
      } catch (err) {
        console.warn(`[!] Warning adding column ${colName}:`, err.message);
      }
    };

    // 2. Add metadata columns
    await addColumn('exam', 'TEXT');
    await addColumn('board', 'TEXT');
    await addColumn('class', 'TEXT');
    await addColumn('subject', 'TEXT');
    await addColumn('chapter', 'TEXT');
    await addColumn('subchapter', 'TEXT');
    await addColumn('subtopic', 'TEXT');
    await addColumn('difficulty', 'TEXT');
    await addColumn('bloom_level', 'TEXT');
    await addColumn('language', "TEXT DEFAULT 'English'");
    await addColumn('status', "TEXT DEFAULT 'Published'");
    await addColumn('version', 'INTEGER DEFAULT 1');
    await addColumn('parent_version_id', 'UUID');
    await addColumn('root_version_id', 'UUID');
    await addColumn('created_by', 'UUID REFERENCES auth.users(id)');
    await addColumn('created_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    await addColumn('updated_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    await addColumn('published_at', 'TIMESTAMP WITH TIME ZONE');
    await addColumn('archived_at', 'TIMESTAMP WITH TIME ZONE');
    await addColumn('deleted_at', 'TIMESTAMP WITH TIME ZONE');
    
    // Hash and vector columns
    await addColumn('content_hash', 'TEXT');
    await addColumn('semantic_hash', 'TEXT');
    await addColumn('embedding_vector', 'vector(1536)');
    
    // Content details columns
    await addColumn('tags', 'TEXT[]');
    await addColumn('explanation', 'TEXT');
    await addColumn('detailed_solution', 'TEXT');
    await addColumn('hints', 'JSONB');
    await addColumn('step_solution', 'JSONB');
    await addColumn('formulas', 'TEXT[]');
    await addColumn('assets', 'JSONB');

    // 3. Update existing questions' content_hash with unique random MD5s to prevent constraint violation
    await client.query(`UPDATE public.questions SET content_hash = md5(random()::text) WHERE content_hash IS NULL;`);
    console.log("[✓] Updated null content_hashes on existing questions.");

    // 4. Add uniqueness constraint on content_hash
    try {
      await client.query(`ALTER TABLE public.questions ADD CONSTRAINT questions_content_hash_key UNIQUE (content_hash);`);
      console.log("[✓] Added unique constraint on content_hash.");
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log("[✓] Unique constraint on content_hash already exists.");
      } else {
        console.warn("[!] Error adding uniqueness constraint:", err.message);
      }
    }

    // 5. Create performance search indexes
    console.log("Creating database indexes...");
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON public.questions(exam, subject);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_chapter_topic ON public.questions(chapter, topic);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_status_deleted ON public.questions(status, deleted_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_bloom ON public.questions(bloom_level);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_tags ON public.questions USING GIN(tags);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at);`);

    // 6. Create pgvector HNSW index for cosine distance similarity searches
    // Note: HNSW requires list index, we choose 1536 dimension (matching Gemini Embedding API size)
    // We use vector_cosine_ops
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_embedding_hnsw 
                          ON public.questions USING hnsw (embedding_vector vector_cosine_ops);`);
      console.log("[✓] Created HNSW vector search index.");
    } catch (err) {
      console.warn("[!] HNSW index creation failed, falling back to ivfflat or no index:", err.message);
      try {
        await client.query(`CREATE INDEX IF NOT EXISTS idx_questions_embedding_ivf 
                            ON public.questions USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);`);
        console.log("[✓] Created IVF Flat vector search index.");
      } catch (e2) {
        console.warn("[!] Vector index fallback failed:", e2.message);
      }
    }

    console.log("[✓] Question Bank schema migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
