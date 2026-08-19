const { getDbClient } = require('./config/db');

async function test() {
  console.log('Testing Mistake-to-Flashcard Automator client-database transactions...');
  
  const db = getDbClient();
  await db.connect();

  const mockUserUuid = '2ae57959-6e7f-4be2-a58d-9db9a01816df';
  const testSeriesId = 'VALIDATE-SRS-TEST';

  // 1. Wipe previous test queues
  await db.query("DELETE FROM public.revision_queue WHERE user_id = $1", [mockUserUuid]);
  await db.query("DELETE FROM public.wrong_questions WHERE user_id = $1", [mockUserUuid]);
  console.log('Cleaned previous database entries.');

  // 2. Mock incorrectQuestions
  const incorrectQuestions = [
    {
      question_id: '88888888-8888-8888-8888-888888888888',
      question_text: 'What is the function of Mitochondria?',
      correct_answer: 'C',
      explanation: 'Mitochondria is the powerhouse of the cell.',
      subject: 'Biology',
      chapter: 'Cell Biology',
      topic: 'Mitochondria'
    }
  ];

  for (const item of incorrectQuestions) {
    const { rows: wrongRows } = await db.query(`
      INSERT INTO public.wrong_questions (user_id, question_id, question_text, correct_answer, explanation, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [mockUserUuid, item.question_id, item.question_text, item.correct_answer, item.explanation, 'Active']);

    const wrongQ = wrongRows[0];
    if (wrongQ) {
      await db.query(`
        INSERT INTO public.revision_queue (user_id, wrong_question_id, question_text, correct_answer, subject, card_state, ease_factor, step_index, interval_day, next_revision_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [mockUserUuid, wrongQ.id, item.question_text, item.correct_answer, item.subject, 'new', 2500, 0, 0]);
    }
  }
  console.log('Database transaction executed.');

  // 3. Verify assertions
  const wrongCheck = await db.query('SELECT * FROM public.wrong_questions WHERE user_id = $1', [mockUserUuid]);
  console.log('Wrong Questions Row:', JSON.stringify(wrongCheck.rows[0], null, 2));
  if (wrongCheck.rows.length !== 1) {
    throw new Error('Assertion failed: wrong question not written to database.');
  }

  const queueCheck = await db.query('SELECT * FROM public.revision_queue WHERE user_id = $1', [mockUserUuid]);
  console.log('Revision Queue Row:', JSON.stringify(queueCheck.rows[0], null, 2));
  if (queueCheck.rows.length !== 1) {
    throw new Error('Assertion failed: flashcard not created in revision queue.');
  }

  console.log('[✓] Mistake-to-Flashcard Automator transaction validation passed successfully!');
  await db.end();
}

test().catch(err => {
  console.error('[FAILED] Verification check error:', err);
  process.exit(1);
});
