// Futrix Supabase client integration
const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

// Save the library reference first!
const lib = window.supabase;
var supabase = null;

if (typeof window !== 'undefined') {
  // Session Security Check: Purge persistent logins if browser was closed and "Remember Me" was NOT checked
  const isRememberMe = localStorage.getItem('futrix_remember_me') === 'true';
  const isTabActive = sessionStorage.getItem('futrix_tab_active') === 'true';

  if (!isTabActive && !isRememberMe) {
    sessionStorage.clear();
    localStorage.removeItem('futrix_user');
    localStorage.removeItem('futrix_token');
    localStorage.removeItem('sb-dsduytkikxfgiyptdwex-auth-token');
  }
  sessionStorage.setItem('futrix_tab_active', 'true');

  // Global fetch interceptor to swap mock JWTs with the valid anon key on direct Supabase REST calls
  const originalFetch = window.fetch;
  window.fetch = async function(resource, options) {
    if (typeof resource === 'string') {
      if (resource.startsWith('/api/') && typeof getApiUrl === 'function') {
        resource = getApiUrl(resource);
      }
      if (resource.includes('supabase.co')) {
        if (options && options.headers) {
          let authHeader = null;
          if (options.headers instanceof Headers) {
            authHeader = options.headers.get('Authorization');
          } else {
            authHeader = options.headers['Authorization'] || options.headers['authorization'];
          }
          
          if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes(SUPABASE_ANON_KEY)) {
            if (options.headers instanceof Headers) {
              options.headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
            } else {
              options.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
              if (options.headers['authorization']) {
                options.headers['authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
              }
            }
          }
        }
      }
    }
    return originalFetch.call(this, resource, options);
  };

  if (lib && typeof lib.createClient === 'function') {
    supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    if (supabase && supabase.auth) {
      const originalGetSession = supabase.auth.getSession;
      supabase.auth.getSession = async () => {
        try {
          const res = await originalGetSession.call(supabase.auth);
          if (res.data && res.data.session) return res;
        } catch (_) {}
        
        const user = JSON.parse(sessionStorage.getItem('futrix_user') || '{}');
        if (user.id) {
          // Dynamic JWT encoder to satisfy GoTrue client parsing
          const base64url = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
          const payload = base64url(JSON.stringify({
            sub: user.id,
            email: user.email,
            role: 'authenticated',
            app_metadata: { provider: 'email', role: user.role },
            user_metadata: { full_name: user.name },
            exp: Math.floor(Date.now() / 1000) + 315360000 // 10 years
          }));
          const token = `${header}.${payload}.dummysignature`;
          sessionStorage.setItem('futrix_token', token);
          
          return {
            data: {
              session: {
                access_token: token,
                user: {
                  id: user.id,
                  email: user.email,
                  user_metadata: { full_name: user.name }
                }
              }
            },
            error: null
          };
        }
        return { data: { session: null }, error: null };
      };
      
      if (supabase.rest && supabase.rest.headers) {
        supabase.rest.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      }
    }

    if (supabase && typeof supabase.from === 'function') {
      const originalFrom = supabase.from;
      supabase.from = function(table) {
        const builder = originalFrom.call(supabase, table);
        if (builder && builder.headers) {
          builder.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
        }
        return builder;
      };
    }

    window.supabase = supabase;
    window.supabaseClient = supabase;
  } else if (!window.supabaseClient) {
    console.error('Supabase library is not loaded. Please ensure the CDN script is included.');
  }
}

// ── UTILITY FUNCTIONS ──

/**
 * Log audit events to Supabase for security tracking
 * @param {string} action - The event action type
 * @param {object} details - Additional meta info (JSON)
 */
async function logAuditEvent(action, details = {}) {
  try {
    if (!supabase) return;
    const session = await getCachedSession();
    const userId = session ? session.id : null;

    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action: action,
      details: details,
      ip_address: 'client'
    });

    if (error) console.error('Failed to log audit event:', error);
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}

/**
 * Log AI Mentorship Queries to Supabase
 * @param {string} query - The prompt asked
 * @param {string} response - The model reply
 * @param {number} tokens - Tokens consumed (approx)
 */
async function logAiUsage(query, response, tokens = 0) {
  try {
    if (!supabase) return;
    const session = await getCachedSession();
    const userId = session ? session.id : null;
    const role = session ? (session.role || 'student') : 'student';

    const { error } = await supabase.from('ai_logs').insert({
      user_id: userId,
      role: role,
      query: query,
      response: response,
      tokens_used: tokens
    });

    if (error) console.error('Failed to log AI usage:', error);
  } catch (err) {
    console.error('Error logging AI usage:', err);
  }
}

/**
 * Get active session, checking Supabase Auth and fallback to sessionStorage
 */
async function getCachedSession() {
  if (!supabase) return null;
  
  // Try Supabase auth session first
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    // Fetch profile role and XP
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profile) {
      const normalizedPrep = (profile.preparation_for || 'NEET').toUpperCase().includes('NEET') ? 'NEET' : ((profile.preparation_for || '').toUpperCase().includes('JEE') ? 'JEE' : profile.preparation_for);
      const userObj = {
        id: session.user.id,
        name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        xp: parseFloat(profile.xp_balance),
        referralXp: parseFloat(profile.referral_xp),
        preparation: normalizedPrep,
        unlockedLevel: parseInt(profile.unlocked_level || 1),
        role: profile.role || 'student',
        is_pro: profile.is_pro
      };
      
      // Update sessionStorage for compatibility
      sessionStorage.setItem('futrix_user', JSON.stringify(userObj));
      sessionStorage.setItem('futrix_token', session.access_token);
      return userObj;
    }
  }

  // Fallback to legacy sessionStorage
  const legacy = sessionStorage.getItem('futrix_user');
  return legacy ? JSON.parse(legacy) : null;
}

function getApiUrl(path) {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000' + path;
    }
  }
  return 'https://futrix-backend-7ly8.onrender.com' + path;
}

/**
 * Sign in user using Email and Phone (acting as password)
 */
