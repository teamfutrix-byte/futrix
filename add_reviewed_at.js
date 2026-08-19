const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function fix() {
  console.log("Adding reviewed_at column to public.duplicate_reviews...");
  const client = new Client(dbConfig);
  await client.connect();
  try {
    await client.query("ALTER TABLE public.duplicate_reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE");
    console.log("Column added successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

fix();
