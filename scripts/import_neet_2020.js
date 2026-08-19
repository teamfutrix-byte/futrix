const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const ocrPages = require('./ocr_data');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function getApiKey(db) {
  const { rows } = await db.query("SELECT gemini_api_key FROM public.ai_settings LIMIT 1");
  if (rows.length === 0) throw new Error("No AI settings found in database.");
  return rows[0].gemini_api_key;
}

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }
  
  const json = await response.json();
  const text = json.candidates[0].content.parts[0].text;
  return JSON.parse(text.trim());
}

async function translatePages(apiKey) {
  const questionsFilePath = path.join(__dirname, 'neet_2020_questions.json');
  
  // Load state from file if it exists, for incremental continuation
  let state = { parsedPages: [], questions: [] };
  if (fs.existsSync(questionsFilePath)) {
    try {
      const fileContent = fs.readFileSync(questionsFilePath, 'utf8');
      const loaded = JSON.parse(fileContent);
      if (loaded && Array.isArray(loaded.questions) && Array.isArray(loaded.parsedPages)) {
        state = loaded;
        console.log(`[!] Resuming from previous state. Already parsed pages: ${state.parsedPages.join(', ')}. Total questions loaded: ${state.questions.length}`);
      } else if (Array.isArray(loaded)) {
        // Legacy array structure compatibility
        state.questions = loaded;
        state.parsedPages = Array.from({ length: 20 }, (_, i) => i);
        console.log(`[!] Read existing completed array from file. Questions: ${state.questions.length}`);
      }
    } catch (e) {
      console.warn("[!] Error reading existing state, starting fresh:", e.message);
    }
  }

  const MODELS = [
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite'
  ];
  let currentModelIdx = 0;

  console.log(`[+] Starting translation pipeline of ${ocrPages.length} pages...`);

  for (let i = 0; i < ocrPages.length; i++) {
    if (state.parsedPages.includes(i)) {
      console.log(`[✓] Page ${i + 2} already parsed. Skipping...`);
      continue;
    }

    const pageNum = i + 2;
    const pageText = ocrPages[i];
    console.log(`[+] Parsing Page ${pageNum} using model: ${MODELS[currentModelIdx]}...`);
    
    const prompt = `
You are an expert NEET question parser. You will parse the following OCR text from NEET 2020 exam page.
For each question on the page:
1. Identify the question number.
2. Determine the English question text.
3. Translate the question text to Hindi. Return the question text in bilingual format: "English Question Text (Hindi Question Translation)"
4. Identify options (1), (2), (3), (4) (or Option A, B, C, D). Translate each option to Hindi. Return in bilingual format: "English Option (Hindi Option)"
5. Identify the correct answer (A, B, C, or D). Option 1 maps to A, 2 to B, 3 to C, 4 to D.
6. Determine the Subject (Physics, Chemistry, or Biology) based on question content:
   - Questions 1 to 90 are Biology
   - Questions 91 to 135 are Chemistry
   - Questions 136 to 180 are Physics
7. Identify the Chapter/Topic of the question (e.g. Cell Cycle and Cell Division, Genetics, Electrostatics, etc. matching standard Class 11/12 NCERT curriculum).
8. Determine a suitable Difficulty level ('Easy', 'Medium', 'Hard').
9. Generate a brief Detailed Solution in bilingual format: "English explanation (Hindi explanation)"

Output ONLY a JSON array of objects. Do not include markdown code block styling or any other text. Each object must have these fields:
- question_number: integer
- question_text: string (bilingual)
- option_a: string (bilingual)
- option_b: string (bilingual)
- option_c: string (bilingual)
- option_d: string (bilingual)
- correct_answer: string ("A", "B", "C", or "D")
- subject: string ("Biology", "Chemistry", or "Physics")
- chapter: string (Chapter name, e.g. "Cell Division")
- topic: string (Topic name, e.g. "Cell Division")
- difficulty: string ("Easy", "Medium", or "Hard")
- detailed_solution: string (bilingual)

OCR Text:
${pageText}
`;

    let success = false;
    let attemptsOnModel = 0;
    while (!success && currentModelIdx < MODELS.length) {
      const activeModel = MODELS[currentModelIdx];
      try {
        const parsed = await callGemini(apiKey, activeModel, prompt);
        if (Array.isArray(parsed)) {
          state.questions.push(...parsed);
          state.parsedPages.push(i);
          success = true;
          
          // Incremental Save
          fs.writeFileSync(questionsFilePath, JSON.stringify(state, null, 2), 'utf8');
          console.log(`[✓] Page ${pageNum} parsed successfully. Extracted ${parsed.length} questions. State saved.`);
        } else {
          throw new Error("Response is not an array");
        }
      } catch (err) {
        console.warn(`[!] Error using model ${activeModel} for Page ${pageNum}: ${err.message}`);
        
        // If it's a rate limit or query error, switch model or retry after wait
        if (err.message.includes('429') || err.message.includes('quota') || attemptsOnModel >= 2) {
          currentModelIdx++;
          attemptsOnModel = 0;
          if (currentModelIdx < MODELS.length) {
            console.log(`[→] Switching to model: ${MODELS[currentModelIdx]}...`);
          } else {
            console.error(`[X] Exhausted all available models.`);
          }
        } else {
          attemptsOnModel++;
          console.log(`[!] Retrying with the same model in 5s (Attempt ${attemptsOnModel}/2)...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!success) {
      throw new Error(`Parse failed for page ${pageNum} after exhausting all models.`);
    }
  }

  console.log(`[✓] Translation pipeline finished! Total questions: ${state.questions.length}`);
  return state.questions;
}

async function seedDatabase(db, questions) {
  console.log("[+] Seeding test series configurations...");

  // 1. Create or overwrite series configs
  const seriesConfigs = [
    {
      series_id: 'NEET-2020-FULL',
      exam_type: 'NEET',
      topic_chapter: 'NEET 2020 Full Mock Test',
      duration_minutes: 180,
      xp_reward: 200,
      max_marks: 720,
      status: 'active',
      test_type: 'full',
      price: 0.00,
      has_questions: true
    },
    {
      series_id: 'NEET-2020-BIO',
      exam_type: 'NEET',
      topic_chapter: 'NEET 2020 Biology Subject Test',
      duration_minutes: 90,
      xp_reward: 100,
      max_marks: 360,
      status: 'active',
      test_type: 'subject',
      price: 0.00,
      has_questions: true
    },
    {
      series_id: 'NEET-2020-CHEM',
      exam_type: 'NEET',
      topic_chapter: 'NEET 2020 Chemistry Subject Test',
      duration_minutes: 45,
      xp_reward: 100,
      max_marks: 180,
      status: 'active',
      test_type: 'subject',
      price: 0.00,
      has_questions: true
    },
    {
      series_id: 'NEET-2020-PHY',
      exam_type: 'NEET',
      topic_chapter: 'NEET 2020 Physics Subject Test',
      duration_minutes: 45,
      xp_reward: 100,
      max_marks: 180,
      status: 'active',
      test_type: 'subject',
      price: 0.00,
      has_questions: true
    }
  ];

  for (const cfg of seriesConfigs) {
    await db.query('DELETE FROM public.questions WHERE series_id = $1', [cfg.series_id]);
    await db.query('DELETE FROM public.test_series WHERE series_id = $1', [cfg.series_id]);
    
    await db.query(`
      INSERT INTO public.test_series (
        series_id, exam_type, topic_chapter, duration_minutes, xp_reward, max_marks, status, test_type, price, has_questions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      cfg.series_id, cfg.exam_type, cfg.topic_chapter, cfg.duration_minutes, 
      cfg.xp_reward, cfg.max_marks, cfg.status, cfg.test_type, cfg.price, cfg.has_questions
    ]);
    console.log(`[✓] Registered test series: ${cfg.series_id}`);
  }

  // 2. Seed questions
  console.log(`[+] Seeding ${questions.length} questions into the database...`);
  
  let seededCount = 0;
  for (const q of questions) {
    const qNum = parseInt(q.question_number || 1);
    const subject = q.subject || 'Biology';
    
    // Determine subject-specific series mapping and target question numbers
    let targetSeriesId = '';
    let targetQNum = qNum;
    
    if (subject === 'Biology') {
      targetSeriesId = 'NEET-2020-BIO';
      targetQNum = qNum; // 1 to 90
    } else if (subject === 'Chemistry') {
      targetSeriesId = 'NEET-2020-CHEM';
      targetQNum = qNum - 90; // Map 91-135 to 1-45
    } else if (subject === 'Physics') {
      targetSeriesId = 'NEET-2020-PHY';
      targetQNum = qNum - 135; // Map 136-180 to 1-45
    }

    // Insert for Full Test
    await insertQuestion(db, {
      series_id: 'NEET-2020-FULL',
      question_number: qNum,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: 4.00,
      negative_marks: -1.00,
      topic: q.topic || q.chapter || 'General',
      exam: 'NEET',
      subject: q.subject,
      chapter: q.chapter,
      difficulty: q.difficulty || 'Medium',
      explanation: q.detailed_solution,
      detailed_solution: q.detailed_solution,
      language: 'Bilingual',
      status: 'Published'
    });

    // Insert for Subject Test
    if (targetSeriesId) {
      await insertQuestion(db, {
        series_id: targetSeriesId,
        question_number: targetQNum,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        marks: 4.00,
        negative_marks: -1.00,
        topic: q.topic || q.chapter || 'General',
        exam: 'NEET',
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty || 'Medium',
        explanation: q.detailed_solution,
        detailed_solution: q.detailed_solution,
        language: 'Bilingual',
        status: 'Published'
      });
    }

    seededCount++;
  }

  console.log(`[✓] Successfully seeded database with ${seededCount} unique questions!`);
}

async function insertQuestion(db, q) {
  await db.query(`
    INSERT INTO public.questions (
      series_id, question_number, question_text, option_a, option_b, option_c, option_d, 
      correct_answer, marks, negative_marks, topic, exam, subject, chapter, difficulty, 
      explanation, detailed_solution, language, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `, [
    q.series_id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
    q.correct_answer, q.marks, q.negative_marks, q.topic, q.exam, q.subject, q.chapter, q.difficulty,
    q.explanation, q.detailed_solution, q.language, q.status
  ]);
}

async function main() {
  const db = new Client(dbConfig);
  try {
    await db.connect();
    console.log("[+] Connected to Futrix database.");
    
    const apiKey = await getApiKey(db);
    const questions = await translatePages(apiKey);
    
    await seedDatabase(db, questions);
  } catch (err) {
    console.error("[X] Ingestion process failed:", err);
  } finally {
    await db.end();
    console.log("[+] Database connection closed.");
  }
}

main();