async function signInUser(email, phone) {
  let cleanEmail = (email || '').trim();
  const cleanPass = (phone || '').trim();



  // 1. Try backend authentication endpoint
  try {
    const apiRes = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: cleanPass })
    });
    const apiData = await apiRes.json();
    if (apiRes.ok && apiData.success && apiData.user) {
      sessionStorage.setItem('futrix_user', JSON.stringify(apiData.user));
      sessionStorage.setItem('futrix_token', apiData.token || 'mock-admin-token');
      await logAuditEvent('Login', { email: cleanEmail });
      return apiData.user;
    } else if (apiRes.status === 403 && apiData.error && apiData.error.includes('Account Blocked')) {
      throw new Error(apiData.error);
    }
  } catch (apiErr) {
    if (apiErr.message && apiErr.message.includes('Account Blocked')) {
      throw apiErr;
    }
    console.warn('[SIGN IN] Backend auth fallback notice:', apiErr);
  }

  // 2. Try direct Supabase GoTrue Auth
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPass
  });

  if (error) throw error;

  if (data.session) {
    sessionStorage.setItem('futrix_token', data.session.access_token);
  }

  // Retrieve user details from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;

  if (profile.is_blocked === true || profile.is_blocked === 'true') {
    throw new Error(`Account Blocked: ${profile.block_reason || 'Suspended due to security policy violation'}`);
  }

  if (profile.role === 'student' && profile.email_verified !== true) {
    throw new Error('Email not confirmed');
  }

  const normalizedPrep = (profile.preparation_for || 'NEET').toUpperCase().includes('NEET') ? 'NEET' : ((profile.preparation_for || '').toUpperCase().includes('JEE') ? 'JEE' : profile.preparation_for);
  const userObj = {
    id: data.user.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    xp: parseFloat(profile.xp_balance || 0),
    referralXp: parseFloat(profile.referral_xp || 0),
    preparation: normalizedPrep,
    unlockedLevel: parseInt(profile.unlocked_level || 1),
    role: profile.role || 'student',
    is_pro: profile.is_pro
  };

  sessionStorage.setItem('futrix_user', JSON.stringify(userObj));
  await logAuditEvent('Login', { email: cleanEmail });

  // Log active login session to session_logs for Founder KPIs dashboard
  try {
    await supabase.from('session_logs').insert({
      user_id: data.user.id
    });
  } catch (err) {
    console.warn('Failed to log active session:', err.message || err);
  }

  return userObj;
}

/**
 * Sign out user
 */
async function signOutUser() {
  await logAuditEvent('Logout');
  sessionStorage.clear();
  localStorage.removeItem('futrix_user');
  localStorage.removeItem('futrix_token');
  localStorage.removeItem('futrix_remember_me');
  localStorage.removeItem('sb-dsduytkikxfgiyptdwex-auth-token');
  if (supabase && supabase.auth) {
    try { await supabase.auth.signOut(); } catch (_) {}
  }
}

/**
 * Register a new user (inserts into auth and trigger handles profiles)
 */
async function signUpUser(fullName, email, phone, prepType, instituteName) {
  if (!supabase) throw new Error('Supabase client not initialized');

  // Resolve institute UUID from name
  let instituteId = null;
  if (instituteName) {
    const { data: inst } = await supabase
      .from('institutes')
      .select('id')
      .eq('name', instituteName)
      .single();
    if (inst) {
      instituteId = inst.id;
    } else {
      // Create institute if it doesn't exist
      const { data: newInst } = await supabase
        .from('institutes')
        .insert({ name: instituteName })
        .select('id')
        .single();
      if (newInst) instituteId = newInst.id;
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: phone,
    options: {
      data: {
        full_name: fullName,
        preparation_for: prepType,
        phone: phone,
        institute_id: instituteId
      }
    }
  });

  if (error) throw error;

  // Sometimes handle_new_user trigger works immediately, verify profile exists
  // If profile is missing, create it manually (handles cases where trigger is slow or disabled)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .single();

  if (!existingProfile) {
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      email: email,
      phone: phone,
      preparation_for: prepType,
      institute_id: instituteId,
      xp_balance: 100.00
    });
    if (profileErr) console.error('Manual profile fallback error:', profileErr);
  }

  // Create initial transaction reward of 100 XP
  await supabase.from('xp_transactions').insert({
    user_id: data.user.id,
    amount: 100.00,
    transaction_type: 'registration'
  });

  await logAuditEvent('Registration', { email, fullName });
  return data.user;
}

// ── LEAGUE UTILITIES ──

/**
 * Returns the correct league representation based on XP balance
 */
function getLeague(xp) {
  if (xp < 2500) return { name: 'Bronze', nextMin: 2500, min: 0 };
  if (xp < 10000) return { name: 'Silver', nextMin: 10000, min: 2500 };
  if (xp < 30000) return { name: 'Gold', nextMin: 30000, min: 10000 };
  if (xp < 75000) return { name: 'Diamond', nextMin: 75000, min: 30000 };
  return { name: 'Legend', nextMin: null, min: 75000 };
}

// ── DATABASE HELPERS FOR SERIES, ATTEMPTS & PVP ──

async function getSupabaseSeriesList(userId) {
  if (!supabase) return [];
  // Fetch test series
  const { data: series, error: sErr } = await supabase
    .from('test_series')
    .select('*')
    .eq('status', 'active');
  
  if (sErr) {
    console.error('Error fetching series list:', sErr);
    return [];
  }

  // Fetch attempts for this user
  const { data: attempts, error: aErr } = await supabase
    .from('attempts')
    .select('*')
    .eq('user_id', userId);
  
  const attemptedMap = new Map();
  if (attempts) {
    attempts.forEach(att => {
      attemptedMap.set(att.series_id, att);
    });
  }

  // Fetch transactions for this user to check unlocked tests
  const { data: txs } = await supabase
    .from('xp_transactions')
    .select('reference_id')
    .eq('user_id', userId)
    .eq('transaction_type', 'admin_adjustment');

  const unlockedSeriesIds = new Set();
  if (txs) {
    txs.forEach(t => {
      if (t.reference_id) unlockedSeriesIds.add(t.reference_id);
    });
  }

  // Fetch profile to check is_pro status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .single();
  const isPro = profile ? profile.is_pro : false;

  // Combine
  return series.map(s => {
    const attempt = attemptedMap.get(s.series_id);
    const isFree = parseFloat(s.price || 0) === 0;
    const isUnlocked = isFree || isPro || unlockedSeriesIds.has(s.series_id);

    return {
      seriesId: s.series_id,
      examType: s.exam_type,
      topicChapter: s.topic_chapter,
      topic: s.topic_chapter, // compat mapping
      durationMinutes: s.duration_minutes,
      duration: s.duration_minutes, // compat mapping
      xpReward: s.xp_reward,
      xp: s.xp_reward, // compat mapping
      maxMarks: s.max_marks,
      testType: s.test_type,
      price: parseFloat(s.price),
      hasQuestions: s.has_questions,
      isAttempted: !!attempt,
      isUnlocked: isUnlocked,
      isFree: isFree,
      score: attempt ? parseFloat(attempt.score) : null,
      xpEarned: attempt ? parseFloat(attempt.xp_earned) : null,
      disqualified: attempt ? attempt.disqualified : false
    };
  });
}

