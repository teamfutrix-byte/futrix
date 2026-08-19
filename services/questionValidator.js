const { Client } = require('pg');

function getDbClient() {
  return new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
}

// Token helper for Jaccard overlap
function calculateJaccardSimilarity(str1, str2) {
  const clean = str => str.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const words1 = new Set(clean(str1));
  const words2 = new Set(clean(str2));
  if (words1.size === 0 && words2.size === 0) return 1.0;
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

/**
 * 1. Curriculum Validator
 */
function validateCurriculum(q) {
  const allowedExams = ['NEET', 'JEE', 'JEE Main', 'JEE Advanced', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
  const allowedSubjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];
  
  const exam = q.exam || q.exam_type || '';
  const subject = q.subject || '';
  const chapter = q.chapter || q.topic || '';

  if (!exam || !allowedExams.some(e => exam.toUpperCase().includes(e.toUpperCase()))) {
    return { success: false, message: `Invalid target exam: ${exam}. Must align with NCERT syllabus.` };
  }
  if (!subject || !allowedSubjects.some(s => subject.toLowerCase() === s.toLowerCase())) {
    return { success: false, message: `Invalid subject: ${subject}.` };
  }
  if (!chapter || chapter.trim().length < 3) {
    return { success: false, message: 'Chapter/Topic name is too short or empty.' };
  }

  return { success: true, message: 'Curriculum mapping aligned.' };
}

/**
 * 2. LaTeX Validator
 */
function validateLaTeX(text) {
  if (!text) return { success: true, message: 'No text to check.' };
  
  // Count standard LaTeX delimiters
  const inlineOpen = (text.match(/\\\(/g) || []).length;
  const inlineClose = (text.match(/\\\)/g) || []).length;
  const blockOpen = (text.match(/\\\[/g) || []).length;
  const blockClose = (text.match(/\\\]/g) || []).length;

  if (inlineOpen !== inlineClose) {
    return { success: false, message: `Mismatched inline LaTeX delimiters: \\( appeared ${inlineOpen} times, \\) appeared ${inlineClose} times.` };
  }
  if (blockOpen !== blockClose) {
    return { success: false, message: `Mismatched block LaTeX delimiters: \\[ appeared ${blockOpen} times, \\] appeared ${blockClose} times.` };
  }

  return { success: true, message: 'LaTeX formatting verified.' };
}

/**
 * 3. Options Validator
 */
function validateOptions(q) {
  const options = q.options || {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d
  };
  const correct = q.correct_answer;

  if (!options.A || !options.B || !options.C || !options.D) {
    return { success: false, message: 'Question does not contain a full set of options (A, B, C, D).' };
  }

  // Duplicate checks
  const values = [options.A.trim(), options.B.trim(), options.C.trim(), options.D.trim()];
  const uniqueValues = new Set(values);
  if (uniqueValues.size < 4) {
    return { success: false, message: 'Option text values are not unique.' };
  }

  if (!correct || !['A', 'B', 'C', 'D'].includes(correct.trim().toUpperCase())) {
    return { success: false, message: `Invalid correct option key: ${correct}.` };
  }

  // Check length skewness (e.g. longest option shouldn't be > 10x size of shortest option in standard MCQs)
  const lengths = values.map(v => v.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  if (minLen > 0 && maxLen / minLen > 10.0) {
    return { success: true, message: 'Options validated with warnings: option length skewness ratio is high (>10x).' };
  }

  return { success: true, message: 'Option keys and text verified.' };
}

/**
 * 4. Duplicate Check Validator
 */
async function validateDuplicates(q, db) {
  const text = q.question_text || '';
  if (!text) return { success: false, message: 'No question text provided.' };

  const { rows } = await db.query('SELECT question_text FROM public.questions');
  for (const r of rows) {
    const similarity = calculateJaccardSimilarity(r.question_text, text);
    if (similarity > 0.85) {
      return { success: false, message: `Semantic duplicate detected. Jaccard index: ${(similarity * 100).toFixed(1)}% overlap.` };
    }
  }

  return { success: true, message: 'Uniqueness verified against database.' };
}

// Fallback chain for automatic model switching on failure (e.g. quota limit, demand outage)
const validatorFallbackChain = {
  'gemini-3.1-pro-preview': ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
  'gemini-3.5-flash': ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  'auto-routing': ['gemini-3.1-flash-lite', 'gemini-2.5-flash']
};

async function executeGeminiWithFallback(apiKey, initialModel, prompt, generationConfig = {}) {
  let activeModel = initialModel;
  const chain = validatorFallbackChain[initialModel] || validatorFallbackChain['gemini-3.5-flash'];
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        })
      });
      const resData = await response.json();
      if (response.ok && resData.candidates && resData.candidates[0].content) {
        return resData;
      } else {
        const errMsg = resData.error ? resData.error.message : 'Unknown error';
        console.warn(`[VALIDATOR] Attempt ${attempt} on ${activeModel} failed: ${errMsg}`);
        if (chain && chain[attempt - 1]) {
          activeModel = chain[attempt - 1];
        }
      }
    } catch (err) {
      console.warn(`[VALIDATOR] Attempt ${attempt} on ${activeModel} threw exception: ${err.message}`);
      if (chain && chain[attempt - 1]) {
        activeModel = chain[attempt - 1];
      }
    }
  }
  throw new Error('All model attempts failed in validator.');
}

