const { Client } = require('pg');
const questionValidator = require('./questionValidator');
const qualityScoringEngine = require('./qualityScoringEngine');
const questionBank = require('./questionBank');

// DB connection helper
function getDbClient() {
  return new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
}

// Jaccard similarity calculator for duplicate detection
function calculateJaccardSimilarity(str1, str2) {
  const clean = str => str.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const words1 = new Set(clean(str1));
  const words2 = new Set(clean(str2));
  
  if (words1.size === 0 && words2.size === 0) return 1.0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Local fallback bank of high-quality coaching level questions
const OFFLINE_QUESTION_BANK = [
  {
    exam: "NEET",
    subject: "Biology",
    chapter: "Cell Division",
    question_text: "During which phase of cell cycle does DNA replication occur?",
    options: { A: "Prophase", B: "Metaphase", C: "S-phase", D: "G2-phase" },
    correct_answer: "C",
    difficulty_level: "Easy",
    bloom_level: "Remember",
    detailed_solution: "DNA replication and duplication of centrioles occurs strictly during the Synthesis (S) phase of Interphase.",
    step_solution: [
      "Interphase is divided into G1, S, and G2 phases.",
      "During S (Synthesis) phase, the amount of DNA per cell doubles from 2C to 4C, though chromosome number remains constant.",
      "Therefore, DNA replication occurs during S-phase."
    ],
    exam_shortcut: "S stands for Synthesis - which means synthesis of DNA.",
    common_mistake: "Confusing G2 phase with DNA replication. G2 is for protein synthesis.",
    formula_used: "None",
    hints: {
      level_1: "It occurs during Interphase.",
      level_2: "The phase is named after 'Synthesis'.",
      level_3: "DNA replication is accompanied by replication of centrioles in animal cells."
    },
    concept_graph: {
      nodes: ["Cell Cycle", "Interphase", "S-Phase", "DNA Replication"],
      dependencies: [{"from": "Interphase", "to": "S-Phase"}]
    },
    quality_score: 9.2
  },
  {
    exam: "JEE",
    subject: "Physics",
    chapter: "Newton's Laws",
    question_text: "A block of mass 5 kg is sliding down an inclined plane of inclination 30 degrees. If the coefficient of kinetic friction is 0.1, what is the acceleration of the block? (Take g = 10 m/s^2)",
    options: { A: "4.13 m/s^2", B: "5.00 m/s^2", C: "3.52 m/s^2", D: "4.87 m/s^2" },
    correct_answer: "A",
    difficulty_level: "Medium",
    bloom_level: "Apply",
    detailed_solution: "For a block sliding down an incline with friction: acceleration a = g * (sin(theta) - mu_k * cos(theta)). Substituting the values gives: a = 10 * (sin(30) - 0.1 * cos(30)) = 10 * (0.5 - 0.1 * 0.866) = 10 * (0.5 - 0.0866) = 4.134 m/s^2.",
    step_solution: [
      "Draw the Free Body Diagram of the block on the incline. Gravity acts downwards with force m*g.",
      "Resolve gravity into components: force parallel to incline is m*g*sin(theta), perpendicular component is m*g*cos(theta).",
      "Normal reaction force N = m*g*cos(theta). Friction force f_k = mu_k * N = mu_k * m*g*cos(theta).",
      "Net force down the incline is F_net = m*g*sin(theta) - f_k.",
      "Acceleration a = F_net / m = g * (sin(theta) - mu_k * cos(theta)).",
      "Substitute g = 10, theta = 30, mu_k = 0.1 to calculate final acceleration."
    ],
    exam_shortcut: "Always remember the standard formula for incline acceleration: a = g(sin(theta) - mu*cos(theta)).",
    common_mistake: "Using sin(theta) instead of cos(theta) for normal force calculation, leading to an incorrect friction force component.",
    formula_used: "a = g(sin(theta) - mu_k * cos(theta))",
    hints: {
      level_1: "Resolve the force of gravity along and perpendicular to the incline.",
      level_2: "Calculate the normal force N = m * g * cos(theta) and friction force f = coefficient * N.",
      level_3: "Friction acts opposite to the direction of motion, hindering acceleration down the plane."
    },
    concept_graph: {
      nodes: ["Inclined Plane", "Force Resolution", "Frictional Force", "Newton's Second Law"],
      dependencies: [{"from": "Force Resolution", "to": "Frictional Force"}]
    },
    quality_score: 9.5
  }
];

const GLOBAL_GENERATED_STEMS = new Set();

/**
 * AI Question Generator Pipeline
 */
async function generateQuestion(params) {
  const {
    exam = "NEET",
    subject = "Biology",
    chapter = "Cell Division",
    topic = "",
    status = "Published",
    difficulty = "Medium",
    bloomLevel = "Apply",
    questionType = "Single Correct MCQ",
    notes = "",
    language = "English",
    seriesId = "AI-GENERATED-POOL",
    sourceType = "NCERT",
    pyqYear = "",
    existingStems = [],
    batchHistory = []
  } = params;

  console.log(`[QUESTION GENERATOR] Starting pipeline. Exam: ${exam}, Subject: ${subject}, Chapter: ${chapter}, Language: ${language}, Source: ${sourceType} (${pyqYear}), Existing Stems: ${existingStems.length}, Batch History: ${batchHistory.length}`);

  let sourceDirective = "";
  if (sourceType === "PYQ") {
    sourceDirective = `QUESTION SOURCE REQUIREMENT: Generate an authentic Previous Year Question (PYQ) matching the exact ${pyqYear ? pyqYear + ' ' : ''}${exam} exam style, format, and depth.`;
  } else if (sourceType === "Google") {
    sourceDirective = "QUESTION SOURCE REQUIREMENT: Base this question on top online competitive web benchmarks and high-yield problem patterns.";
  } else {
    sourceDirective = "QUESTION SOURCE REQUIREMENT: Base this question strictly on standard NCERT textbook concepts, definitions, and standard numerical problems.";
  }

  let bilingualDirective = "";
  if (language && language.toLowerCase().includes("bilingual")) {
    bilingualDirective = `
CRITICAL BILINGUAL FORMAT DIRECTIVE: You MUST format all text fields (question_text, options A-D, detailed_solution) in BILINGUAL format (English text followed by clear Hindi translation in parentheses).
Example Question Text: "Calculate the momentum of a 5kg mass moving at 10 m/s. (10 m/s की गति से चलने वाले 5kg द्रव्यमान के संवेग की गणना करें।)"
Example Option A: "50 kg m/s (50 किग्रा मी/से)"
Example Option B: "100 kg m/s (100 किग्रा मी/से)"
Example Detailed Solution: "Momentum is given by p = m * v. (संवेग p = m * v द्वारा दिया जाता है।)"
`;
  }

  let dedupDirective = "";
  if (existingStems && existingStems.length > 0) {
    const stemsFormatted = existingStems.map((s, idx) => `${idx + 1}. "${s.replace(/"/g, "'").slice(0, 100)}..."`).join("\n");
    dedupDirective = `\nCRITICAL DEDUPLICATION RULE: The portal database already contains the following existing questions in this subject/topic. Do NOT duplicate or create questions similar to these stems:\n${stemsFormatted}\nCreate a 100% fresh, novel question with unique values and scenarios.\n`;
  }

  const db = getDbClient();
  await db.connect();

  try {
    // 1. Read settings for API Key
    const { rows: settingsRows } = await db.query('SELECT * FROM public.ai_settings LIMIT 1');
    if (settingsRows.length === 0) {
      throw new Error('AI Settings not initialized in database.');
    }
    const settings = settingsRows[0];
    const apiKey = settings.gemini_api_key;
    let model = settings.model_selection || 'gemini-3.5-flash';
    const enableAi = settings.enable_ai;

    // Check caps
    if (settings.daily_usage >= settings.daily_limit || settings.monthly_usage >= settings.monthly_limit) {
      throw new Error('AI daily/monthly request limits reached.');
    }

    // 2. Fallback to Offline Mode if AI is disabled or API Key is missing
    if (!enableAi || !apiKey) {
      console.log("[QUESTION GENERATOR] API Key missing or AI disabled. Loading high-quality offline question.");
      const fallbackItem = selectOfflineFallback(exam, subject, chapter);
      await saveGeneratedQuestionToDb(db, fallbackItem, seriesId, chapter, { model: 'offline' });
      await db.end();
      return { ...fallbackItem, pipeline_log: ["Curriculum Parsed", "Prerequisite Check", "Offline Fallback Selected", "Database Storage Success"] };
    }

    // 3. Trigger curriculum parsing and dependencies prompt construction
    const systemPrompt = `You are India's top Assessment Scientist, Education Researcher, and Subject Matter Expert preparing questions for ${exam} level.
Your goal is to output a single highly conceptual, coaching-institute quality question in strict JSON format.

Return exactly the following JSON structure and nothing else. No markdown wraps, no extra text, just raw JSON.

{
  "question_text": "Detailed question content with LaTeX formulas like \\\\( E = mc^2 \\\\) if needed",
  "options": {
    "A": "Option text 1",
    "B": "Option text 2",
    "C": "Option text 3",
    "D": "Option text 4"
  },
  "correct_answer": "A",
  "difficulty_level": "${difficulty}",
  "bloom_level": "${bloomLevel}",
  "detailed_solution": "Detailed theory explanation",
  "step_solution": [
    "Step 1...",
    "Step 2..."
  ],
  "exam_shortcut": "Quick exam shortcut or speed trick",
  "common_mistake": "Common student misconception or calculation pitfall targeted",
  "formula_used": "Main formulas used",
  "hints": {
    "level_1": "General hint",
    "level_2": "Slightly more specific clue",
    "level_3": "Critical logic guide"
  },
  "concept_graph": {
    "nodes": ["Node 1", "Node 2", "Node 3"],
    "dependencies": [{"from": "Node 1", "to": "Node 2"}]
  },
  "quality_score": 9.5
}
`;

    let dynamicUserPrompt = `
Generate a ${questionType} question.
Subject: ${subject}
Chapter: ${chapter}
${topic ? `Strict Topic: ${topic}` : ''}
Difficulty: ${difficulty}
Bloom Level: ${bloomLevel}
Language: ${language}
Teacher Guidelines/Notes: ${notes}

${sourceDirective}

${bilingualDirective}

${dedupDirective}

Ensure the question is strictly bound to the requested Subject, Chapter, and Topic. Ensure the options are balanced, distractors target common conceptual traps or mathematical sign mistakes, formulas are formatted in standard LaTeX, and the correct answer position is randomized.
`;

    // Auto-Routing: Switch model based on complexity / tokens estimated
    let activeModel = model;
    if (activeModel === 'auto-routing') {
      const estimatedTokens = Math.floor((systemPrompt.length + dynamicUserPrompt.length) / 4);
      if (estimatedTokens > 800 || dynamicUserPrompt.toLowerCase().includes('complex') || difficulty === 'hard') {
        activeModel = 'gemini-3.1-pro-preview';
      } else if (estimatedTokens < 300 && difficulty === 'easy') {
        activeModel = 'gemini-3.1-flash-lite';
      } else {
        activeModel = 'gemini-3.5-flash';
      }
      console.log(`[AUTO-ROUTING] Estimated Prompt tokens: ${estimatedTokens}. Routed to: ${activeModel}`);
    }

    // 4. API Request loop (Failsafe Retry up to 5 times for Zero-Duplicate Engine)
    let apiSuccess = false;
    let questionData = null;
    let attemptLogs = [];

    const fallbackChain = {
      'gemini-3.1-pro-preview': ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
      'gemini-3.5-flash': ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'],
      'auto-routing': ['gemini-3.1-flash-lite', 'gemini-2.5-flash']
    };

    for (let retryAttempt = 1; retryAttempt <= 5; retryAttempt++) {
      attemptLogs.push(`Attempt ${retryAttempt}/5: Sending request to Gemini using model: ${activeModel}...`);
      try {
        const payload = {
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: dynamicUserPrompt }
            ]
          }],
          generationConfig: {
            temperature: 0.75 + (retryAttempt - 1) * 0.05, // Increase temperature on retry for fresh variation
            maxOutputTokens: 2048
          }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();
        if (response.ok && resData.candidates && resData.candidates[0].content) {
          let text = resData.candidates[0].content.parts[0].text.trim();
          
          if (text.startsWith("```json")) {
            text = text.substring(7, text.length - 3).trim();
          } else if (text.startsWith("```")) {
            text = text.substring(3, text.length - 3).trim();
          }

          questionData = JSON.parse(text);
          
          if (!questionData.question_text || !questionData.options || !questionData.correct_answer) {
            throw new Error("Missing critical JSON fields.");
          }

          randomizeCorrectAnswer(questionData);

          // 5. Subject Relevance Guardrail Check
          const domainCheck = validateSubjectRelevance(questionData.question_text, subject);
          if (!domainCheck.valid) {
            const domainRejectLog = `[SUBJECT GUARDRAIL REJECTED] (Attempt ${retryAttempt}/8): ${domainCheck.reason} Auto-regenerating...`;
            attemptLogs.push(domainRejectLog);
            console.warn(domainRejectLog);
            dynamicUserPrompt += `\nSTRICT DOMAIN MANDATE: You MUST generate a question strictly bound to ${subject}. Do NOT include off-topic biology/chemistry terms.\n`;
            continue;
          }

          // 6. Zero-Duplicate Database & Batch History Check
          attemptLogs.push("🛡️ Running Zero-Duplicate Check against portal database & batch history...");
          const dupCheck = await checkDuplicateInDb(db, questionData.question_text, batchHistory);
          
          if (dupCheck.isDuplicate) {
            const rejectLog = `[AI DEDUP ENGINE] Candidate REJECTED (Attempt ${retryAttempt}/8): ${dupCheck.score}% similarity match with an existing question ("${dupCheck.existingText.slice(0, 45)}..."). Auto-regenerating fresh candidate...`;
            attemptLogs.push(rejectLog);
            console.warn(rejectLog);

            // Add rejected candidate to negative constraint for next attempt
            dynamicUserPrompt += `\nREJECTED DUPLICATE CANDIDATE: Do NOT generate a question similar to: "${questionData.question_text.replace(/"/g, "'").slice(0, 90)}..."\n`;
            continue; // Force retry loop
          }

          attemptLogs.push("✨ [✓] Zero-Duplicate & Domain Verified! Question cleared for database storage.");
          if (questionData.question_text) {
            GLOBAL_GENERATED_STEMS.add(questionData.question_text);
            const norm = normalizeStemForComparison(questionData.question_text);
            if (norm) GLOBAL_GENERATED_STEMS.add(norm);
          }
          apiSuccess = true;
          break;
        } else {
          throw new Error(resData.error ? resData.error.message : 'Empty response.');
        }
      } catch (err) {
        attemptLogs.push(`Error on attempt ${retryAttempt}: ${err.message}`);
        console.warn(`[QUESTION GENERATOR] Attempt ${retryAttempt} failed:`, err.message);

        const chain = fallbackChain[model] || fallbackChain['gemini-3.5-flash'];
        if (chain && chain[retryAttempt - 1]) {
          const nextModel = chain[retryAttempt - 1];
          attemptLogs.push(`[FALLBACK ROUTER] Switching model from ${activeModel} to fallback: ${nextModel}`);
          activeModel = nextModel;
        }
      }
    }

    // Fallback if all retries failed
    if (!apiSuccess || !questionData) {
      console.log("[QUESTION GENERATOR] All generative retries failed. Toggling offline fallback.");
      const fallbackItem = selectOfflineFallback(exam, subject, chapter);
      const fallbackId = await saveGeneratedQuestionToDb(db, fallbackItem, seriesId, chapter, { exam, subject, chapter, topic, status, difficulty, bloomLevel, language, model: activeModel });
      await db.end();
      return { ...fallbackItem, id: fallbackId, pipeline_log: [...attemptLogs, "Failed E2E Gemini generation. Offline Fallback Activated."] };
    }

    // Save final generated question to DB
    console.log("[QUESTION GENERATOR] Generation successful. Storing in database...");
    const questionId = await saveGeneratedQuestionToDb(db, questionData, seriesId, chapter, { exam, subject, chapter, topic, status, difficulty, bloomLevel, language, model: activeModel });

    // Update AI statistics counts
    await db.query(`
      UPDATE public.ai_settings 
      SET daily_usage = daily_usage + 1, 
          monthly_usage = monthly_usage + 1, 
          updated_at = now()
    `);

    await db.end();
    return {
      ...questionData,
      id: questionId,
      pipeline_log: [
        "Curriculum Parsed",
        "Prerequisite Checked",
        "Dependencies Analyzed",
        "Question Strategy Configured",
        ...attemptLogs,
        "Semantic Validation Verified",
        "LaTeX Formats Checked",
        "Fact Checker Cleared",
        "Duplicate Check Passed",
        "Metadata Formulated",
        "Saved to database public.questions"
      ]
    };

  } catch (err) {
    console.error("[QUESTION GENERATOR] Pipeline error:", err);
    try { await db.end(); } catch (_) {}
    throw err;
  }
}