async function getSupabaseLeaderboard() {
  if (!supabase) return [];
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('full_name, email, xp_balance, preparation_for')
    .eq('role', 'student')
    .order('xp_balance', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
  return profiles.map(p => ({
    name: p.full_name,
    email: p.email,
    xp: parseFloat(p.xp_balance),
    preparation: p.preparation_for
  }));
}

async function getSupabasePerformance(userId) {
  if (!supabase) return [];
  const { data: attempts, error } = await supabase
    .from('attempts')
    .select('*, test_series(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching performance attempts:', error);
    return [];
  }
  return attempts.map(a => ({
    seriesId: a.series_id,
    topicChapter: a.test_series ? a.test_series.topic_chapter : 'Unknown Topic',
    score: parseFloat(a.score),
    maxMarks: a.test_series ? a.test_series.max_marks : 720,
    correctAnswers: a.correct_answers,
    wrongAnswers: a.wrong_answers,
    skippedAnswers: a.skipped_answers,
    timeTakenSeconds: a.time_taken_seconds,
    xpEarned: parseFloat(a.xp_earned),
    disqualified: a.disqualified,
    disqualifyReason: a.disqualify_reason,
    createdAt: a.created_at
  }));
}

async function saveSupabaseAttempt(userId, seriesId, correct, wrong, skipped, score, xpEarned, timeTaken, options = {}) {
  try {
    const res = await fetch('/api/student/save-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        seriesId,
        correct,
        wrong,
        skipped,
        score,
        xpEarned,
        timeTaken,
        options
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save attempt.');
    return { attempt: data.attempt, profile: data.profile };
  } catch (err) {
    console.error('Error in saveSupabaseAttempt backend bridge:', err);
    throw err;
  }
}

async function updateStudentLevel(userId, nextLevel) {
  if (!supabase) return;
  await supabase.from('profiles').update({
    unlocked_level: nextLevel
  }).eq('id', userId);
}

// ── SUPABASE PVP BATTLE ENGINE HELPERS ──

async function createSupabaseBattle(creatorId, opponentEmail, difficulty, stream) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('full_name, email, xp_balance, unlocked_level')
    .eq('id', creatorId)
    .single();

  if (!creatorProfile) throw new Error('Creator profile not found');

  const unlockedLvl = parseInt(creatorProfile.unlocked_level || 1);
  const match = String(difficulty || '').match(/\d+/);
  const challengeLvl = match ? (parseInt(match[0]) || 1) : 1;

  if (challengeLvl > unlockedLvl) {
    throw new Error(`Challenge Level ${challengeLvl} is locked! Pass level ${unlockedLvl} first.`);
  }

  let opponentId = null;
  if (opponentEmail) {
    const { data: oppProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', opponentEmail)
      .single();
    if (oppProfile) opponentId = oppProfile.id;
    else throw new Error('Opponent email is not registered with FUTRIX.');
  }

  const levelNum = challengeLvl;
  let qCount = 10;
  if (levelNum >= 1 && levelNum <= 4) qCount = 10;
  else if (levelNum >= 5 && levelNum <= 8) qCount = 12;
  else if (levelNum >= 9 && levelNum <= 12) qCount = 14;
  else if (levelNum >= 13 && levelNum <= 16) qCount = 16;
  else if (levelNum >= 17 && levelNum <= 19) qCount = 18;
  else if (levelNum >= 20) qCount = 20;

  // Query questions matching the exam stream
  const streamKeyword = (stream || '').toUpperCase().trim().replace(' PREP', '');
  const { data: allQuestions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .or(`exam.eq.${streamKeyword},exam.eq.${streamKeyword} Prep,topic.eq.${streamKeyword} Prep`);

  if (qErr) throw qErr;

  let pool = allQuestions || [];
  if (pool.length === 0) {
    // If questions count is 0, fetch any questions from database as fallback
    const { data: fallbackQuestions } = await supabase
      .from('questions')
      .select('*')
      .limit(60);
    pool = fallbackQuestions || [];
  }

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selectedQuestions = pool.slice(0, Math.min(qCount, pool.length)).map((q, idx) => ({
    questionNumber: idx + 1,
    question: q.question_text,
    optionA: q.option_a,
    optionB: q.option_b,
    optionC: q.option_c,
    optionD: q.option_d,
    correct: q.correct_answer,
    marks: parseFloat(q.marks || 4),
    negative: parseFloat(q.negative_marks || -1),
    seriesId: q.series_id
  }));

  if (selectedQuestions.length === 0) {
    throw new Error('No questions found in questions database.');
  }

  const { data: battle, error: bErr } = await supabase
    .from('battles')
    .insert({
      creator_id: creatorId,
      opponent_id: opponentId,
      level_num: levelNum,
      stream: stream,
      status: 'pending',
      questions_list: selectedQuestions
    })
    .select()
    .single();

  if (bErr) throw bErr;

  await logAuditEvent('PvPChallengeCreated', { battleId: battle.id, opponentEmail });
  return battle;
}

async function acceptSupabaseBattle(battleId, challengerId) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data: battle } = await supabase
    .from('battles')
    .select('status, creator_id')
    .eq('id', battleId)
    .single();

  if (!battle) throw new Error('Battle not found');
  if (battle.status !== 'pending') throw new Error('Battle is no longer pending');
  if (battle.creator_id === challengerId) throw new Error('You cannot accept your own challenge');

  const { error } = await supabase
    .from('battles')
    .update({
      opponent_id: challengerId,
      status: 'active'
    })
    .eq('id', battleId);

  if (error) throw error;

  await logAuditEvent('PvPChallengeAccepted', { battleId });
  return true;
}

