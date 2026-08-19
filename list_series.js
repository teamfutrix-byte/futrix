const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    
    console.log("Seeding default 'AI-GENERATED-POOL' test series record...");
    await client.query(`
      INSERT INTO public.test_series (
        series_id, exam_type, topic_chapter, duration_minutes, xp_reward, max_marks, status, test_type, price, has_questions
      ) VALUES (
        'AI-GENERATED-POOL', 'NEET', 'AI Generated Practice Pool', 60, 100, 180, 'active', 'topic', 0.00, true
      )
      ON CONFLICT (series_id) DO NOTHING;
    `);
    
    console.log("[✓] Seeding completed successfully!");
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await client.end();
  }
}

main();