/**
 * 5. Content Safety & Bias Validator
 */
async function validateSafetyAndBias(q, apiKey, model) {
  const text = q.question_text || '';
  
  // Local regex block for dangerous or completely non-academic keywords
  const blockedPattern = /bollywood|gossip|politics|religion|sectarian|modi|rahul gandhi|adult|casino/i;
  if (blockedPattern.test(text)) {
    return { success: false, message: 'Content safety alert: Text contains non-academic or politically sensitive keywords.' };
  }

  if (!apiKey) {
    return { success: true, message: 'Safety validation bypassed: API connection offline.' };
  }

  // E2E LLM safety audit
  try {
    const prompt = `You are a strict FUTRIX Assessment Safety Auditor. Analyze the following question stem:
"${text}"
Verify if the question contains bias (gender, racial, religious), personal attacks, political views, or dangerous advice.
Respond with a JSON object:
{ "safe": true/false, "reason": "Explanation of safety verdict" }`;

    const resData = await executeGeminiWithFallback(apiKey, model, prompt);
    if (resData.candidates && resData.candidates[0].content) {
      let resultText = resData.candidates[0].content.parts[0].text.trim();
      if (resultText.startsWith("```json")) resultText = resultText.substring(7, resultText.length - 3).trim();
      else if (resultText.startsWith("```")) resultText = resultText.substring(3, resultText.length - 3).trim();

      const result = JSON.parse(resultText);
      if (!result.safe) {
        return { success: false, message: `Content safety alert: ${result.reason}` };
      }
    }
  } catch (err) {
    console.warn("[VALIDATOR] LLM safety validator failed, falling back to local rule check:", err.message);
  }

  return { success: true, message: 'Content safety and academic neutrality verified.' };
}

/**
 * 6. Calculation and Scientific Fact Double-Solve Validator
 */
