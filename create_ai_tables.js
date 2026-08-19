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
    console.log("Connected to PostgreSQL database.");

    // 1. Create public.ai_settings
    console.log("Creating public.ai_settings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        gemini_api_key text,
        api_status boolean DEFAULT false,
        model_selection text DEFAULT 'gemini-1.5-flash',
        temperature numeric DEFAULT 0.7,
        top_p numeric DEFAULT 0.9,
        max_output_tokens integer DEFAULT 2048,
        safety_level text DEFAULT 'medium',
        enable_ai boolean DEFAULT true,
        daily_usage integer DEFAULT 0,
        monthly_usage integer DEFAULT 0,
        token_usage integer DEFAULT 0,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // Pre-seed a single configuration row if none exists
    const { rows: settingsCount } = await client.query('SELECT count(*) FROM public.ai_settings');
    if (parseInt(settingsCount[0].count) === 0) {
      await client.query(`
        INSERT INTO public.ai_settings (gemini_api_key, api_status, model_selection, temperature, top_p, max_output_tokens, safety_level, enable_ai)
        VALUES (NULL, false, 'gemini-1.5-flash', 0.7, 0.9, 2048, 'medium', true)
      `);
      console.log("[✓] Pre-seeded default AI configuration row.");
    }

    // 2. Add columns to public.ai_logs if they don't exist
    console.log("Altering public.ai_logs table to add monitoring columns...");
    await client.query(`
      ALTER TABLE public.ai_logs 
      ADD COLUMN IF NOT EXISTS model_used text DEFAULT 'gemini-1.5-flash',
      ADD COLUMN IF NOT EXISTS latency integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS success boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS error_message text,
      ADD COLUMN IF NOT EXISTS session_id text;
    `);
    console.log("[✓] Altered public.ai_logs table successfully.");

    // 3. Enable RLS and setup Policies
    console.log("Enabling RLS on tables...");
    await client.query(`
      ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
    `);

    console.log("Re-creating RLS policies...");
    await client.query(`
      -- Admin only full access to settings
      DROP POLICY IF EXISTS "Admin only access to AI settings" ON public.ai_settings;
      CREATE POLICY "Admin only access to AI settings" ON public.ai_settings
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );

      -- Logs RLS: Allow authenticated users to insert logs, and allow admins to see/modify logs
      DROP POLICY IF EXISTS "Allow authenticated to insert AI logs" ON public.ai_logs;
      CREATE POLICY "Allow authenticated to insert AI logs" ON public.ai_logs
        FOR INSERT TO authenticated
        WITH CHECK (true);

      DROP POLICY IF EXISTS "Admin only view AI logs" ON public.ai_logs;
      CREATE POLICY "Admin only view AI logs" ON public.ai_logs
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );
    `);
    console.log("[✓] RLS policies applied.");

    console.log("\nDATABASE SCHEMA MIGRATION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
