const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function fix() {
  console.log("Adding UNIQUE constraint to question_rotation...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE public.question_rotation
      ADD CONSTRAINT question_rotation_unique_question_id UNIQUE (question_id);
    `);
    console.log("UNIQUE constraint added successfully!");
  } catch (err) {
    console.error("Failed to add constraint:", err.message);
  } finally {
    await client.end();
  }
}

fix();
