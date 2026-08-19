const { Client } = require('pg');
const { dbConfig } = require('c:/Users/L470/Desktop/Futrix/Web App/config/db.js');

async function main() {
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log("Creating public.premium_pricing_settings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.premium_pricing_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        display_name VARCHAR(150),
        category VARCHAR(50) DEFAULT 'pricing'
      );
    `);

    // Seed default values
    const seeds = [
      { key: 'plan_basic_1m', value: '199', display_name: 'Basic Plan (1 Month)', category: 'pricing' },
      { key: 'plan_silver_3m', value: '499', display_name: 'Silver Plan (3 Months)', category: 'pricing' },
      { key: 'plan_gold_6m', value: '999', display_name: 'Gold Plan (6 Months)', category: 'pricing' },
      { key: 'plan_diamond_1y', value: '1499', display_name: 'Diamond Plan (1 Year)', category: 'pricing' },
      { key: 'plan_single_test', value: '19', display_name: 'Single Test Pass (1 Month)', category: 'pricing' },
      { key: 'payment_gateway_type', value: 'Mock Gateway', display_name: 'Active Payment Gateway', category: 'gateway' },
      { key: 'payment_gateway_key', value: 'rzp_test_mockKey123', display_name: 'Gateway API Key / UPI ID', category: 'gateway' },
      { key: 'payment_gateway_secret', value: 'mockSecret456', display_name: 'Gateway Secret Token', category: 'gateway' }
    ];

    for (const seed of seeds) {
      await client.query(`
        INSERT INTO public.premium_pricing_settings (key, value, display_name, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET display_name = EXCLUDED.display_name, category = EXCLUDED.category;
      `, [seed.key, seed.value, seed.display_name, seed.category]);
    }
    console.log("[✓] Seeded/updated premium_pricing_settings.");

    console.log("Creating public.single_test_purchases table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.single_test_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        series_id TEXT NOT NULL,
        purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT now() + INTERVAL '1 month'
      );
    `);
    console.log("[✓] Created single_test_purchases table.");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
