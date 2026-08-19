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
    console.log("Connected to database.");

    // 1. Insert test_series
    console.log("Seeding test_series...");
    const seriesId = 'NEET-CELL-DIV';
    
    // Clear existing to avoid duplicate conflicts
    await client.query('DELETE FROM public.questions WHERE series_id = $1', [seriesId]);
    await client.query('DELETE FROM public.test_series WHERE series_id = $1', [seriesId]);

    const seriesRes = await client.query(`
      INSERT INTO public.test_series (
        series_id, exam_type, topic_chapter, duration_minutes, xp_reward, max_marks, status, test_type, price, has_questions
      ) VALUES (
        $1, 'NEET', 'Cell Division Quiz', 10, 40, 15, 'active', 'topic', 0.00, true
      ) RETURNING id
    `, [seriesId]);

    console.log("[✓] Seeded test series:", seriesRes.rows[0]);

    // 2. Insert questions
    console.log("Seeding questions...");
    const questions = [
      {
        question_number: 1,
        question_text: "What is the cell division type that reduces chromosome numbers by half?",
        option_a: "Mitosis",
        option_b: "Meiosis",
        option_c: "Amitosis",
        option_d: "Binary Fission",
        correct_answer: "B",
        marks: 4.00,
        negative_marks: -1.00,
        topic: "Cell Division"
      },
      {
        question_number: 2,
        question_text: "During which phase of cell division do chromosomes align at the equatorial plate?",
        option_a: "Prophase",
        option_b: "Metaphase",
        option_c: "Anaphase",
        option_d: "Telophase",
        correct_answer: "B",
        marks: 4.00,
        negative_marks: -1.00,
        topic: "Cell Division"
      },
      {
        question_number: 3,
        question_text: "Which cell organelle is primarily responsible for spindle fiber formation during mitosis?",
        option_a: "Mitochondria",
        option_b: "Centrosome",
        option_c: "Ribosome",
        option_d: "Lysosome",
        correct_answer: "B",
        marks: 4.00,
        negative_marks: -1.00,
        topic: "Cell Division"
      }
    ];

    for (const q of questions) {
      await client.query(`
        INSERT INTO public.questions (
          series_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, negative_marks, topic
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `, [
        seriesId,
        q.question_number,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        q.marks,
        q.negative_marks,
        q.topic
      ]);
    }

    console.log("[✓] Seeded 3 questions successfully.");

  } catch (err) {
    console.error("Database seeding error:", err);
  } finally {
    await client.end();
  }
}

main();