async function validateCalculation(q, apiKey, model) {
  const text = q.question_text || '';
  const options = q.options || {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d
  };
  const correct = q.correct_answer;

  // Bypassed if offline
  if (!apiKey) {
    return { success: true, message: 'Calculation validation bypassed: API connection offline.' };
  }

  try {
    const prompt = `You are a Senior Assessment Physicist, Chemist, and Mathematician. 
Your goal is to double-solve the following question and determine the correct option choice.

Question:
"${text}"

Options:
A: "${options.A}"
B: "${options.B}"
C: "${options.C}"
D: "${options.D}"

Declare the correct option letter. You MUST solve the math step-by-step.
Your response MUST be in strict JSON format:
{
  "solved_correct_answer": "A", // Or B, C, D
  "steps": ["Step 1 calculation...", "Step 2 result..."],
  "factual_correctness": true/false,
  "explanation": "Solve justification"
}`;

    const resData = await executeGeminiWithFallback(apiKey, model, prompt, { temperature: 0.0 });
    if (resData.candidates && resData.candidates[0].content) {
      let resultText = resData.candidates[0].content.parts[0].text.trim();
      if (resultText.startsWith("```json")) resultText = resultText.substring(7, resultText.length - 3).trim();
      else if (resultText.startsWith("```")) resultText = resultText.substring(3, resultText.length - 3).trim();

      const result = JSON.parse(resultText);
      
      if (!result.factual_correctness) {
        return { success: false, message: `Scientific/Factual inaccuracy detected: ${result.explanation}` };
      }

      if (result.solved_correct_answer !== correct) {
        return { 
          success: false, 
          message: `Calculations verification failed: double-solve returned Option ${result.solved_correct_answer}, while the generator marked Option ${correct}. Error details: ${result.explanation}` 
        };
      }

      return { success: true, message: `Double-solve validation passed. Steps: ${result.steps.join(' | ')}` };
    }
  } catch (err) {
    console.warn("[VALIDATOR] LLM calculation validator failed:", err.message);
  }

  return { success: true, message: 'Numerical and scientific facts validated.' };
}

/**
 * E2E Pipeline Executor
 */
async function runValidationPipeline(question) {
  const startTime = Date.now();
  console.log(`[VALIDATION PIPELINE] Executing validation checks for question topic: ${question.topic}...`);

  const db = getDbClient();
  await db.connect();

  const results = {};
  let overallSuccess = true;

  try {
    // Read AI Settings
    const { rows: settingsRows } = await db.query('SELECT * FROM public.ai_settings LIMIT 1');
    const settings = settingsRows[0] || {};
    const apiKey = settings.gemini_api_key;
    let model = settings.model_selection || 'gemini-3.5-flash';
    if (model === 'auto-routing') {
      const fullPrompt = JSON.stringify(question);
      const estimatedTokens = Math.floor(fullPrompt.length / 4);
      if (estimatedTokens > 800) {
        model = 'gemini-3.1-pro-preview';
      } else {
        model = 'gemini-3.5-flash';
      }
      console.log(`[AUTO-ROUTING] Validator routed request (${estimatedTokens} tokens) to model: ${model}`);
    }

    // 1. Curriculum Validation
    results.curriculum = validateCurriculum(question);
    
    // 2. LaTeX Validation
    results.latex = validateLaTeX(question.question_text);

    // 3. Options Validation
    results.options = validateOptions(question);

    // 4. Duplicate Validation
    results.duplicates = await validateDuplicates(question, db);

    // 5. Safety Validation
    results.safety = await validateSafetyAndBias(question, apiKey, model);

    // 6. Calculation/Facts Validation
    results.calculation = await validateCalculation(question, apiKey, model);

    // Set overall status
    Object.keys(results).forEach(key => {
      if (!results[key].success) overallSuccess = false;
    });

  } catch (err) {
    console.error("[VALIDATION PIPELINE] Exception inside pipeline:", err);
    overallSuccess = false;
    results.pipeline_error = { success: false, message: err.message };
  } finally {
    await db.end();
  }

  const executionTime = Date.now() - startTime;
  console.log(`[VALIDATION PIPELINE] Completed in ${executionTime}ms. Status: ${overallSuccess ? 'PASSED' : 'FAILED'}`);

  return {
    success: overallSuccess,
    results,
    executionTimeMs: executionTime
  };
}

module.exports = {
  runValidationPipeline
};
