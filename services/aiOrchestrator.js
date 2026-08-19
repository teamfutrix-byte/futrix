const { Client } = require('pg');

// Direct DB connection helper matching server.js
function getDbClient() {
  return new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
}

/**
 * Main Orchestration Pipeline
 */
async function runPipeline({ userId, userRole, query, language = 'English', screen = 'general', feature = 'mentor_chat', subject = '', chapter = '', sessionId = 'session_default' }) {
  console.log(`[AI ORCHESTRATOR] Starting pipeline. User: ${userId} (${userRole}), Screen: ${screen}, Feature: ${feature}`);

  // 1. Permission Validation
  const targetRole = determineTargetRole(screen, feature, userRole);
  validatePermissions(userRole, targetRole);

  const db = getDbClient();
  await db.connect();

  try {
    // 2. Fetch User & Performance Context
    const profile = await fetchUserProfile(db, userId);
    const goals = await fetchUserGoals(db, userId);
    const performance = await fetchUserPerformance(db, userId);
    const memory = await fetchMemoryStats(db, userId, profile.xp_balance || 0);
    const conversationSummary = await fetchConversationHistorySummary(db, userId);

    // Assemble dynamic context package
    const context = {
      role: profile.role || userRole || 'student',
      screen: screen,
      feature: feature,
      subject: subject || performance.subject || '',
      chapter: chapter || performance.chapter || '',
      targetExam: goals.target_exam || 'NEET 2027',
      targetScore: goals.target_score || '550',
      league: profile.league || calculateLeague(profile.xp_balance || 0),
      rank: profile.rank || performance.rank || '1',
      xp: profile.xp_balance || 0,
      retentionScore: memory.retentionScore,
      memoryHealth: memory.memoryHealth,
      recentTestsCount: performance.attemptsCount,
      accuracy: performance.accuracy,
      weakTopics: performance.weakTopics,
      strongTopics: performance.strongTopics,
      preferredLanguage: language || profile.preferred_language || 'English',
      subscriptionStatus: profile.is_pro ? 'PRO' : 'FREE',
      instituteId: profile.institute_id || 'FUTRIX Internal',
      teacherId: profile.teacher_id || 'Not assigned',
      season: 'Season 2026',
      learningGoal: goals.recommended_track || 'Syllabus mastery',
      timeOfDay: getTimeContext(),
      previousSummary: conversationSummary
    };

    // Build language instruction for Gemini
    const langInstruction = context.preferredLanguage !== 'English'
      ? `\n\n[LANGUAGE INSTRUCTION] You MUST reply ENTIRELY in ${context.preferredLanguage} language. Do NOT switch to English. Even technical terms should be explained in ${context.preferredLanguage}.`
      : '';

    // 3. Prompt Generator (Builds System Prompt & User prompt payload)
    const systemPrompt = generateSystemPrompt(targetRole, context) + langInstruction;
    const userPrompt = `Context Screen: ${screen}\nContext Feature: ${feature}\nSubject: ${context.subject}\nChapter: ${context.chapter}\nReply Language: ${context.preferredLanguage}\nQuestion Prompt: ${query}${langInstruction}`;

    // 4. Resolve prompt key and execute via AI Gateway
    const aiGateway = require('./aiGateway');
    let promptKey = feature;
    if (feature === 'mentor_chat') promptKey = 'tutor_chat';
    if (feature === 'question_generator') promptKey = 'question_generation';

    const variables = {
      student_name: context.studentName || 'Student',
      topic: context.subject || context.chapter || 'General Study',
      language: context.preferredLanguage || 'English',
      class: context.targetExam,
      subject: context.subject,
      chapter: context.chapter,
      question_count: 1,
      difficulty: 'medium',
      question_text: query,
      correct_answer: 'A'
    };

    const gatewayResult = await aiGateway.executeComplete(db, promptKey, userId, variables);
    await db.end();

    return {
      response: gatewayResult.response,
      latency: gatewayResult.latencyMs,
      model: gatewayResult.modelUsed,
      success: true
    };
  } catch (error) {
    console.error('[AI ORCHESTRATOR] Pipeline error:', error);
    try { await db.end(); } catch (_) {}
    throw error;
  }
}

/**
 * Determine target role based on context
 */
