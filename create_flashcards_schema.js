const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Flashcards Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // Alter public.flashcards to support life cycle attributes
    console.log("- Adjusting public.flashcards schema...");
    await client.query(`
      ALTER TABLE public.flashcards 
      ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS state VARCHAR(30) DEFAULT 'Generated',
      ADD COLUMN IF NOT EXISTS hint TEXT,
      ADD COLUMN IF NOT EXISTS subject VARCHAR(50),
      ADD COLUMN IF NOT EXISTS chapter VARCHAR(100),
      ADD COLUMN IF NOT EXISTS topic VARCHAR(100),
      ADD COLUMN IF NOT EXISTS formula TEXT,
      ADD COLUMN IF NOT EXISTS diagram TEXT,
      ADD COLUMN IF NOT EXISTS mnemonic TEXT;
    `);

    // 1. Create flashcard_decks table
    console.log("- Creating public.flashcard_decks table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_decks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create flashcard_tags table
    console.log("- Creating public.flashcard_tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
        tag_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create flashcard_media table
    console.log("- Creating public.flashcard_media table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
        media_url TEXT NOT NULL,
        media_type VARCHAR(50) DEFAULT 'image',
        hotspot_labels_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create flashcard_analytics table
    console.log("- Creating public.flashcard_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        cards_reviewed INTEGER DEFAULT 0,
        cards_mastered INTEGER DEFAULT 0,
        avg_recall_time_ms INTEGER DEFAULT 0,
        retention_pct NUMERIC DEFAULT 100.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create flashcard_ai_logs table
    console.log("- Creating public.flashcard_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        source_type VARCHAR(50) DEFAULT 'notebook',
        source_text TEXT,
        generated_cards_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create flashcard_collections table
    console.log("- Creating public.flashcard_collections table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        collection_type VARCHAR(50) DEFAULT 'Custom', -- 'AI', 'Custom', 'Smart'
        card_ids_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create flashcard_preferences table
    console.log("- Creating public.flashcard_preferences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        layout_mode VARCHAR(50) DEFAULT 'Grid',
        zoom_enabled BOOLEAN DEFAULT FALSE,
        text_size VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create future_flashcard_models table
    console.log("- Creating public.future_flashcard_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_flashcard_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Flashcards Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