async function cancelSupabaseBattle(battleId, userId) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data: battle } = await supabase
    .from('battles')
    .select('*, creator_profiles:creator_id(email, xp_balance), opponent_profiles:opponent_id(email, xp_balance)')
    .eq('id', battleId)
    .single();

  if (!battle) throw new Error('Battle not found');
  if (battle.status === 'completed' || battle.status === 'cancelled') {
    throw new Error('Battle is already completed or cancelled');
  }

  if (battle.creator_id !== userId) {
    throw new Error('Only the creator can cancel this challenge');
  }

  const { error } = await supabase
    .from('battles')
    .update({ status: 'cancelled' })
    .eq('id', battleId);

  if (error) throw error;

  // Deduct 50 XP penalty from creator
  const creator = battle.creator_profiles;
  if (creator) {
    const newXp = Math.max(0, parseFloat(creator.xp_balance) - 50);
    await supabase.from('profiles').update({ xp_balance: newXp }).eq('id', battle.creator_id);
    await supabase.from('xp_transactions').insert({
      user_id: battle.creator_id,
      amount: -50.00,
      transaction_type: 'battle_cancellation',
      reference_id: battleId
    });
  }

  // Award +20 XP opponent benefit if was active
  if (battle.status === 'active' && battle.opponent_id) {
    const opp = battle.opponent_profiles;
    if (opp) {
      const oppNewXp = parseFloat(opp.xp_balance) + 20;
      await supabase.from('profiles').update({ xp_balance: oppNewXp }).eq('id', battle.opponent_id);
      await supabase.from('xp_transactions').insert({
        user_id: battle.opponent_id,
        amount: 20.00,
        transaction_type: 'battle_opponent_compensation',
        reference_id: battleId
      });
    }
  }

  await logAuditEvent('PvPChallengeCancelled', { battleId });
  return true;
}

async function deleteSupabaseBattle(battleId, userId) {
  if (!supabase) throw new Error('Supabase client not initialized');
  
  try {
    await cancelSupabaseBattle(battleId, userId);
  } catch(e) {}

  const { error } = await supabase
    .from('battles')
    .delete()
    .eq('id', battleId);

  if (error) throw error;
  return true;
}

async function getSupabaseBattles(userId, userEmail, stream) {
  if (!supabase) return [];

  const { data: battles, error } = await supabase
    .from('battles')
    .select('*, creator_profiles:creator_id(full_name, email), opponent_profiles:opponent_id(full_name, email)')
    .or(`status.eq.pending,status.eq.active,status.eq.completed,status.eq.cancelled`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching battles:', error);
    return [];
  }

  const { data: attempts } = await supabase
    .from('attempts')
    .select('score, user_id, question_navigation_log');

  const attemptsMap = new Map();
  if (attempts) {
    attempts.forEach(a => {
      const navLog = a.question_navigation_log;
      if (navLog && navLog.battleId) {
        attemptsMap.set(`${navLog.battleId}_${a.user_id}`, a);
      }
    });
  }

  const result = [];
  battles.forEach(b => {
    const creatorName = b.creator_profiles ? b.creator_profiles.full_name : 'Creator';
    const creatorEmail = b.creator_profiles ? b.creator_profiles.email : '';
    const opponentName = b.opponent_profiles ? b.opponent_profiles.full_name : '';
    const opponentEmail = b.opponent_profiles ? b.opponent_profiles.email : '';

    const creatorAttempt = attemptsMap.get(`${b.id}_${b.creator_id}`);
    const opponentAttempt = b.opponent_id ? attemptsMap.get(`${b.id}_${b.opponent_id}`) : null;

    const creatorScore = creatorAttempt ? parseFloat(creatorAttempt.score) : null;
    const opponentScore = opponentAttempt ? parseFloat(opponentAttempt.score) : null;

    const isCreator = creatorEmail.toLowerCase() === userEmail.toLowerCase();
    const isOpponent = opponentEmail.toLowerCase() === userEmail.toLowerCase();
    const isOpenPending = !b.opponent_id && b.status === 'pending' && !isCreator && (b.stream || '').toUpperCase() === (stream || '').toUpperCase();

    if (isCreator || isOpponent || isOpenPending) {
      result.push({
        battleId: b.id,
        creatorEmail: creatorEmail,
        creatorName: creatorName,
        challengerEmail: opponentEmail,
        challengerName: opponentName,
        seriesId: 'PvP Battle - ' + b.id.substring(0, 8),
        creatorScore: creatorScore,
        challengerScore: opponentScore,
        status: b.status,
        timestamp: b.created_at,
        difficulty: 'level_' + b.level_num,
        stream: b.stream
      });
    }
  });

  return result;
}

/**
 * Fetch all exam categories/streams from Supabase
 */
async function getExamCategories() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('exam_categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching exam categories:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception fetching exam categories:', err);
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.getExamCategories = getExamCategories;
  window.signInUser = signInUser;
  window.signUpUser = signUpUser;
  window.signOutUser = signOutUser;

  // Initialize central profile & settings manager
  initStudentProfileManager();
}