function determineTargetRole(screen, feature, userRole) {
  if (screen === 'admin-dashboard' || feature === 'admin_report' || userRole === 'admin') {
    return 'SUPER_ADMIN_AI';
  }
  if (screen === 'teacher-dashboard' || feature === 'classroom_analysis' || userRole === 'teacher') {
    return 'TEACHER_AI';
  }
  if (screen === 'revision' || feature === 'memory_trick' || feature === 'mnemonic') {
    return 'MEMORY_LAB_AI';
  }
  if (screen === 'leaderboard' || screen === 'arena' || feature === 'competition_motivate') {
    return 'AI_COMPETITOR_COACH';
  }
  return 'STUDENT_AI_MENTOR';
}

/**
 * Enforce role-based permission locks
 */
function validatePermissions(userRole, targetRole) {
  if (targetRole === 'SUPER_ADMIN_AI' && userRole !== 'admin') {
    const err = new Error('Access denied. Super Admin role credentials required.');
    err.status = 403;
    throw err;
  }
  if (targetRole === 'TEACHER_AI' && userRole !== 'teacher' && userRole !== 'admin') {
    const err = new Error('Access denied. Teacher credentials required.');
    err.status = 403;
    throw err;
  }
}

/**
 * Context Builder Helper: Profiles
 */
async function fetchUserProfile(db, userId) {
  const { rows } = await db.query('SELECT * FROM public.profiles WHERE id = $1', [userId]);
  return rows[0] || {};
}

/**
 * Context Builder Helper: Goals
 */
async function fetchUserGoals(db, userId) {
  const { rows } = await db.query('SELECT * FROM public.user_goals WHERE user_id = $1', [userId]);
  return rows[0] || {};
}

/**
 * Context Builder Helper: Performance & Weak/Strong Topics
 */
async function fetchUserPerformance(db, userId) {
  const { rows: attempts } = await db.query('SELECT * FROM public.attempts WHERE user_id = $1', [userId]);
  const attemptsCount = attempts.length;

  let correct = 0;
  let wrong = 0;
  const topicsMap = {};

  attempts.forEach(a => {
    correct += parseInt(a.correct_answers || 0);
    wrong += parseInt(a.wrong_answers || 0);
    
    // Track topics
    const subj = a.subject || 'General';
    if (!topicsMap[subj]) topicsMap[subj] = { correct: 0, total: 0 };
    topicsMap[subj].correct += parseInt(a.correct_answers || 0);
    topicsMap[subj].total += (parseInt(a.correct_answers || 0) + parseInt(a.wrong_answers || 0));
  });

  const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 70;

  const weakTopics = [];
  const strongTopics = [];
  Object.keys(topicsMap).forEach(t => {
    const acc = topicsMap[t].total > 0 ? (topicsMap[t].correct / topicsMap[t].total) * 100 : 100;
    if (acc < 60) weakTopics.push(t);
    else strongTopics.push(t);
  });

  // Calculate dynamic rank context (rank based on total profile count with higher XP)
  const { rows: rankRows } = await db.query(`
    SELECT count(*) FROM public.profiles 
    WHERE role = 'student' AND xp_balance > (SELECT xp_balance FROM public.profiles WHERE id = $1)
  `, [userId]);
  const rank = String(parseInt(rankRows[0]?.count || 0) + 1);

  return {
    attemptsCount,
    accuracy,
    weakTopics: weakTopics.join(', ') || 'None identified yet',
    strongTopics: strongTopics.join(', ') || 'All standard categories',
    rank
  };
}

/**
 * Context Builder Helper: Memory Stats
 */
async function fetchMemoryStats(db, userId, xp) {
  const { rows: queue } = await db.query('SELECT count(*) FROM public.revision_queue WHERE user_id = $1', [userId]);
  const queueCount = parseInt(queue[0]?.count || 0);

  const retentionScore = Math.max(10, Math.min(100, Math.round(85 + (xp / 1000) - (queueCount * 1.5))));
  const memoryHealth = retentionScore > 80 ? 'Excellent' : (retentionScore > 50 ? 'Good' : 'Needs Review');

  return { retentionScore, memoryHealth };
}

/**
 * Context Builder Helper: Last 3 conversations to build Summary
 */
async function fetchConversationHistorySummary(db, userId) {
  const { rows } = await db.query(`
    SELECT query, response FROM public.ai_logs 
    WHERE user_id = $1 AND success = true
    ORDER BY created_at DESC LIMIT 3
  `, [userId]);

  if (rows.length === 0) return 'No previous conversations recorded.';
  
  return rows.map((l, i) => `Query ${i+1}: "${l.query}" -> Summary: Answered educational doubt about ${l.query.substring(0, 40)}`).join('\n');
}

/**
 * Calculate League based on XP thresholds
 */
