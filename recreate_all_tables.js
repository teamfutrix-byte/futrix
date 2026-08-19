const { Client } = require('pg');
const crypto = require('crypto');

async function recreateDatabase() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    console.log("Creating public tables...");

    // 1. Institutes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.institutes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text UNIQUE NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.institutes table verified.");

    // 2. Profiles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY,
        full_name text NOT NULL,
        email text UNIQUE NOT NULL,
        phone text,
        dob date,
        guardian_name text,
        guardian_contact text,
        city text,
        qualification text,
        institute_id uuid REFERENCES public.institutes(id) ON DELETE SET NULL,
        pin_code varchar(6) CHECK (pin_code ~ '^\\d{6}$'),
        preparation_for text,
        xp_balance numeric(10, 2) DEFAULT 100.00 NOT NULL,
        referral_xp numeric(10, 2) DEFAULT 0.00 NOT NULL,
        unlocked_level integer DEFAULT 1 CHECK (unlocked_level >= 1 AND unlocked_level <= 20),
        device_id text,
        browser_fingerprint text,
        suspicion_score integer DEFAULT 0,
        is_pro boolean DEFAULT false NOT NULL,
        role text DEFAULT 'student' NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.profiles table verified.");

    // 3. Exam Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.exam_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text UNIQUE NOT NULL,
        display_name text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.exam_categories table verified.");

    // Seed default categories
    await client.query(`
      INSERT INTO public.exam_categories (name, display_name)
      VALUES ('NEET Prep', 'NEET Prep'), ('JEE Prep', 'JEE Prep')
      ON CONFLICT (name) DO NOTHING
    `);

    // 3.5 Exam Stream Requests Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.exam_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        query text NOT NULL,
        detected_stream text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.exam_requests table verified.");

    // 4. Test Series Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.test_series (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        series_id text UNIQUE NOT NULL,
        exam_type text NOT NULL,
        topic_chapter text NOT NULL,
        duration_minutes integer NOT NULL,
        xp_reward integer NOT NULL,
        max_marks integer NOT NULL,
        status text NOT NULL,
        test_type text NOT NULL,
        price numeric(10,2) DEFAULT 0.00,
        has_questions boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.test_series table verified.");

    // 5. Questions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        series_id text REFERENCES public.test_series(series_id) ON DELETE CASCADE,
        question_number integer NOT NULL,
        question_text text NOT NULL,
        option_a text NOT NULL,
        option_b text NOT NULL,
        option_c text NOT NULL,
        option_d text NOT NULL,
        correct_answer character(1) NOT NULL,
        marks numeric(5,2) NOT NULL,
        negative_marks numeric(5,2) DEFAULT 0.00,
        topic text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.questions table verified.");

    // 6. Attempts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        series_id text NOT NULL,
        correct_answers integer NOT NULL,
        wrong_answers integer NOT NULL,
        skipped_answers integer NOT NULL,
        score numeric(10,2) NOT NULL,
        xp_earned numeric(10,2) NOT NULL,
        time_taken_seconds integer NOT NULL,
        ip_hash text,
        question_navigation_log jsonb,
        disqualified boolean DEFAULT false,
        disqualify_reason text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.attempts table verified.");

    // 7. XP Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.xp_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        amount numeric(10,2) NOT NULL,
        transaction_type text NOT NULL,
        reference_id text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.xp_transactions table verified.");

    // 8. Battles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.battles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        opponent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        level_num integer NOT NULL,
        stream text NOT NULL,
        status text NOT NULL,
        winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
        questions_list jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.battles table verified.");

    // 9. Audit Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        action text NOT NULL,
        details jsonb,
        ip_address text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("[✓] public.audit_logs table verified.");

    // --- SEED SUPER ADMIN ---
    const email = 'teamfutrix-bytes-project@futrix.internal';
    const password = 'FutrixAdmin#2026';
    const fullName = 'Super Admin';
    const userId = crypto.randomUUID();
    const identityId = crypto.randomUUID();

    // Clear existing
    await client.query('DELETE FROM auth.users WHERE email = $1', [email]);
    await client.query('DELETE FROM public.profiles WHERE email = $1', [email]);

    // Insert Default GoTrue Instance Row
    await client.query(`
      INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', '', now(), now())
      ON CONFLICT DO NOTHING
    `);

    // Insert user into auth.users
    await client.query(`
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous, created_at, updated_at
      ) VALUES (
        $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
        crypt($3, gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Super Admin", "phone": "9999999999", "preparation_for": "NEET"}',
        false, false, now(), now()
      )
    `, [userId, email, password]);

    // Insert identity
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::jsonb, 'email', $2::text, now(), now()
      )
    `, [identityId, userId, JSON.stringify({ sub: userId, email: email, email_verified: true })]);

    // Insert profile
    await client.query(`
      INSERT INTO public.profiles (
        id, full_name, email, phone, role, xp_balance, preparation_for
      ) VALUES ($1, $2, $3, $4, 'admin', 500.00, 'NEET')
    `, [userId, fullName, email, '9999999999']);

    console.log("[✓] Super Admin seeded successfully.");

    // Enable RLS and default policies on all public tables automatically
    console.log("Enabling RLS and default policies on all public tables...");
    const { rows: dbTables } = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    for (const table of dbTables) {
      const tableName = table.tablename;
      await client.query(`ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY`);
      
      try {
        await client.query(`DROP POLICY IF EXISTS "Allow public read" ON public."${tableName}"`);
        await client.query(`DROP POLICY IF EXISTS "Allow auth write" ON public."${tableName}"`);
      } catch (_) {}
      
      await client.query(`
        CREATE POLICY "Allow public read" 
        ON public."${tableName}" 
        FOR SELECT 
        USING (true)
      `);
      
      await client.query(`
        CREATE POLICY "Allow auth write" 
        ON public."${tableName}" 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true)
      `);
    }
    console.log("[✓] Row-Level Security (RLS) configured successfully.");

    console.log("\nDATABASE SCHEMA REBUILD COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("[✗] Error rebuilding database:", err.message);
  } finally {
    await client.end();
  }
}

recreateDatabase();