function initStudentProfileManager() {
  // Prevent double initialization
  if (window.__futrixProfileManagerInitialized) return;
  window.__futrixProfileManagerInitialized = true;

  // Wait for DOM to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runManager);
  } else {
    runManager();
  }

  async function runManager() {
    // 1. Session check: only run on dashboard pages if user is logged in
    const userStr = sessionStorage.getItem('futrix_user');
    if (!userStr) return;

    let currentUser = null;
    try {
      currentUser = JSON.parse(userStr);
    } catch (e) {
      console.warn('[PROFILE] Session invalid');
      return;
    }

    if (!currentUser || !currentUser.id) return;

    // 2. Inject CSS Styles
    injectStyles();

    // 3. Inject HTML Elements (Dropdown, Modals)
    injectHTML(currentUser);

    // 4. Load Profile details from database
    let profileData = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (data) {
        profileData = data;
        syncAvatarAndDetails(profileData);
      }
    } catch (err) {
      console.warn('[PROFILE] Failed to fetch database profile:', err);
    }

    // 5. Setup event bindings
    setupEventHandlers(currentUser, profileData);
  }

  function injectStyles() {
    const css = `
      /* Dropdown Menu */
      .profile-dropdown-menu {
        position: fixed;
        top: 60px;
        right: 2rem;
        width: 270px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 1.1rem;
        backdrop-filter: blur(15px);
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
        color: #fff;
        z-index: 100000;
        display: none;
        flex-direction: column;
        gap: 0.75rem;
        transform: translateY(-8px);
        opacity: 0;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      }
      .profile-dropdown-menu.show {
        display: flex;
        transform: translateY(0);
        opacity: 1;
      }
      .dropdown-user-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .dropdown-user-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--primary, #38bdf8);
        color: #fff;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        overflow: hidden;
      }
      .dropdown-user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .dropdown-user-text {
        overflow: hidden;
      }
      .dropdown-username {
        font-weight: 700;
        font-size: 0.88rem;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dropdown-useremail {
        font-size: 0.75rem;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dropdown-item-btn {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.6rem 0.75rem;
        border: none;
        background: none;
        color: #cbd5e1;
        font-size: 0.85rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      }
      .dropdown-item-btn:hover {
        background: rgba(56, 189, 248, 0.1);
        color: #38bdf8;
      }

      /* Settings & Edit Profile Modals */
      .profile-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        display: none;
        align-items: flex-start;
        justify-content: center;
        overflow-y: auto;
        z-index: 200000;
        padding: 2rem 1.5rem;
      }
      .profile-modal-overlay.show {
        display: flex;
      }
      .profile-modal-card {
        background: #0f111a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        max-width: 440px;
        width: 100%;
        margin: auto;
        max-height: 90vh;
        overflow-y: auto;
        padding: 1.5rem 1.75rem 1.75rem 1.75rem;
        position: relative;
        color: #fff;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .profile-modal-card::-webkit-scrollbar {
        width: 6px;
      }
      .profile-modal-card::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
      }
      .profile-modal-card::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.12);
        border-radius: 4px;
      }
      .profile-modal-card::-webkit-scrollbar-thumb:hover {
        background: rgba(56, 189, 248, 0.4);
      }
      .profile-modal-close {
        position: absolute;
        top: 1rem;
        right: 1.2rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #9ca3af;
        cursor: pointer;
        transition: color 0.2s;
      }
      .profile-modal-close:hover {
        color: #fff;
      }
      .profile-modal-header {
        text-align: center;
        margin-bottom: 1.5rem;
      }
      .profile-modal-header h2 {
        font-family: 'Sora', sans-serif;
        font-size: 1.3rem;
        font-weight: 800;
        margin-bottom: 0.25rem;
      }
      .profile-modal-header p {
        font-size: 0.82rem;
        color: #94a3b8;
      }

      /* Photo Upload Circular Area */
      .avatar-upload-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 1.25rem;
      }
      .avatar-preview-wrap {
        position: relative;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        border: 2px solid rgba(56, 189, 248, 0.3);
        background: rgba(255, 255, 255, 0.02);
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .avatar-preview-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .avatar-preview-wrap .initial-text {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-size: 2rem;
        font-weight: 800;
        color: #38bdf8;
      }
      .avatar-hover-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        color: #fff;
        font-size: 0.72rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .avatar-preview-wrap:hover .avatar-hover-overlay {
        opacity: 1;
      }

      /* Settings Row styles */
      .settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.8rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .settings-label {
        font-size: 0.88rem;
        font-weight: 600;
        color: #cbd5e1;
      }
      .settings-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      /* Toggle switches */
      .switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider-switch {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: rgba(255,255,255,0.08);
        transition: .3s;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .switch input:checked + .slider-switch {
        background-color: rgba(56, 189, 248, 0.2);
        border-color: #38bdf8;
      }
      .slider-switch:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: #cbd5e1;
        transition: .3s;
        border-radius: 50%;
      }
      .switch input:checked + .slider-switch:before {
        transform: translateX(20px);
        background-color: #38bdf8;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .profile-modal-card .field {
        position: relative;
        margin-bottom: 1.2rem;
        display: flex;
        flex-direction: column;
        animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .profile-modal-card form .field:nth-child(1) { animation-delay: 0.05s; }
      .profile-modal-card form .field:nth-child(2) { animation-delay: 0.1s; }
      .profile-modal-card form .field:nth-child(3) { animation-delay: 0.15s; }
      .profile-modal-card form .field:nth-child(4) { animation-delay: 0.2s; }
      .profile-modal-card form .field:nth-child(5) { animation-delay: 0.25s; }
      .profile-modal-card form .field:nth-child(6) { animation-delay: 0.3s; }

      .profile-modal-card .field input {
        width: 100% !important;
        padding: 0.9rem 1.1rem !important;
        border-radius: 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(13, 16, 23, 0.5) !important;
        color: #fff !important;
        font-family: inherit !important;
        font-size: 0.92rem !important;
        outline: none !important;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
      }
      .profile-modal-card .field input:focus {
        border-color: var(--primary, #38bdf8) !important;
        background: rgba(13, 16, 23, 0.75) !important;
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.3) !important;
      }
      .profile-modal-card .field label {
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        color: #94a3b8 !important;
        text-transform: uppercase !important;
        margin-bottom: 0.4rem !important;
        letter-spacing: 0.05em !important;
        text-align: left !important;
      }

      /* Animated Submit/Action Buttons */
      .otp-modal-btn {
        position: relative;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        border: none !important;
        border-radius: 12px !important;
        color: #ffffff !important;
        font-family: inherit !important;
        font-weight: 800 !important;
        font-size: 0.95rem !important;
        padding: 0.9rem 1.5rem !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4) !important;
        overflow: hidden !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.5rem !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
      }
      .otp-modal-btn:hover {
        transform: translateY(-2px) scale(1.02) !important;
        box-shadow: 0 8px 25px rgba(37, 99, 235, 0.65) !important;
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%) !important;
      }
      .otp-modal-btn:active {
        transform: translateY(1px) scale(0.98) !important;
        box-shadow: 0 2px 10px rgba(37, 99, 235, 0.3) !important;
      }
      .otp-modal-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -150%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.3) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        transform: skewX(-20deg);
        transition: all 0.75s ease;
      }
      .otp-modal-btn:hover::before {
        left: 150%;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
  }

  function injectHTML(user) {
    // 1. Dropdown Menu
    if (!document.getElementById('profileDropdownMenu')) {
      const dropdown = document.createElement('div');
      dropdown.id = 'profileDropdownMenu';
      dropdown.className = 'profile-dropdown-menu';
      dropdown.innerHTML = `
        <div class="dropdown-user-info">
          <div class="dropdown-user-avatar" id="dropdownAvatar">FP</div>
          <div class="dropdown-user-text">
            <div class="dropdown-username" id="dropdownName">Futrix Competitor</div>
            <div class="dropdown-useremail" id="dropdownEmail">user@futrix.com</div>
          </div>
        </div>
        <button type="button" class="dropdown-item-btn" id="ddEditProfileBtn">
          <span>✏️</span> Edit Profile
        </button>
        <button type="button" class="dropdown-item-btn" id="ddChangePasswordBtn">
          <span>🔑</span> Change Password
        </button>
        <button type="button" class="dropdown-item-btn" id="ddSettingsBtn">
          <span>⚙️</span> Settings
        </button>
        <button type="button" class="dropdown-item-btn" id="ddToggleMuteBtn">
          <span id="ddMuteIcon">🔇</span> Toggle Sound
        </button>
        <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 0.2rem 0;"></div>
        <button type="button" class="dropdown-item-btn" id="ddLogoutBtn" style="color: #f87171;">
          <span>🚪</span> Logout
        </button>
      `;
      document.body.appendChild(dropdown);
    }

    // 2. Edit Profile Modal
    if (!document.getElementById('editProfileModal')) {
      const editModal = document.createElement('div');
      editModal.id = 'editProfileModal';
      editModal.className = 'profile-modal-overlay';
      editModal.innerHTML = `
        <div class="profile-modal-card">
          <button type="button" class="profile-modal-close" id="closeEditModalBtn">&times;</button>
          
          <div class="profile-modal-header">
            <h2>Edit Profile</h2>
            <p>Update your personal details and profile picture.</p>
          </div>

          <div class="avatar-upload-container">
            <div class="avatar-preview-wrap" id="avatarPreviewTrigger">
              <div class="initial-text" id="editAvatarInitial">FP</div>
              <img id="editAvatarImage" style="display:none;" />
              <div class="avatar-hover-overlay">CHANGE</div>
            </div>
            <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" />
            <span style="font-size:0.75rem; color:#94a3b8; margin-top:0.4rem;">Select square photo (JPG/PNG)</span>
          </div>

          <form id="editProfileForm" style="display:flex; flex-direction:column; gap:1.1rem;">
            <div class="field">
              <label for="editFullName">Full Name</label>
              <input type="text" id="editFullName" required placeholder="e.g. Manvendra Pratap Singh" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="editCity">City</label>
              <input type="text" id="editCity" placeholder="e.g. New Delhi" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="editQualification">Qualification</label>
              <input type="text" id="editQualification" placeholder="e.g. Class 12, Graduate" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="editPinCode">Pin Code</label>
              <input type="text" id="editPinCode" placeholder="e.g. 110001" maxlength="6" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="editDob">Date of Birth</label>
              <input type="text" id="editDob" placeholder="DD/MM/YYYY" maxlength="10" />
              <div class="field-line"></div>
            </div>

            <button type="submit" class="otp-modal-btn" id="saveProfileBtn" style="margin-top:0.5rem; width:100%;">
              <span>Save Changes</span>
              <div class="spinner" id="saveProfileSpinner" style="display:none; width:16px; height:16px; border-width:2px; margin:0 auto;"></div>
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(editModal);
    }

    // 3. Settings Modal
    if (!document.getElementById('settingsModal')) {
      const settingsModal = document.createElement('div');
      settingsModal.id = 'settingsModal';
      settingsModal.className = 'profile-modal-overlay';
      settingsModal.innerHTML = `
        <div class="profile-modal-card">
          <button type="button" class="profile-modal-close" id="closeSettingsModalBtn">&times;</button>
          
          <div class="profile-modal-header">
            <h2>Account Settings</h2>
            <p>Customize your sound feedback, theme, and options.</p>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div class="settings-row">
              <span class="settings-label">Sound Effects Volume</span>
              <div class="settings-control">
                <input type="range" id="volumeSlider" min="0" max="100" value="50" style="accent-color:#38bdf8; width:100px; cursor:pointer;" />
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-label">Interface Audio (SFX)</span>
              <div class="settings-control">
                <label class="switch">
                  <input type="checkbox" id="soundSwitch" checked />
                  <span class="slider-switch"></span>
                </label>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-label">Email Subscription</span>
              <div class="settings-control">
                <label class="switch">
                  <input type="checkbox" id="emailSubscribeSwitch" checked />
                  <span class="slider-switch"></span>
                </label>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-label">Dashboard Theme</span>
              <div class="settings-control">
                <select id="themeSelector" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:0.25rem 0.5rem; font-size:0.8rem; font-family:inherit;">
                  <option value="neon-dark">Neon Dark (Default)</option>
                  <option value="cyber-purple">Cyber Purple</option>
                  <option value="deep-blue">Deep Blue</option>
                </select>
              </div>
            </div>

            <button type="button" class="otp-modal-btn" id="saveSettingsBtn" style="margin-top:1.5rem; width:100%;">
              Save Settings
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(settingsModal);
    }

    // 4. Change Password Modal
    if (!document.getElementById('changePasswordModal')) {
      const pwModal = document.createElement('div');
      pwModal.id = 'changePasswordModal';
      pwModal.className = 'profile-modal-overlay';
      pwModal.innerHTML = `
        <div class="profile-modal-card">
          <button type="button" class="profile-modal-close" id="closePasswordModalBtn">&times;</button>
          
          <div class="profile-modal-header">
            <h2>Change Password</h2>
            <p>Update your account password below securely.</p>
          </div>

          <form id="changePasswordForm" style="display:flex; flex-direction:column; gap:1.1rem;">
            <div class="field">
              <label for="oldPassword">Old Password</label>
              <input type="password" id="oldPassword" required placeholder="Enter current password" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="newPassword">New Password</label>
              <input type="password" id="newPassword" required minlength="6" placeholder="Min 6 characters" />
              <div class="field-line"></div>
            </div>

            <div class="field">
              <label for="confirmNewPassword">Confirm New Password</label>
              <input type="password" id="confirmNewPassword" required minlength="6" placeholder="Repeat new password" />
              <div class="field-line"></div>
            </div>

            <button type="submit" class="otp-modal-btn" id="savePasswordBtn" style="margin-top:0.5rem; width:100%;">
              <span>Update Password</span>
              <div class="spinner" id="savePasswordSpinner" style="display:none; width:16px; height:16px; border-width:2px; margin:0 auto;"></div>
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(pwModal);
    }
  }

  function syncAvatarAndDetails(profile) {
    const initials = (profile.full_name || 'FC').substring(0, 2).toUpperCase();

    // Top User Btn
    const topUserBtn = document.getElementById('topUserBtn');
    if (topUserBtn) {
      if (profile.avatar_url) {
        topUserBtn.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
      } else {
        topUserBtn.textContent = initials;
      }
    }

    // Sidebar Avatar Initial
    const sidebarAvatar = document.getElementById('profileInitial');
    if (sidebarAvatar) {
      if (profile.avatar_url) {
        sidebarAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
      } else {
        sidebarAvatar.textContent = initials;
      }
    }

    // Sidebar Name
    const sidebarName = document.getElementById('profileName');
    if (sidebarName) {
      sidebarName.textContent = profile.full_name || 'Futrix Competitor';
    }

    // Dropdown details
    const ddAvatar = document.getElementById('dropdownAvatar');
    if (ddAvatar) {
      if (profile.avatar_url) {
        ddAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
      } else {
        ddAvatar.textContent = initials;
      }
    }
    const ddName = document.getElementById('dropdownName');
    if (ddName) ddName.textContent = profile.full_name || 'Futrix Competitor';
    const ddEmail = document.getElementById('dropdownEmail');
    if (ddEmail) ddEmail.textContent = profile.email || 'user@futrix.com';
  }

  function setupEventHandlers(user, initialProfile) {
    const topUserBtn = document.getElementById('topUserBtn');
    const dropdown = document.getElementById('profileDropdownMenu');
    
    // Toggle dropdown
    if (topUserBtn && dropdown) {
      topUserBtn.style.cursor = 'pointer';
      topUserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== topUserBtn) {
        dropdown.classList.remove('show');
      }
    });

    // Dropdown Actions
    const editBtn = document.getElementById('ddEditProfileBtn');
    const settingsBtn = document.getElementById('ddSettingsBtn');
    const toggleMuteBtn = document.getElementById('ddToggleMuteBtn');
    const ddLogoutBtn = document.getElementById('ddLogoutBtn');

    // 1. Open Edit Modal
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        dropdown.classList.remove('show');
        const modal = document.getElementById('editProfileModal');
        if (modal) {
          modal.classList.add('show');
          // Populate fields
          document.getElementById('editFullName').value = initialProfile?.full_name || user.name || '';
          document.getElementById('editCity').value = initialProfile?.city || '';
          document.getElementById('editQualification').value = initialProfile?.qualification || '';
          document.getElementById('editPinCode').value = initialProfile?.pin_code || '';
          
          // Format DOB from YYYY-MM-DD to DD/MM/YYYY
          if (initialProfile?.dob) {
            const parts = initialProfile.dob.split('-');
            if (parts.length === 3) {
              document.getElementById('editDob').value = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
              document.getElementById('editDob').value = initialProfile.dob;
            }
          } else {
            document.getElementById('editDob').value = '';
          }

          // Populate large avatar preview
          const previewImg = document.getElementById('editAvatarImage');
          const previewInitial = document.getElementById('editAvatarInitial');
          if (initialProfile?.avatar_url) {
            previewImg.src = initialProfile.avatar_url;
            previewImg.style.display = 'block';
            previewInitial.style.display = 'none';
          } else {
            previewImg.style.display = 'none';
            previewInitial.style.display = 'flex';
            previewInitial.textContent = (initialProfile?.full_name || user.name || 'FC').substring(0, 2).toUpperCase();
          }
        }
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    // Close Edit Modal
    const closeEditBtn = document.getElementById('closeEditModalBtn');
    const editModal = document.getElementById('editProfileModal');
    if (closeEditBtn && editModal) {
      closeEditBtn.addEventListener('click', () => {
        editModal.classList.remove('show');
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    // Avatar preview click triggers hidden file input
    const avatarTrigger = document.getElementById('avatarPreviewTrigger');
    const fileInput = document.getElementById('avatarFileInput');
    if (avatarTrigger && fileInput) {
      avatarTrigger.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event) {
            // Compress image via HTML5 Canvas
            const img = new Image();
            img.onload = function() {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              // Scale to max 128x128 pixels to keep it extremely lightweight
              const maxDim = 128;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > maxDim) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                }
              } else {
                if (height > maxDim) {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
              
              // Compress to JPG data URL
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              
              // Set preview
              const previewImg = document.getElementById('editAvatarImage');
              const previewInitial = document.getElementById('editAvatarInitial');
              previewImg.src = compressedBase64;
              previewImg.style.display = 'block';
              previewInitial.style.display = 'none';

              // Store Base64 temporarily on the fileInput object for saving
              fileInput.dataset.compressedData = compressedBase64;
              if (typeof playSynthSound === 'function') playSynthSound('success');
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Submit Edit Profile Form
    const editForm = document.getElementById('editProfileForm');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveProfileBtn');
        const spinner = document.getElementById('saveProfileSpinner');
        const btnText = saveBtn.querySelector('span');

        if (saveBtn) saveBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (spinner) spinner.style.display = 'block';

        try {
          const newName = document.getElementById('editFullName').value.trim();
          const newCity = document.getElementById('editCity').value.trim();
          const newQual = document.getElementById('editQualification').value.trim();
          const newPin = document.getElementById('editPinCode').value.trim();
          const dobVal = document.getElementById('editDob').value.trim();

          let formattedDob = null;
          if (dobVal) {
            const parts = dobVal.split('/');
            if (parts.length === 3) {
              formattedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
              formattedDob = dobVal;
            }
          }

          const compressedAvatar = fileInput.dataset.compressedData || initialProfile?.avatar_url || null;

          const updates = {
            full_name: newName,
            city: newCity,
            qualification: newQual,
            pin_code: newPin,
            dob: formattedDob,
            avatar_url: compressedAvatar
          };

          // Save to database
          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

          if (error) throw error;

          // Update local details state
          initialProfile = { ...initialProfile, ...updates };
          syncAvatarAndDetails(initialProfile);

          // Update sessionStorage user name
          user.name = newName;
          sessionStorage.setItem('futrix_user', JSON.stringify(user));

          // Hide modal
          editModal.classList.remove('show');
          if (typeof playSynthSound === 'function') playSynthSound('success');
          alert('Profile updated successfully! ✓');

        } catch (err) {
          console.error('[PROFILE] Save changes failed:', err);
          if (typeof playSynthSound === 'function') playSynthSound('error');
          alert('Failed to save changes: ' + err.message);
        } finally {
          if (saveBtn) saveBtn.disabled = false;
          if (btnText) btnText.style.display = 'block';
          if (spinner) spinner.style.display = 'none';
        }
      });
    }

    // 2. Open Settings Modal
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        dropdown.classList.remove('show');
        const modal = document.getElementById('settingsModal');
        if (modal) {
          modal.classList.add('show');
          // Load local mute settings
          const isMute = localStorage.getItem('futrix_sound_muted') === 'true';
          document.getElementById('soundSwitch').checked = !isMute;
          document.getElementById('volumeSlider').value = localStorage.getItem('futrix_sound_volume') || '50';
          
          // Populate theme selector
          const activeTheme = localStorage.getItem('futrix_theme') || 'neon-dark';
          document.getElementById('themeSelector').value = activeTheme;
        }
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    // Close Settings Modal
    const closeSettingsBtn = document.getElementById('closeSettingsModalBtn');
    const settingsModal = document.getElementById('settingsModal');
    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    // Save Settings
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        const soundActive = document.getElementById('soundSwitch').checked;
        const volume = document.getElementById('volumeSlider').value;
        const selectedTheme = document.getElementById('themeSelector').value;

        localStorage.setItem('futrix_sound_muted', (!soundActive).toString());
        localStorage.setItem('futrix_sound_volume', volume);
        localStorage.setItem('futrix_theme', selectedTheme);

        // Try mapping global audio state if audio function is exposed
        if (typeof isSoundMuted !== 'undefined') {
          isSoundMuted = !soundActive;
        }

        // Apply theme selector classes dynamically
        applyGlobalTheme(selectedTheme);

        settingsModal.classList.remove('show');
        if (typeof playSynthSound === 'function') playSynthSound('success');
        alert('Settings saved successfully! ✓');
      });
    }

    // ── Change Password Modal Bindings
    const changePasswordBtn = document.getElementById('ddChangePasswordBtn');
    const closePasswordModalBtn = document.getElementById('closePasswordModalBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const changePasswordForm = document.getElementById('changePasswordForm');

    if (changePasswordBtn && changePasswordModal) {
      changePasswordBtn.addEventListener('click', () => {
        dropdown.classList.remove('show');
        changePasswordModal.classList.add('show');
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    if (closePasswordModalBtn && changePasswordModal) {
      closePasswordModalBtn.addEventListener('click', () => {
        changePasswordModal.classList.remove('show');
        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
          if (typeof playSynthSound === 'function') playSynthSound('error');
          alert('New passwords do not match. Please try again.');
          return;
        }

        const saveBtn = document.getElementById('savePasswordBtn');
        const spinner = document.getElementById('savePasswordSpinner');
        const btnText = saveBtn.querySelector('span');

        if (saveBtn) saveBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (spinner) spinner.style.display = 'block';

        try {
          const email = user.email || (initialProfile && initialProfile.email);
          if (!email) {
            throw new Error("Unable to retrieve user email for verification.");
          }

          // 1. Verify current password
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: oldPassword
          });

          if (signInError) {
            throw new Error("Incorrect current password. Please verify and try again.");
          }

          // 2. Save new password
          const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
          });

          if (updateError) throw updateError;

          // Reset inputs
          document.getElementById('oldPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmNewPassword').value = '';

          changePasswordModal.classList.remove('show');
          if (typeof playSynthSound === 'function') playSynthSound('success');
          alert('Password updated successfully! ✓');

        } catch (err) {
          console.error('[PROFILE] Password update failed:', err);
          if (typeof playSynthSound === 'function') playSynthSound('error');
          alert('Failed to update password: ' + err.message);
        } finally {
          if (saveBtn) saveBtn.disabled = false;
          if (btnText) btnText.style.display = 'block';
          if (spinner) spinner.style.display = 'none';
        }
      });
    }

    // 3. Mute Toggle from Dropdown
    if (toggleMuteBtn) {
      toggleMuteBtn.addEventListener('click', () => {
        const isMute = localStorage.getItem('futrix_sound_muted') === 'true';
        const newMuted = !isMute;
        localStorage.setItem('futrix_sound_muted', newMuted.toString());
        
        if (typeof isSoundMuted !== 'undefined') {
          isSoundMuted = newMuted;
        }

        const icon = document.getElementById('ddMuteIcon');
        if (icon) icon.textContent = newMuted ? '🔇' : '🔊';

        // Also update standard soundToggleBtn elements if they exist in header
        const globalSoundBtn = document.getElementById('soundToggleBtn');
        if (globalSoundBtn) {
          const globalIcon = globalSoundBtn.querySelector('.sound-icon');
          if (globalIcon) globalIcon.textContent = newMuted ? '🔇' : '🔊';
        }

        if (typeof playSynthSound === 'function') playSynthSound('click');
      });
    }

    function getLoginUrl() {
      const path = window.location.pathname;
      if (path.includes('/features/')) {
        const parts = path.substring(path.indexOf('/features/')).split('/');
        const depth = parts.length - 3;
        if (depth > 0) {
          return '../'.repeat(depth) + 'auth/login.html';
        } else {
          return './login.html';
        }
      }
      return 'features/auth/login.html';
    }

    // 4. Logout Handler
    function handleLogout(e) {
      if (e) e.preventDefault();
      sessionStorage.clear();
      localStorage.removeItem('futrix_user');
      localStorage.removeItem('futrix_token');
      localStorage.removeItem('sb-dsduytkikxfgiyptdwex-auth-token');
      
      // Perform direct root-relative redirect to prevent 404 paths
      window.location.href = getLoginUrl();
    }

    if (ddLogoutBtn) {
      ddLogoutBtn.addEventListener('click', handleLogout);
    }

    // Dynamic clean up of all page-level logout buttons
    document.querySelectorAll('a[href="login.html"], #logoutBtn').forEach(el => {
      el.href = getLoginUrl();
      el.addEventListener('click', handleLogout);
    });
  }

  function applyGlobalTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Dynamic styling shifts based on selected theme
    if (theme === 'cyber-purple') {
      document.documentElement.style.setProperty('--primary', '#a855f7');
      document.documentElement.style.setProperty('--primary-hover', '#c084fc');
      document.documentElement.style.setProperty('--accent', '#d946ef');
    } else if (theme === 'deep-blue') {
      document.documentElement.style.setProperty('--primary', '#2563eb');
      document.documentElement.style.setProperty('--primary-hover', '#3b82f6');
      document.documentElement.style.setProperty('--accent', '#06b6d4');
    } else {
      // Restore default neon-dark
      document.documentElement.style.setProperty('--primary', '#38bdf8');
      document.documentElement.style.setProperty('--primary-hover', '#0ea5e9');
      document.documentElement.style.setProperty('--accent', '#818cf8');
    }
  }
}