function calculateLeague(xp) {
  if (xp >= 75000) return 'Legend';
  if (xp >= 30000) return 'Diamond';
  if (xp >= 10000) return 'Gold';
  if (xp >= 25000) return 'Silver';
  return 'Bronze';
}

/**
 * Time Context
 */
function getTimeContext() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return 'Morning';
  if (hr >= 12 && hr < 17) return 'Afternoon';
  if (hr >= 17 && hr < 21) return 'Evening';
  return 'Night';
}

/**
 * Prompt Generator
 */
function generateSystemPrompt(role, ctx) {
  let roleDesc = '';
  let allowed = '';
  let forbidden = '';
  let style = '';

  switch (role) {
    case 'STUDENT_AI_MENTOR':
      roleDesc = 'You are FUTRIX AI Mentor. Help students prepare for competitive exams. Focus on Concept Clarity, Problem Solving, Study Planning, Revision Planning, Motivation, Exam Strategy, Retention, and Confidence Building.';
      allowed = 'Physics, Chemistry, Biology, Mathematics, NEET, JEE, Study Techniques, Revision, Time Management, Memory Improvement, and FUTRIX Platform Features.';
      forbidden = 'Politics, Religion, Movies, Entertainment, Relationships, General Chat, Programming, Business Advice, Medical Advice, Legal Advice, Investment, and Current Affairs unrelated to competitive exams.';
      style = 'Simple, highly motivating, structured, and step-by-step.';
      break;

    case 'MEMORY_LAB_AI':
      roleDesc = 'You are FUTRIX Memory Coach. Focus exclusively on improving memory, retention, and revision quality.';
      allowed = 'Generate Flashcards, Create Mnemonics, Suggest Memory Tricks, Create Recall Questions, Identify Forgetting Patterns, Optimize Revision Schedule, Recommend Weak Topic Revision, Generate Formula Cards, Biology Visual Memory Hints, Chemistry Reaction Memory Tricks, and Physics Concept Recall Cards.';
      forbidden = 'Any unrelated academic questions, programming doubts, general chat, movies, entertainment, politics, or religion.';
      style = 'Interactive, short, crisp, and easy to remember.';
      break;

    case 'TEACHER_AI':
      roleDesc = 'You are FUTRIX Teacher Assistant. Help teachers understand classroom/batch performance and plan interventions.';
      allowed = 'Batch Analysis, Weak Topic Detection, Student Comparison, Performance Trends, Attendance Insights, Improvement Suggestions, Difficulty Analysis, Test Quality Review, and Parent Friendly Reports.';
      forbidden = 'Business operations advice, super admin dashboard actions, student direct academic doubts, or general non-educational discussions.';
      style = 'Professional, analytical, and actionable.';
      break;

    case 'SUPER_ADMIN_AI':
      roleDesc = 'You are FUTRIX Business Intelligence AI. Help administrators manage and grow the FUTRIX platform.';
      allowed = 'Growth Analysis, Revenue Analytics, User Engagement, Retention Analytics, Feature Usage, AI Usage Logs Analytics, Payment Insights, Institute Growth, Season Analysis, Fraud Detection, Referral Analytics, and Performance Reports.';
      forbidden = 'Student academic doubts, physics/chemistry/biology questions, teacher classroom direct counseling, or generic non-FUTRIX topics.';
      style = 'Business Focused, data-driven, and summary-oriented.';
      break;

    case 'AI_COMPETITOR_COACH':
      roleDesc = 'You are FUTRIX Competitor Coach. Focus entirely on pushing students towards consistency, competitive habits, and rank improvements.';
      allowed = 'Daily Motivation, Competition Analysis, League Suggestions, Rank Improvement, Habit Building, Target Planning, and Consistency Tracking.';
      forbidden = 'Any demotivating remarks, negative comparisons, general chat unrelated to learning, politics, movies, or religion.';
      style = 'Highly motivating, positive, positive educational push.';
      break;
  }

  return `
[SYSTEM IDENTITY]
${roleDesc}

[ALLOWED TOPICS & TASKS]
Only answer queries related to: ${allowed}

[FORBIDDEN TOPICS]
NEVER answer questions about: ${forbidden}
If a query touches a forbidden topic, refuse politely with: "I am ${role === 'STUDENT_AI_MENTOR' ? 'FUTRIX AI Mentor' : 'FUTRIX ' + role.replace(/_/g, ' ')}. I can only assist with allowed educational parameters."

[EXPECTED OUTPUT STYLE]
Style: ${style}
Format: Clean Markdown with bold highlights. Do not use plain text placeholders.

[HALLUCINATION GUARD]
If you are uncertain about factual data or do not have enough context details, output exactly: "I am not confident enough to answer this accurately. Please verify this information."

[LIVE USER PROFILE CONTEXT INJECTED]
- User Role: ${ctx.role}
- Subscription: ${ctx.subscriptionStatus}
- Stream: ${ctx.stream || 'NEET'}
- Target Exam: ${ctx.targetExam} (Score Goal: ${ctx.targetScore})
- Diagnostic Welcome Score: ${ctx.targetScore}
- Memory XP: ${ctx.xp} XP
- Current League: ${ctx.league} (Rank: ${ctx.rank})
- Memory Health Meter: ${ctx.memoryHealth} (Retention Score: ${ctx.retentionScore}%)
- Weak Topics: ${ctx.weakTopics}
- Strong Topics: ${ctx.strongTopics}
- Streak & Goals: ${ctx.learningGoal}
- Time Context: ${ctx.timeOfDay} (Local)
- Previous Conversation Summary:
${ctx.previousSummary}
`;
}

