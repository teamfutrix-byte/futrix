const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Payment Engine DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create payment_gateways
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_gateways (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        environment VARCHAR NOT NULL,
        api_keys_encrypted VARCHAR NOT NULL,
        webhook_secret VARCHAR,
        priority INT NOT NULL,
        status VARCHAR NOT NULL,
        health_score NUMERIC NOT NULL,
        daily_limit NUMERIC,
        last_used TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'payment_gateways' created.");

    // 2. Create plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.plans (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        currency VARCHAR NOT NULL,
        billing_cycle_months INT NOT NULL,
        ai_credits INT NOT NULL,
        mock_tests INT NOT NULL,
        status VARCHAR NOT NULL,
        version INT NOT NULL
      )
    `);
    console.log("- Table 'plans' created.");

    // 3. Create orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.orders (
        id VARCHAR PRIMARY KEY,
        student_id VARCHAR NOT NULL,
        institute_id VARCHAR,
        plan_id VARCHAR NOT NULL,
        amount NUMERIC NOT NULL,
        discount NUMERIC NOT NULL,
        coupon VARCHAR,
        tax NUMERIC NOT NULL,
        currency VARCHAR NOT NULL,
        gateway VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        invoice_id VARCHAR,
        subscription_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'orders' created.");

    // 4. Create subscriptions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscriptions (
        id VARCHAR PRIMARY KEY,
        student_id VARCHAR NOT NULL,
        plan_id VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        trial_start TIMESTAMP,
        trial_end TIMESTAMP,
        current_period_start TIMESTAMP DEFAULT NOW(),
        current_period_end TIMESTAMP,
        grace_period_end TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'subscriptions' created.");

    // 5. Create invoices
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.invoices (
        id VARCHAR PRIMARY KEY,
        invoice_number VARCHAR NOT NULL,
        order_id VARCHAR NOT NULL,
        student_id VARCHAR NOT NULL,
        subtotal NUMERIC NOT NULL,
        tax_amount NUMERIC NOT NULL,
        discount_amount NUMERIC NOT NULL,
        total NUMERIC NOT NULL,
        currency VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'invoices' created.");

    // 6. Create wallet_transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id VARCHAR NOT NULL,
        amount NUMERIC NOT NULL,
        type VARCHAR NOT NULL,
        description TEXT,
        correlation_id VARCHAR,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'wallet_transactions' created.");

    // 7. Create coupons
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coupons (
        code VARCHAR PRIMARY KEY,
        discount_percent NUMERIC NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        max_uses INT,
        current_uses INT DEFAULT 0,
        expires_at TIMESTAMP
      )
    `);
    console.log("- Table 'coupons' created.");

    // 8. Create payment_audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        target VARCHAR NOT NULL,
        amount NUMERIC,
        result VARCHAR NOT NULL,
        ip_address VARCHAR,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'payment_audit_logs' created.");

    // 9. Seed defaults
    console.log("Seeding plans, gateways, coupons...");

    // Seed Gateways
    await client.query(`
      INSERT INTO public.payment_gateways (id, name, environment, api_keys_encrypted, webhook_secret, priority, status, health_score, daily_limit)
      VALUES 
        ('razorpay', 'Razorpay Payments', 'Production', 'rzp_live_key_encrypted_sec', 'whsec_rzp_webhook', 1, 'Active', 99.4, 500000.00),
        ('stripe', 'Stripe Global', 'Sandbox', 'sk_test_stripe_key_encrypted_sec', 'whsec_stripe_webhook', 2, 'Active', 98.9, 1000000.00),
        ('phonepe', 'PhonePe UPI', 'Production', 'pp_prod_key_encrypted_sec', 'whsec_pp_webhook', 3, 'Active', 99.1, 300000.00)
      ON CONFLICT (id) DO UPDATE SET priority = EXCLUDED.priority, health_score = EXCLUDED.health_score;
    `);

    // Seed Plans
    await client.query(`
      INSERT INTO public.plans (id, name, description, price, currency, billing_cycle_months, ai_credits, mock_tests, status, version)
      VALUES
        ('plan_free_trial', 'Basic Free Trial', '7-day limited trial containing core mock test components and basic AI tutor guidance.', 0.00, 'INR', 1, 5, 2, 'Active', 1),
        ('plan_premium_monthly', 'Premium Plan (Monthly)', 'Unlimited mocks, premium AI Tutor analytics, exclusive study roadmaps, and priority assistance.', 599.00, 'INR', 1, 500, 9999, 'Active', 1),
        ('plan_premium_annual', 'Premium Plan (Annual)', 'Full year of unlimited mocks, premium AI Tutor analytics, study roadmaps, and priority assistance.', 4999.00, 'INR', 12, 6000, 9999, 'Active', 1)
      ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, ai_credits = EXCLUDED.ai_credits;
    `);

    // Seed Coupons
    await client.query(`
      INSERT INTO public.coupons (code, discount_percent, active, max_uses, expires_at)
      VALUES
        ('WELCOME50', 50.00, TRUE, 1000, '2027-12-31 23:59:59'),
        ('FUTRIX20', 20.00, TRUE, 5000, '2027-12-31 23:59:59')
      ON CONFLICT (code) DO UPDATE SET discount_percent = EXCLUDED.discount_percent;
    `);

    console.log("Seeding complete. Migrations finished.");

  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
