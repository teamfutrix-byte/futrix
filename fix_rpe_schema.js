const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function fix() {
  const db = new Client(dbConfig);
  await db.connect();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.result_xp_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      result_id UUID NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
      base_xp NUMERIC(6,2) DEFAULT 0.00,
      correct_xp NUMERIC(6,2) DEFAULT 0.00,
      bonus_xp NUMERIC(6,2) DEFAULT 0.00,
      streak_xp NUMERIC(6,2) DEFAULT 0.00,
      league_bonus_xp NUMERIC(6,2) DEFAULT 0.00,
      penalty_xp NUMERIC(6,2) DEFAULT 0.00,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('✓ result_xp_ledger table created successfully');
  
  await db.end();
}
fix();