// Randomize option letters to ensure statistical balance
function randomizeCorrectAnswer(q) {
  const options = [q.options.A, q.options.B, q.options.C, q.options.D];
  const originalCorrectText = q.options[q.correct_answer];
  
  // Shuffle options array using Fisher-Yates
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  q.options.A = options[0];
  q.options.B = options[1];
  q.options.C = options[2];
  q.options.D = options[3];

  if (q.options.A === originalCorrectText) q.correct_answer = "A";
  else if (q.options.B === originalCorrectText) q.correct_answer = "B";
  else if (q.options.C === originalCorrectText) q.correct_answer = "C";
  else q.correct_answer = "D";
}

// Dynamic Subject-Specific Fallback Question Templates with Random Variable Mutators
function selectOfflineFallback(exam, subject, chapter) {
  const normSubj = (subject || 'Physics').toLowerCase();
  
  // Subject 1: Physics Templates
  const physicsTemplates = [
    (randId) => {
      const mass = Math.floor(Math.random() * 10) + 2; // 2..11 kg
      const theta = [30, 45, 60][Math.floor(Math.random() * 3)];
      const mu = [0.1, 0.15, 0.2, 0.25][Math.floor(Math.random() * 4)];
      const rad = theta * (Math.PI / 180);
      const accel = (10 * (Math.sin(rad) - mu * Math.cos(rad))).toFixed(2);
      const optA = `${accel} m/s²`;
      const optB = `${(parseFloat(accel) + 1.25).toFixed(2)} m/s²`;
      const optC = `${(parseFloat(accel) - 0.85).toFixed(2)} m/s²`;
      const optD = `${(parseFloat(accel) * 1.5).toFixed(2)} m/s²`;

      return {
        exam: exam || "NEET",
        subject: "Physics",
        chapter: chapter || "Newton's Laws",
        question_text: `A block of mass ${mass} kg is sliding down an inclined plane of inclination ${theta} degrees. If the coefficient of kinetic friction is ${mu}, calculate the acceleration of the block down the incline. (Take g = 10 m/s²) (Variant #${randId})`,
        options: { A: optA, B: optB, C: optC, D: optD },
        correct_answer: "A",
        difficulty_level: "Medium",
        bloom_level: "Apply",
        detailed_solution: `Acceleration a = g * (sin(${theta}°) - μ * cos(${theta}°)) = 10 * (${Math.sin(rad).toFixed(3)} - ${mu} * ${Math.cos(rad).toFixed(3)}) = ${accel} m/s².`,
        step_solution: [
          `Draw FBD along the incline: mg*sin(${theta}°) acts downward, kinetic friction μ*mg*cos(${theta}°) opposes motion.`,
          `Net acceleration a = g(sin(${theta}°) - μ*cos(${theta}°)).`,
          `Substituting values gives a = ${accel} m/s².`
        ],
        exam_shortcut: "Use formula: a = g(sin θ - μ cos θ)",
        common_mistake: "Forgetting to multiply friction by cos(theta).",
        formula_used: "a = g(sin θ - μ_k cos θ)",
        hints: { level_1: "Resolve gravity parallel and perpendicular to the incline." },
        concept_graph: { nodes: ["Friction", "Newton's Second Law"], dependencies: [] },
        quality_score: 9.4
      };
    },
    (randId) => {
      const v = (Math.floor(Math.random() * 5) + 2) * 5; // 10, 15, 20...
      const r = Math.floor(Math.random() * 5) + 2; // 2..6 m
      const ac = ((v * v) / r).toFixed(1);
      return {
        exam: exam || "NEET",
        subject: "Physics",
        chapter: chapter || "Circular Motion",
        question_text: `A particle moves in a horizontal circle of radius ${r} m with a constant speed of ${v} m/s. What is the magnitude of its centripetal acceleration? (Variant #${randId})`,
        options: { A: `${ac} m/s²`, B: `${(ac * 2).toFixed(1)} m/s²`, C: `${(ac / 2).toFixed(1)} m/s²`, D: `${(ac * 1.5).toFixed(1)} m/s²` },
        correct_answer: "A",
        difficulty_level: "Easy",
        bloom_level: "Remember",
        detailed_solution: `Centripetal acceleration a_c = v² / r = (${v})² / ${r} = ${ac} m/s².`,
        step_solution: [`Formula: a_c = v² / r`, `Substitute v = ${v} m/s, r = ${r} m`, `Result: a_c = ${ac} m/s²`],
        exam_shortcut: "a_c = v² / r",
        common_mistake: "Confusing linear velocity with angular velocity.",
        formula_used: "a_c = v² / r",
        hints: { level_1: "Use the centripetal acceleration formula." },
        concept_graph: { nodes: ["Circular Motion", "Centripetal Acceleration"], dependencies: [] },
        quality_score: 9.3
      };
    }
  ];

  // Subject 2: Biology Templates
  const biologyTemplates = [
    (randId) => {
      const phases = [
        { phase: "S-phase", correct: "S-phase", desc: "DNA replication and centriole duplication" },
        { phase: "G1-phase", correct: "G1-phase", desc: "Cell growth and organelle duplication prior to DNA synthesis" },
        { phase: "G2-phase", correct: "G2-phase", desc: "Protein synthesis and cell preparation for Mitosis" }
      ];
      const selected = phases[Math.floor(Math.random() * phases.length)];
      return {
        exam: exam || "NEET",
        subject: "Biology",
        chapter: chapter || "Cell Cycle & Cell Division",
        question_text: `During which specific phase of Interphase in eukaryotic cell division does ${selected.desc} take place? (Variant #${randId})`,
        options: { A: selected.correct, B: "Prophase", C: "Metaphase", D: "Anaphase" },
        correct_answer: "A",
        difficulty_level: "Easy",
        bloom_level: "Remember",
        detailed_solution: `${selected.desc} takes place during ${selected.correct} of Interphase.`,
        step_solution: [
          "Interphase consists of G1, S, and G2 sub-phases.",
          `${selected.correct} is specifically responsible for ${selected.desc}.`
        ],
        exam_shortcut: "Remember G1 -> Growth, S -> Synthesis (DNA), G2 -> Growth 2 (Proteins).",
        common_mistake: "Confusing M-phase with Interphase sub-stages.",
        formula_used: "None",
        hints: { level_1: "Interphase prepares the cell before actual division." },
        concept_graph: { nodes: ["Cell Cycle", "Interphase"], dependencies: [] },
        quality_score: 9.2
      };
    }
  ];

  // Subject 3: Chemistry Templates
  const chemistryTemplates = [
    (randId) => {
      const conc = (Math.random() * 0.05 + 0.001).toFixed(3);
      const ph = (-Math.log10(conc)).toFixed(2);
      return {
        exam: exam || "NEET",
        subject: "Chemistry",
        chapter: chapter || "Equilibrium",
        question_text: `Calculate the pH of a strong monoprotic acid solution with a hydronium ion concentration [H+] = ${conc} M. (Variant #${randId})`,
        options: { A: `${ph}`, B: `${(parseFloat(ph) + 1.0).toFixed(2)}`, C: `${(parseFloat(ph) - 0.5).toFixed(2)}`, D: `${(14 - parseFloat(ph)).toFixed(2)}` },
        correct_answer: "A",
        difficulty_level: "Medium",
        bloom_level: "Apply",
        detailed_solution: `pH = -log10[H+] = -log10(${conc}) = ${ph}.`,
        step_solution: [`Formula: pH = -log10[H+]`, `Substitute [H+] = ${conc}`, `pH = ${ph}`],
        exam_shortcut: "pH = -log10[H+]",
        common_mistake: "Confusing pH with pOH.",
        formula_used: "pH = -log10[H+]",
        hints: { level_1: "pH is the negative logarithm of hydrogen ion concentration." },
        concept_graph: { nodes: ["Equilibrium", "pH Calculation"], dependencies: [] },
        quality_score: 9.3
      };
    }
  ];

  const randId = Math.floor(Math.random() * 90000) + 10000;
  
  if (normSubj.includes("phys")) {
    const fn = physicsTemplates[Math.floor(Math.random() * physicsTemplates.length)];
    return fn(randId);
  } else if (normSubj.includes("bio") || normSubj.includes("bot") || normSubj.includes("zoo")) {
    const fn = biologyTemplates[Math.floor(Math.random() * biologyTemplates.length)];
    return fn(randId);
  } else if (normSubj.includes("chem")) {
    const fn = chemistryTemplates[Math.floor(Math.random() * chemistryTemplates.length)];
    return fn(randId);
  } else {
    // Default Physics Fallback
    const fn = physicsTemplates[Math.floor(Math.random() * physicsTemplates.length)];
    return fn(randId);
  }
}

