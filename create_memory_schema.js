const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Memory Lab Foundation Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create memory_profiles table
    console.log("- Creating public.memory_profiles table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_profiles (
        id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        target_exam VARCHAR(50) DEFAULT 'NEET 2027',
        target_score INTEGER DEFAULT 550,
        daily_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        league_status VARCHAR(50) DEFAULT 'Bronze League',
        xp_earned INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create memory_sessions table
    console.log("- Creating public.memory_sessions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
        end_time TIMESTAMP WITH TIME ZONE,
        total_cards_reviewed INTEGER DEFAULT 0,
        session_rating VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create memory_scores table
    console.log("- Creating public.memory_scores table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create memory_health table
    console.log("- Creating public.memory_health table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        score INTEGER DEFAULT 100,
        decay_rate NUMERIC DEFAULT 1.0,
        retention_rate NUMERIC DEFAULT 100.0,
        last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create flashcards table if not exists (already exists, but safety check)
    console.log("- Creating public.flashcards table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) CHECK (category IN ('Physics', 'Chemistry', 'Biology')),
        type VARCHAR(50) CHECK (type IN ('formula', 'diagram', 'reaction', 'concept')),
        title TEXT NOT NULL,
        front_content TEXT NOT NULL,
        back_content TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create revision_queue table if not exists (spaced repetition items)
    console.log("- Creating public.revision_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        card_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
        wrong_question_id UUID,
        question_text TEXT,
        correct_answer TEXT,
        subject VARCHAR(50),
        interval_day INTEGER DEFAULT 1,
        next_revision_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 day'),
        revisions_completed INTEGER DEFAULT 0,
        retention_score INTEGER DEFAULT 100,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create flashcard_reviews table
    console.log("- Creating public.flashcard_reviews table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        card_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
        rating VARCHAR(20) CHECK (rating IN ('easy', 'medium', 'hard')),
        reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create wrong_questions table (Notebook)
    console.log("- Creating public.wrong_questions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.wrong_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        question_id UUID,
        question_text TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        times_failed INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create memory_ai_logs table
    console.log("- Creating public.memory_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        action_type VARCHAR(50),
        prompt TEXT,
        response TEXT,
        tokens_used INTEGER DEFAULT 0,
        cost NUMERIC DEFAULT 0.000,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create memory_predictions table
    console.log("- Creating public.memory_predictions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        predicted_retention NUMERIC DEFAULT 100.0,
        predicted_exam_readiness NUMERIC DEFAULT 100.0,
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 11. Create retention_history table
    console.log("- Creating public.retention_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.retention_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        retention_pct NUMERIC NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 12. Create memory_notifications table
    console.log("- Creating public.memory_notifications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        is_read BOOLEAN DEFAULT false
      );
    `);

    // 13. Create memory_preferences table
    console.log("- Creating public.memory_preferences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_preferences (
        user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        notifications_enabled BOOLEAN DEFAULT true,
        preferred_session_time VARCHAR(20),
        session_style VARCHAR(50) DEFAULT 'Focused',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 14. Create memory_settings table
    console.log("- Creating public.memory_settings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT
      );
    `);

    // 15. Create memory_analytics table
    console.log("- Creating public.memory_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        study_time_seconds INTEGER DEFAULT 0,
        cards_due_count INTEGER DEFAULT 0,
        knowledge_growth_index NUMERIC DEFAULT 1.0,
        last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 16. Create future_memory_models table
    console.log("- Creating public.future_memory_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_memory_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) NOT NULL,
        configuration JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default settings configurations
    console.log("Seeding memory parameters settings...");
    await client.query(`
      INSERT INTO public.memory_settings (key, value, description)
      VALUES
        ('base_decay_rate', '0.12', 'Standard exponential memory decay constant'),
        ('smart_multiplier', '1.5', 'Multiplier applied to spaced repetitions interval calculations'),
        ('max_study_limit', '100', 'Maximum daily flashcard reviews allowed for standard tier students')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Enable RLS and setup default allow-all policies for testing
    console.log("Updating RLS policies for Memory tables...");
    const tablesToRLS = [
      'memory_profiles', 'memory_sessions', 'memory_scores', 'memory_health',
      'flashcard_reviews', 'wrong_questions', 'memory_ai_logs', 'memory_predictions',
      'retention_history', 'memory_notifications', 'memory_preferences',
      'memory_analytics', 'future_memory_models'
    ];

    for (const t of tablesToRLS) {
      await client.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`).catch(() => {});
      await client.query(`DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.${t};`).catch(() => {});
      await client.query(`
        CREATE POLICY "Allow all for authenticated users" ON public.${t}
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
      `);
    }

    console.log("✓ Enterprise Memory Lab foundation schemas successfully initialized!");

  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
