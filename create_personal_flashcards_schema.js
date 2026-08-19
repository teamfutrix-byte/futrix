const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("=== RUNNING PERSONAL FLASHCARDS DATABASE MIGRATION ===");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create memory_folders table
    console.log("- Creating public.memory_folders table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        parent_folder_id UUID REFERENCES public.memory_folders(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create personal_memory_cards table
    console.log("- Creating public.personal_memory_cards table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.personal_memory_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        folder_id UUID REFERENCES public.memory_folders(id) ON DELETE SET NULL,
        card_type VARCHAR(50) DEFAULT 'Basic', -- 'Basic', 'FillInBlank', 'Image', 'Diagram', 'Equation'
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        subject VARCHAR(50),
        chapter VARCHAR(100),
        topic VARCHAR(100),
        difficulty VARCHAR(20) DEFAULT 'medium',
        hint TEXT,
        tags TEXT[] DEFAULT '{}'::TEXT[],
        color_label VARCHAR(30) DEFAULT '#4d8eff',
        priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
        explanation TEXT,
        memory_trick TEXT,
        mnemonic TEXT,
        reference_info TEXT,
        image_url TEXT,
        video_link TEXT,
        notes TEXT,
        is_pinned BOOLEAN DEFAULT false,
        is_favorite BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        is_locked BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create memory_card_versions table
    console.log("- Creating public.memory_card_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_card_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES public.personal_memory_cards(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        question TEXT,
        answer TEXT,
        explanation TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create memory_collections table
    console.log("- Creating public.memory_collections table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        card_ids_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create memory_tags table
    console.log("- Creating public.memory_tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES public.personal_memory_cards(id) ON DELETE CASCADE,
        tag_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create memory_reviews table
    console.log("- Creating public.memory_reviews table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        card_id UUID REFERENCES public.personal_memory_cards(id) ON DELETE CASCADE,
        rating VARCHAR(20) CHECK (rating IN ('easy', 'medium', 'hard')),
        reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create memory_statistics table
    console.log("- Creating public.memory_statistics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_statistics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        cards_created INTEGER DEFAULT 0,
        cards_reviewed INTEGER DEFAULT 0,
        cards_mastered INTEGER DEFAULT 0,
        cards_forgotten INTEGER DEFAULT 0,
        retention_rate NUMERIC DEFAULT 100.0,
        avg_review_time NUMERIC DEFAULT 0.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create memory_import_history table
    console.log("- Creating public.memory_import_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_import_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        filename VARCHAR(255),
        format VARCHAR(50),
        count_imported INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create memory_export_history table
    console.log("- Creating public.memory_export_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_export_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        format VARCHAR(50),
        count_exported INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create memory_ai_logs table
    console.log("- Creating public.memory_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        action_type VARCHAR(50),
        prompt TEXT,
        response TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 11. Alter public.revision_queue table to support personal_card_id
    console.log("- Adjusting public.revision_queue schema...");
    await client.query(`
      ALTER TABLE public.revision_queue
      ADD COLUMN IF NOT EXISTS personal_card_id UUID REFERENCES public.personal_memory_cards(id) ON DELETE CASCADE;
    `);

    console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
