const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function main() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log("Connected to PostgreSQL Database.");

    // Start Transaction
    await client.query("BEGIN");

    // 1. Create public.ai_providers
    console.log("Creating public.ai_providers...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_providers (
        id text PRIMARY KEY,
        name text NOT NULL,
        api_endpoint text,
        encrypted_api_key text,
        org_id text,
        project_id text,
        region text DEFAULT 'global',
        timeout_ms integer DEFAULT 15000,
        retry_policy jsonb DEFAULT '{"max_retries": 3, "backoff_ms": 1000}'::jsonb,
        rate_limits jsonb DEFAULT '{"rpm": 60, "tpm": 40000}'::jsonb,
        concurrency_limit integer DEFAULT 10,
        priority integer DEFAULT 1,
        health_status text DEFAULT 'Healthy',
        monthly_budget numeric(10,2) DEFAULT 100.00,
        daily_budget numeric(10,2) DEFAULT 10.00,
        cost_tracking numeric(12,6) DEFAULT 0.000000,
        status text DEFAULT 'Active',
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `);

    // 2. Create public.ai_models
    console.log("Creating public.ai_models...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_models (
        id text PRIMARY KEY,
        display_name text NOT NULL,
        provider_id text REFERENCES public.ai_providers(id) ON DELETE CASCADE,
        version text,
        capabilities text[] DEFAULT '{}'::text[],
        context_window integer DEFAULT 8192,
        max_output_tokens integer DEFAULT 2048,
        input_cost_per_million numeric(10,4) DEFAULT 0.0000,
        output_cost_per_million numeric(10,4) DEFAULT 0.0000,
        latency_ms integer DEFAULT 1000,
        health_score numeric(3,2) DEFAULT 1.00,
        is_default boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `);

    // 3. Create public.ai_prompts
    console.log("Creating public.ai_prompts...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_prompts (
        id text PRIMARY KEY,
        display_name text NOT NULL,
        module text NOT NULL,
        purpose text,
        variables text[] DEFAULT '{}'::text[],
        default_model_id text,
        fallback_prompt_id text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `);

    // 4. Create public.ai_prompt_versions
    console.log("Creating public.ai_prompt_versions...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id text REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
        version_number integer NOT NULL,
        content text NOT NULL,
        change_summary text,
        status text DEFAULT 'Draft',
        created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now(),
        UNIQUE (prompt_id, version_number)
      )
    `);

    // 5. Create public.ai_feature_mappings
    console.log("Creating public.ai_feature_mappings...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_feature_mappings (
        feature_key text PRIMARY KEY,
        primary_model_id text REFERENCES public.ai_models(id) ON DELETE SET NULL,
        routing_strategy text DEFAULT 'Accuracy',
        fallback_model_id text REFERENCES public.ai_models(id) ON DELETE SET NULL,
        ab_variant_model_id text REFERENCES public.ai_models(id) ON DELETE SET NULL,
        ab_weight integer DEFAULT 50,
        updated_at timestamp with time zone DEFAULT now()
      )
    `);

    // 6. Create public.ai_caches
    console.log("Creating public.ai_caches...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_caches (
        cache_key text PRIMARY KEY,
        prompt_hash text NOT NULL,
        response_text text NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        cache_type text DEFAULT 'response',
        created_at timestamp with time zone DEFAULT now()
      )
    `);

    // 7. Alter public.ai_logs
    console.log("Altering public.ai_logs to add detailed fields...");
    await client.query(`
      ALTER TABLE public.ai_logs 
      ADD COLUMN IF NOT EXISTS provider_id text,
      ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tokens_input integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tokens_output integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6) DEFAULT 0.000000,
      ADD COLUMN IF NOT EXISTS cache_hit boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS safety_verdict text DEFAULT 'Safe',
      ADD COLUMN IF NOT EXISTS correlation_id text;
    `);

    // 8. Setup RLS policies on new tables
    console.log("Setting up RLS...");
    const tables = ['ai_providers', 'ai_models', 'ai_prompts', 'ai_prompt_versions', 'ai_feature_mappings', 'ai_caches'];
    for (const t of tables) {
      await client.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS "Admin full control on ${t}" ON public.${t};`);
      await client.query(`
        CREATE POLICY "Admin full control on ${t}" ON public.${t}
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );
      `);
      
      // Allow general select/read access to authenticated profiles for routing and evaluation
      await client.query(`DROP POLICY IF EXISTS "All authenticated read on ${t}" ON public.${t};`);
      await client.query(`
        CREATE POLICY "All authenticated read on ${t}" ON public.${t}
        FOR SELECT TO authenticated
        USING (true);
      `);
    }

    // 9. Seeding initial AI Providers
    console.log("Seeding AI Providers...");
    await client.query(`
      INSERT INTO public.ai_providers (id, name, api_endpoint, status) VALUES 
      ('google_gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'Active'),
      ('openai', 'OpenAI', 'https://api.openai.com/v1', 'Active'),
      ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com/v1', 'Active'),
      ('ollama', 'Ollama (Local)', 'http://localhost:11434', 'Active')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 10. Seeding initial AI Models
    console.log("Seeding AI Models...");
    await client.query(`
      INSERT INTO public.ai_models (id, display_name, provider_id, version, capabilities, context_window, max_output_tokens, input_cost_per_million, output_cost_per_million, is_default) VALUES 
      ('gemini-1.5-flash', 'Gemini 1.5 Flash', 'google_gemini', '1.5-flash', '{"vision","chat"}', 1048576, 8192, 0.0750, 0.3000, true),
      ('gemini-1.5-pro', 'Gemini 1.5 Pro', 'google_gemini', '1.5-pro', '{"vision","chat","reasoning"}', 2097152, 8192, 1.2500, 5.0000, false),
      ('gpt-4o-mini', 'GPT-4o Mini', 'openai', 'gpt-4o-mini', '{"chat"}', 128000, 4096, 0.1500, 0.6000, false),
      ('gpt-4o', 'GPT-4o', 'openai', 'gpt-4o', '{"vision","chat"}', 128000, 4096, 2.5000, 10.0000, false),
      ('claude-3-5-sonnet', 'Claude 3.5 Sonnet', 'anthropic', '3-5-sonnet', '{"vision","chat","reasoning"}', 200000, 8192, 3.0000, 15.0000, false),
      ('llama3', 'Llama 3 (Ollama)', 'ollama', 'llama3', '{"chat"}', 8192, 2048, 0.0000, 0.0000, false)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 11. Seeding initial Prompts
    console.log("Seeding Prompts...");
    await client.query(`
      INSERT INTO public.ai_prompts (id, display_name, module, purpose, variables, default_model_id) VALUES 
      ('tutor_chat', 'AI Tutor Conversation', 'Tutor', 'Assists student queries interactively', '{"student_name","topic","language","class"}', 'gemini-1.5-flash'),
      ('question_generation', 'Question Generator', 'Generator', 'Generates high quality conceptual questions', '{"subject","topic","difficulty","question_count"}', 'gemini-1.5-flash'),
      ('question_validation', 'AI Quality Validator', 'Validator', 'Validates generate question parameters', '{"question_text","options","correct_answer"}', 'gemini-1.5-pro')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 12. Seeding initial Prompt Versions
    console.log("Seeding Prompt Versions...");
    // Find prompt key mappings and write initial prompt templates
    await client.query(`
      INSERT INTO public.ai_prompt_versions (prompt_id, version_number, content, change_summary, status) VALUES 
      ('tutor_chat', 1, 'You are Futrix AI, a helpful, patient, and highly intelligent educator mentor. Your student is {{student_name}}, studying {{topic}} at a {{class}} level. Answer their questions clearly in {{language}}.', 'Initial tutor prompt', 'Published'),
      ('question_generation', 1, 'Generate {{question_count}} high-quality {{difficulty}} level multiple-choice questions for {{subject}} focusing on {{topic}}. Format output strictly in JSON.', 'Initial generator prompt', 'Published'),
      ('question_validation', 1, 'Verify the educational quality, LaTeX balance, and distractor options of the following question: {{question_text}}. Correct answer is: {{correct_answer}}.', 'Initial validator prompt', 'Published')
      ON CONFLICT (prompt_id, version_number) DO NOTHING;
    `);

    // 13. Seeding initial Feature Mappings
    console.log("Seeding Feature Mappings...");
    await client.query(`
      INSERT INTO public.ai_feature_mappings (feature_key, primary_model_id, routing_strategy, fallback_model_id) VALUES 
      ('tutor_chat', 'gemini-1.5-flash', 'Accuracy', 'gpt-4o-mini'),
      ('question_generation', 'gemini-1.5-flash', 'Accuracy', 'gpt-4o-mini'),
      ('question_validation', 'gemini-1.5-pro', 'Accuracy', 'claude-3-5-sonnet')
      ON CONFLICT (feature_key) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("\nDATABASE SCHEMA MIGRATION SUCCESSFULLY EXECUTED AND SEEDED!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