/**
 * Post-generation Validator and Formatter
 */
function validateAndFormatResponse(role, text, query) {
  const textLower = text.toLowerCase();
  const qLower = query.toLowerCase();

  // Basic check for forbidden topic leaks
  const studentForbidden = ['politics', 'religion', 'movies', 'entertainment', 'relationships', 'programming', 'javascript', 'python', 'code error'];
  
  if (role === 'STUDENT_AI_MENTOR' || role === 'MEMORY_LAB_AI') {
    let leaked = false;
    for (const kw of studentForbidden) {
      if (qLower.includes(kw) || (textLower.includes(kw) && !query.toLowerCase().includes(kw))) {
        leaked = true;
        break;
      }
    }

    if (leaked) {
      return `I am FUTRIX AI Mentor. I can help you with competitive exam preparation, revision, learning strategies and FUTRIX features.`;
    }
  }

  // Hallucination filter
  if (text.includes("uncertain") || textLower.includes("i do not know") || textLower.includes("i'm not sure")) {
    return "I am not confident enough to answer this accurately. Please verify this information.";
  }

  return text.trim();
}

/**
 * Local Offline Fallback Engine matching role restrictions
 */
function getLocalFallbackResponse(role, query, notice = '') {
  const prefix = notice ? `*[Notice: ${notice}]*\n\n` : '';
  const q = query.toLowerCase();

  // 1. Hallucination guard filter inside fallback
  if (q.includes('uncertain') || q.includes('not sure') || q.includes('do not know')) {
    return "I am not confident enough to answer this accurately. Please verify this information.";
  }

  // 2. Safety filter inside fallback
  const studentForbidden = ['politics', 'religion', 'movies', 'entertainment', 'relationships', 'programming', 'javascript', 'python', 'code error'];
  for (const kw of studentForbidden) {
    if (q.includes(kw)) {
      return "I am FUTRIX AI Mentor. I can help you with competitive exam preparation, revision, learning strategies and FUTRIX features.";
    }
  }

  switch (role) {
    case 'STUDENT_AI_MENTOR':
      return prefix + "I am FUTRIX AI Mentor. Focus on: \n\n1. Concept Clarity (NCERT standard).\n2. Solve 20 MCQ daily on FUTRIX.\n3. Track performance accuracy inside your profile.";

    case 'MEMORY_LAB_AI':
      return prefix + "I am FUTRIX Memory Coach. Try these memory tricks:\n\n* **Mnemonic**: Use abbreviations or rhymes (e.g. VIBGYOR).\n* **Visual Hints**: Associate biological structures with daily objects.\n* **Spaced repetition**: Schedule revisions on Day 1, 3, and 7.";

    case 'TEACHER_AI':
      return prefix + "I am FUTRIX Teacher Assistant. Review class topic metrics inside the directory and assign remedial worksheets to students whose average test score falls below 60%.";

    case 'SUPER_ADMIN_AI':
      return prefix + "I am FUTRIX Business Intelligence AI. Current platform engagement is stable. Ensure proctor sandbox configuration is enabled globally.";

    case 'AI_COMPETITOR_COACH':
      return prefix + "I am FUTRIX Competitor Coach. Stay consistent! Keep solving questions to maintain your streak, level up your league, and secure a higher rank.";
  }

  return prefix + "I can assist you with FUTRIX-related educational topics. Please ask a specific question!";
}

module.exports = {
  runPipeline
};