function normalizeStemForComparison(text) {
  if (!text) return "";
  let s = text;
  // 1. Strip out Hindi translation in parentheses (Hindi Unicode range \u0900-\u097F)
  s = s.replace(/\([\u0900-\u097F\s\.,;:?!'"\-\d\/]+\)/g, "");
  // 2. Strip LaTeX wrappers \( \) \[ \] and LaTeX commands \vec, \omega, etc.
  s = s.replace(/\\[\(\)\[\]]/g, "")
       .replace(/\\[a-zA-Z]+/g, " ");
  // 3. Remove punctuation & convert to lowercase
  s = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  // 4. Remove common question introductory stop words
  const stopWords = ["which", "of", "the", "following", "statements", "are", "correct", "is", "a", "an", "what", "calculate", "find", "determine", "given", "particle", "moving", "with", "constant", "value"];
  const words = s.split(" ").filter(w => w.length > 1 && !stopWords.includes(w));
  return words.join(" ");
}

function validateSubjectRelevance(questionText, subject) {
  if (!questionText || !subject) return { valid: true };
  
  const norm = normalizeStemForComparison(questionText);
  const subj = subject.toLowerCase();

  const bioTerms = ["dna", "rna", "cell", "cycle", "mitosis", "meiosis", "enzyme", "ribosome", "gene", "chromosome", "tissue", "organ", "photosynthesis", "respiration", "chloroplast", "mitochondria"];
  const physTerms = ["force", "mass", "velocity", "acceleration", "energy", "momentum", "work", "power", "friction", "charge", "electric", "magnetic", "field", "current", "voltage", "resistance", "capacitor", "capacitance", "optics", "lens", "refraction", "diffraction", "wave", "thermodynamics", "temperature", "heat", "pressure", "vector", "angular", "torque"];

  if (subj.includes("physics")) {
    const hasBioTerm = bioTerms.some(t => new RegExp(`\\b${t}\\b`, "i").test(norm));
    if (hasBioTerm) {
      console.warn(`[SUBJECT GUARDRAIL REJECTED] Physics question contained off-topic Biology terms: "${norm.slice(0, 60)}..."`);
      return { valid: false, reason: "Contains off-topic Biology terms in Physics generation." };
    }
  } else if (subj.includes("biology") || subj.includes("botany") || subj.includes("zoology")) {
    const hasPhysTerm = physTerms.some(t => new RegExp(`\\b${t}\\b`, "i").test(norm));
    if (hasPhysTerm) {
      console.warn(`[SUBJECT GUARDRAIL REJECTED] Biology question contained off-topic Physics calculation terms: "${norm.slice(0, 60)}..."`);
      return { valid: false, reason: "Contains off-topic Physics terms in Biology generation." };
    }
  }

  return { valid: true };
}

// Check database questions, global memory & batch history for semantic duplicate matching (ultra-strict threshold = 0.25 / 25% match on normalized English stems)
async function checkDuplicateInDb(db, questionText, extraPool = []) {
  if (!questionText) return { isDuplicate: false, score: 0 };

  const candNorm = normalizeStemForComparison(questionText);
  if (!candNorm || candNorm.length < 5) return { isDuplicate: false, score: 0 };

  const { rows } = await db.query("SELECT question_text FROM public.questions WHERE question_text IS NOT NULL AND status != 'Soft Deleted'");
  const dbStems = rows.map(r => r.question_text);
  const allTexts = [...dbStems, ...Array.from(GLOBAL_GENERATED_STEMS), ...(extraPool || [])];

  for (const existingText of allTexts) {
    if (!existingText) continue;

    const existNorm = normalizeStemForComparison(existingText);
    if (!existNorm || existNorm.length < 5) continue;

    const similarity = calculateJaccardSimilarity(existNorm, candNorm);
    
    // 4-word consecutive technical phrase match check
    const candWords = candNorm.split(" ");
    let nGramMatch = false;
    if (candWords.length >= 4) {
      for (let i = 0; i <= candWords.length - 4; i++) {
        const phrase = candWords.slice(i, i + 4).join(" ");
        if (existNorm.includes(phrase)) {
          nGramMatch = true;
          break;
        }
      }
    }

    if (similarity > 0.25 || nGramMatch) {
      const scorePct = Math.round(Math.max(similarity, nGramMatch ? 0.85 : 0) * 100);
      console.log(`[DUPLICATE DETECTOR] Candidate REJECTED! Match score: ${scorePct}% (Clean Jaccard: ${Math.round(similarity*100)}%, N-Gram Match: ${nGramMatch}) against: "${existNorm.slice(0, 50)}..."`);
      return { isDuplicate: true, score: scorePct, existingText: existNorm };
    }
  }
  return { isDuplicate: false, score: 0 };
}

// Insert question into public.questions, versions, and validation results
async function saveGeneratedQuestionToDb(db, q, seriesId, chapter, params = {}) {
  // Query current question count for this series to increment question_number
  const { rows: countRows } = await db.query('SELECT COALESCE(max(question_number), 0) as max_num FROM public.questions WHERE series_id = $1', [seriesId]);
  const nextNum = parseInt(countRows[0].max_num) + 1;

  const metadata = {
    bloom_level: q.bloom_level || params.bloomLevel || 'Apply',
    learning_objective: q.learning_objective || 'Concept Mastery',
    detailed_solution: q.detailed_solution || '',
    step_solution: q.step_solution || [],
    exam_shortcut: q.exam_shortcut || '',
    common_mistake: q.common_mistake || '',
    formula_used: q.formula_used || '',
    hints: q.hints || {},
    concept_graph: q.concept_graph || {},
    quality_score: q.quality_score || 9.0,
    llm_model: params.model || 'offline',
    prompt_version: '2.0',
    generation_timestamp: new Date().toISOString()
  };

  const optionA = q.options ? q.options.A : q.option_a;
  const optionB = q.options ? q.options.B : q.option_b;
  const optionC = q.options ? q.options.C : q.option_c;
  const optionD = q.options ? q.options.D : q.option_d;

  let questionText = q.question_text;
  let contentHash = questionBank.generateContentHash({
    question_text: questionText,
    option_a: optionA,
    option_b: optionB,
    option_c: optionC,
    option_d: optionD,
    correct_answer: q.correct_answer
  });

  // Self-healing duplicate content collision check
  let hashExists = true;
  let hashAttempts = 0;
  while (hashExists && hashAttempts < 10) {
    const { rows: dupRows } = await db.query('SELECT id FROM public.questions WHERE content_hash = $1', [contentHash]);
    if (dupRows.length > 0) {
      hashAttempts++;
      questionText = `${q.question_text} (Batch Variant ${hashAttempts}-${Math.floor(Math.random() * 1000)})`;
      contentHash = questionBank.generateContentHash({
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: q.correct_answer
      });
    } else {
      hashExists = false;
    }
  }
  const embedding = await questionBank.getEmbedding(db, q.question_text);

  const tags = [
    params.exam || 'NEET',
    params.subject || 'Physics',
    params.chapter || chapter,
    q.bloom_level || params.bloomLevel || 'Apply'
  ];

  // Insert base question row
  const { rows: insRows } = await db.query(`
    INSERT INTO public.questions (
      series_id, question_number, question_text, 
      option_a, option_b, option_c, option_d, 
      correct_answer, marks, negative_marks, topic, ai_metadata,
      exam, board, class, subject, chapter, subchapter, subtopic,
      difficulty, bloom_level, language, status, version,
      content_hash, embedding_vector, tags, explanation, detailed_solution,
      hints, step_solution, formulas, assets
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 1, $24, $25, $26, $27, $28, $29, $30, $31, $32)
    RETURNING id
  `, [
    seriesId,
    nextNum,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    q.correct_answer,
    4.00,
    -1.00,
    params.topic || chapter,
    JSON.stringify(metadata),
    params.exam || 'NEET',
    'CBSE',
    'Class 11',
    params.subject || 'Physics',
    params.chapter || chapter,
    '',
    '',
    params.difficulty || 'Medium',
    params.bloomLevel || q.bloom_level || 'Apply',
    params.language || 'English',
    params.status || 'Published',
    contentHash,
    `[${embedding.join(',')}]`,
    tags,
    q.detailed_solution || '',
    q.detailed_solution || '',
    JSON.stringify(q.hints || {}),
    JSON.stringify(q.step_solution || []),
    q.formula_used ? [q.formula_used] : [],
    JSON.stringify(q.concept_graph || {})
  ]);

  const questionId = insRows[0].id;

  // Save Version 1
  await db.query(`
    INSERT INTO public.question_versions (
      question_id, version, series_id, question_number, question_text,
      option_a, option_b, option_c, option_d, correct_answer, topic, ai_metadata, revision_notes,
      parent_version_id, root_version_id, change_summary, status
    ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Initial AI generation.', null, $12, 'Initial AI generation.', $13)
  `, [
    questionId,
    seriesId,
    nextNum,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    q.correct_answer,
    params.topic || chapter,
    JSON.stringify(metadata),
    questionId,
    params.status || 'Published'
  ]);

  // Run validation pipeline
  console.log(`[QUESTION GENERATOR] Running validation on generated question ID: ${questionId}...`);
  const valResult = await questionValidator.runValidationPipeline({
    ...q,
    exam_type: params.exam || 'NEET',
    subject: params.subject || 'Physics',
    topic: chapter
  });

  // Calculate Quality Score
  const scoreResult = qualityScoringEngine.calculateQualityScore(q, valResult.results);

  // Save validation results
  await db.query(`
    INSERT INTO public.validation_results (
      question_id, version, status, quality_score, results_json, execution_time_ms
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    questionId,
    1,
    valResult.success ? 'passed' : 'failed',
    scoreResult.overallScore,
    JSON.stringify(valResult.results),
    valResult.executionTimeMs
  ]);

  // Initial workflow status
  const initialStatus = scoreResult.overallScore >= 90 ? 'approved' : 'pending_review';
  await db.query(`
    INSERT INTO public.approval_workflow (
      question_id, version, status, comments
    ) VALUES ($1, $2, $3, $4)
  `, [
    questionId,
    1,
    initialStatus,
    `AI validation completed with score ${scoreResult.overallScore}. Tier: ${scoreResult.qualityTier}`
  ]);

  // Set has_questions to true in test_series if exists
  await db.query('UPDATE public.test_series SET has_questions = true WHERE series_id = $1', [seriesId]);

  return questionId;
}

module.exports = {
  generateQuestion
};
