const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Premium Economy DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create scholarships
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.scholarships (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        discount_percent NUMERIC NOT NULL,
        eligibility_criteria TEXT,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'scholarships' created.");

    // 2. Create referrals
    await client.query(`
      DROP TABLE IF EXISTS public.referrals CASCADE;
      CREATE TABLE public.referrals (
        code VARCHAR PRIMARY KEY,
        referrer_id VARCHAR NOT NULL,
        referee_id VARCHAR,
        status VARCHAR DEFAULT 'Pending',
        reward_credits NUMERIC DEFAULT 50.00,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'referrals' created.");

    // 3. Create promotional_campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.promotional_campaigns (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        discount_percent NUMERIC NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'promotional_campaigns' created.");

    // 4. Create student_usage_limits
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.student_usage_limits (
        student_id VARCHAR NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        ai_completions_count INT DEFAULT 0,
        mock_tests_count INT DEFAULT 0,
        PRIMARY KEY (student_id, date)
      )
    `);
    console.log("- Table 'student_usage_limits' created.");

    // 5. Seed Defaults
    console.log("Seeding scholarships, promotions, referrals...");

    // Seed scholarships
    await client.query(`
      INSERT INTO public.scholarships (id, name, discount_percent, eligibility_criteria)
      VALUES
        ('sch_merit_90', 'Super 30 Merit Scholarship', 90.00, 'Score >95% in Futrix National Level Assessment'),
        ('sch_econom_50', 'Need-based Financial Scholarship', 50.00, 'Family income details verified by administration review')
      ON CONFLICT (id) DO UPDATE SET discount_percent = EXCLUDED.discount_percent;
    `);

    // Seed promotions
    await client.query(`
      INSERT INTO public.promotional_campaigns (id, name, discount_percent, start_date, end_date)
      VALUES
        ('promo_festival_30', 'Independence Day Launch Sale', 30.00, '2026-08-01 00:00:00', '2026-08-31 23:59:59'),
        ('promo_flash_weekend', 'Weekend Lightning Flash Sale', 15.00, '2026-07-04 00:00:00', '2026-07-10 23:59:59')
      ON CONFLICT (id) DO UPDATE SET discount_percent = EXCLUDED.discount_percent;
    `);

    // Seed default referrals
    await client.query(`
      INSERT INTO public.referrals (code, referrer_id, referee_id, status, reward_credits)
      VALUES
        ('REF-AMIT99', 'student-referrer-id', 'student-referee-id', 'Paid', 50.00),
        ('REF-NEHA44', 'student-neha-id', NULL, 'Pending', 50.00)
      ON CONFLICT (code) DO NOTHING;
    `);

    console.log("Seeding complete. Economy migrations finished.");

  } catch (err) {
    console.error("Economy migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
