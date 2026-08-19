const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Subscription & Premium Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create subscription_plans table
    console.log("- Creating public.subscription_plans table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name VARCHAR(50) UNIQUE NOT NULL, -- 'FREE', 'PREMIUM', 'PRO', 'INSTITUTE', 'TEACHER', 'ENTERPRISE', 'SUPER ADMIN'
        monthly_price NUMERIC DEFAULT 0.0,
        features_json JSONB DEFAULT '{}'::jsonb,
        max_ai_requests INTEGER DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default plans
    await client.query(`
      INSERT INTO public.subscription_plans (plan_name, monthly_price, features_json, max_ai_requests)
      VALUES 
        ('FREE', 0.0, '{"aiCoach": false, "flashcards": true, "limit": 10}', 10),
        ('PREMIUM', 499.0, '{"aiCoach": true, "flashcards": true, "limit": -1}', -1),
        ('PRO', 999.0, '{"aiCoach": true, "flashcards": true, "limit": -1}', -1)
      ON CONFLICT (plan_name) DO NOTHING;
    `);

    // 2. Create subscriptions table (if not exists)
    console.log("- Adjusting public.subscriptions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscriptions (
        id VARCHAR(200) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'Active', -- 'Active', 'Cancelled', 'Expired'
        start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create licenses table
    console.log("- Creating public.licenses table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id VARCHAR(200) REFERENCES public.subscriptions(id) ON DELETE CASCADE,
        license_token VARCHAR(200) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Adjust existing public.feature_flags seeder
    console.log("- Seeding features to public.feature_flags table...");
    await client.query(`
      INSERT INTO public.feature_flags (key, display_name, description, enabled, module)
      VALUES 
        ('memory_lab', 'Memory Lab', 'Access to Memory Lab Dashboard', TRUE, 'Core'),
        ('ai_coach', 'AI Coach', 'Conversational AI Mentor', TRUE, 'AI'),
        ('flashcards', 'Flashcards', 'Active Recall Flashcards Generator', TRUE, 'Core'),
        ('wrong_notebook', 'Wrong Notebook', 'Mistake Intelligence Notebook', TRUE, 'Core')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 5. Create usage_limits table
    console.log("- Creating public.usage_limits table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.usage_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id VARCHAR(200) REFERENCES public.subscriptions(id) ON DELETE CASCADE,
        feature_name VARCHAR(100) NOT NULL,
        max_limit INTEGER DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create usage_logs table
    console.log("- Creating public.usage_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        feature_name VARCHAR(100) NOT NULL,
        requests_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create coupon_engine table
    console.log("- Creating public.coupon_engine table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coupon_engine (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coupon_code VARCHAR(50) UNIQUE NOT NULL,
        discount_pct NUMERIC DEFAULT 10.0,
        max_uses INTEGER DEFAULT 100,
        current_uses INTEGER DEFAULT 0,
        expiry_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default coupon
    await client.query(`
      INSERT INTO public.coupon_engine (coupon_code, discount_pct, max_uses, expiry_date)
      VALUES ('FUTRIXNEET50', 50.0, 500, now() + interval '1 year')
      ON CONFLICT (coupon_code) DO NOTHING;
    `);

    // 8. Create subscription_events table
    console.log("- Creating public.subscription_events table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscription_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id VARCHAR(200) REFERENCES public.subscriptions(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL, -- 'Purchased', 'Renewed', 'Upgraded'
        metadata_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create subscription_analytics table
    console.log("- Creating public.subscription_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscription_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        active_count INTEGER DEFAULT 0,
        churn_count INTEGER DEFAULT 0,
        revenue_numeric NUMERIC DEFAULT 0.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Seed default analytics stats record
    await client.query(`
      INSERT INTO public.subscription_analytics (active_count, churn_count, revenue_numeric)
      VALUES (150, 5, 75000.0)
      ON CONFLICT DO NOTHING;
    `);

    // 10. Create future_subscription_models table
    console.log("- Creating public.future_subscription_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_subscription_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Subscription & Premium Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
