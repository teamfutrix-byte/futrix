const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise CMS DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Drop existing tables first to ensure clean state and data types
    console.log("- Dropping existing tables if any...");
    await client.query(`
      DROP TABLE IF EXISTS public.cms_audit_logs CASCADE;
      DROP TABLE IF EXISTS public.cms_faqs CASCADE;
      DROP TABLE IF EXISTS public.cms_menus CASCADE;
      DROP TABLE IF EXISTS public.cms_media CASCADE;
      DROP TABLE IF EXISTS public.cms_versions CASCADE;
      DROP TABLE IF EXISTS public.cms_content CASCADE;
    `);

    // 2. Create cms_content
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_content (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        slug VARCHAR UNIQUE NOT NULL,
        description TEXT,
        summary TEXT,
        category VARCHAR NOT NULL,
        subcategory VARCHAR,
        language VARCHAR NOT NULL DEFAULT 'en',
        author_id VARCHAR NOT NULL,
        reviewer_id VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'Draft',
        tags TEXT[] DEFAULT '{}',
        keywords TEXT[] DEFAULT '{}',
        seo_title VARCHAR,
        seo_description TEXT,
        canonical_url VARCHAR,
        featured_image VARCHAR,
        thumbnail VARCHAR,
        content_body TEXT NOT NULL,
        structured_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        published_at TIMESTAMP DEFAULT NULL,
        version INT NOT NULL DEFAULT 1,
        approval_status VARCHAR NOT NULL DEFAULT 'Pending',
        workflow_history JSONB DEFAULT '[]'::jsonb
      )
    `);
    console.log("- Table 'cms_content' created.");

    // 3. Create cms_versions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id VARCHAR NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
        version_number INT NOT NULL,
        title VARCHAR NOT NULL,
        slug VARCHAR NOT NULL,
        content_body TEXT NOT NULL,
        change_summary TEXT,
        author_id VARCHAR NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        diff_data JSONB DEFAULT '{}',
        approval_record JSONB DEFAULT '{}'
      )
    `);
    console.log("- Table 'cms_versions' created.");

    // 4. Create cms_media
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_media (
        id VARCHAR PRIMARY KEY,
        filename VARCHAR NOT NULL,
        filepath VARCHAR NOT NULL,
        file_size INT NOT NULL,
        format VARCHAR NOT NULL,
        resolution VARCHAR,
        checksum VARCHAR,
        owner_id VARCHAR NOT NULL,
        usage_count INT DEFAULT 0,
        alt_text TEXT,
        accessibility_tags TEXT[] DEFAULT '{}',
        cdn_status VARCHAR DEFAULT 'Pending',
        optimization_status VARCHAR DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'cms_media' created.");

    // 5. Create cms_menus
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_menus (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        role_restrictions TEXT[] DEFAULT '{}',
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'cms_menus' created.");

    // 6. Create cms_faqs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_faqs (
        id VARCHAR PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        visibility VARCHAR NOT NULL DEFAULT 'Public',
        language VARCHAR NOT NULL DEFAULT 'en',
        status VARCHAR NOT NULL DEFAULT 'Published',
        search_keywords TEXT[] DEFAULT '{}',
        views INT DEFAULT 0
      )
    `);
    console.log("- Table 'cms_faqs' created.");

    // 7. Create cms_audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cms_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        target VARCHAR NOT NULL,
        details JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'cms_audit_logs' created.");

    // ── SEED DATA ──
    console.log("Seeding default pages, menus, FAQs...");

    // Seed landing pages
    await client.query(`
      INSERT INTO public.cms_content (id, title, slug, description, summary, category, language, author_id, status, content_body, version, approval_status)
      VALUES
        ('page_home', 'Welcome to FUTRIX', 'home', 'The premier gamified online testing platform for JEE & NEET.', 'The premier gamified online testing platform.', 'Landing Page', 'en', 'admin_test', 'Published', '{"hero": {"title": "Master Your Exams the Gamified Way", "subtitle": "Prepare for JEE and NEET with live leaderboards, real-time analytics, and personalized AI mentoring.", "cta": "Start Free Trial"}}', 1, 'Approved'),
        ('page_about', 'About FUTRIX', 'about-us', 'Discover the team, vision, and mission of FUTRIX.', 'Discover the team and mission.', 'Landing Page', 'en', 'admin_test', 'Published', '{"sections": [{"title": "Our Mission", "body": "FUTRIX was created to democratize entrance prep, combining high-quality questions with interactive game mechanics."}]}', 1, 'Approved'),
        ('policy_privacy', 'Privacy Policy', 'privacy-policy', 'FUTRIX Privacy and Data Security Terms.', 'FUTRIX Privacy Policy.', 'Policy', 'en', 'admin_test', 'Published', 'Privacy details: We value your privacy. We collect your registration details to synchronize gamified achievements and test progress.', 1, 'Approved')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed default menus
    await client.query(`
      INSERT INTO public.cms_menus (id, name, role_restrictions, items)
      VALUES
        ('menu_header', 'Main Header Navigation', '{"guest", "student", "teacher"}', '[
          {"label": "Home", "url": "/index.html", "order": 1},
          {"label": "Leaderboard", "url": "/leaderboard.html", "order": 2, "role": "student"},
          {"label": "Memory Lab", "url": "/memory-lab.html", "order": 3, "role": "student"},
          {"label": "Active Exams", "url": "/active-exams.html", "order": 4, "role": "student"}
        ]'::jsonb),
        ('menu_footer', 'Main Footer Navigation', '{}', '[
          {"label": "Privacy Policy", "url": "/privacy-policy", "order": 1},
          {"label": "About Us", "url": "/about-us", "order": 2},
          {"label": "FAQs", "url": "/faq", "order": 3}
        ]'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed FAQs
    await client.query(`
      INSERT INTO public.cms_faqs (id, question, answer, category, display_order, visibility, language, status, search_keywords)
      VALUES
        ('faq_1', 'What is FUTRIX?', 'FUTRIX is a gamified exam preparation platform for competitive exams like JEE & NEET, combining live scoring with leagues, achievements, and AI mentoring.', 'General', 1, 'Public', 'en', 'Published', '{"futrix", "gamified", "jee", "neet"}'),
        ('faq_2', 'How are points/XP calculated?', 'You earn XP by solving practice sheets, finishing mock tests, unlocking streaks, and finishing top of your weekly league board.', 'Gamification', 2, 'Public', 'en', 'Published', '{"xp", "points", "streaks", "league"}'),
        ('faq_3', 'How do I unlock the premium features?', 'You can upgrade your subscription from the Checkout Console. Premium features include unlimited mock exams and personalized AI Tutor reviews.', 'Billing', 3, 'Public', 'en', 'Published', '{"premium", "subscription", "checkout"}')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Seeding complete. CMS migrations finished.");

  } catch (err) {
    console.error("CMS Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
