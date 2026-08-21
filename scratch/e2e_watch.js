const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');
const { dbConfig } = require('../config/db');

// Absolute path to current conversation artifacts directory
const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\a21ae10a-0af8-4e09-86f2-ab18aaa5afd1';
const BASE_URL = 'https://teamfutrix-byte.github.io/futrix';

async function cleanupDb(email, isPreRegistered = false) {
  console.log(`[TEST PRE-CLEANUP] Cleaning up database rows for ${email}...`);
  const db = new Client(dbConfig);
  try {
    await db.connect();
    const { rows } = await db.query("SELECT id FROM public.profiles WHERE email = $1", [email]);
    if (rows.length > 0) {
      const uId = rows[0].id;
      console.log(`[TEST PRE-CLEANUP] Deleting attempts/results for user ID: ${uId}`);
      await db.query("DELETE FROM public.attempts WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.assessment_attempts WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.results WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.student_analytics WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.revision_queue WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.personal_memory_cards WHERE user_id = $1", [uId]);
    }
    if (!isPreRegistered) {
      await db.query("DELETE FROM auth.users WHERE email = $1", [email]);
      await db.query("DELETE FROM public.profiles WHERE email = $1", [email]);
      console.log(`[TEST PRE-CLEANUP] Deleted auth user and profile for: ${email}`);
    } else {
      console.log(`[TEST PRE-CLEANUP] Retained auth user and profile for pre-registered: ${email}`);
    }
  } catch (err) {
    console.error('[TEST PRE-CLEANUP ERROR]', err);
  } finally {
    await db.end();
  }
}

async function bustPageLinks(page) {
  await page.evaluate(() => {
    const timestamp = Date.now();
    document.querySelectorAll('a').forEach(a => {
      let href = a.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript')) {
        if (href.includes('?')) {
          a.setAttribute('href', href + '&t=' + timestamp);
        } else {
          a.setAttribute('href', href + '?t=' + timestamp);
        }
      }
    });
  });
}

async function main() {
  const email = 'teamfutrix@gmail.com';
  const phone = '9753124680';
  
  // Database pre-cleanup for teamfutrix@gmail.com (so it can register fresh)
  await cleanupDb(email, false);
  await cleanupDb('ms71766@gmail.com', true);

  console.log('Launching headful Chrome browser for live site E2E verification loop...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 140, // Slow down execution so user can watch on screen
    args: ['--start-maximized', '--allow-running-insecure-content', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setBypassCSP(true);
  page.on('dialog', async dialog => {
    console.log(`[DIALOG SYSTEM] Dismissing native browser dialog: "${dialog.message()}"`);
    await dialog.accept();
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('futrix-backend-7ly8.onrender.com')) {
      const localUrl = url.replace('https://futrix-backend-7ly8.onrender.com', 'http://localhost:8000');
      request.continue({ url: localUrl });
    } else {
      request.continue();
    }
  });
  // Track console errors and messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
  });
  page.on('response', res => {
    const url = res.url();
    const status = res.status();
    if (url.includes('supabase') || url.includes('verify-otp') || url.includes('.html')) {
      console.log(`[PUPPETEER RESPONSE] ${url} -> Status: ${status}`);
    }
  });

  try {
    // ── STEP 1: Registration Page Navigation & Login Competitor Transition ──
    console.log('Step 1: Navigating to student registration page on live site...');
    await page.goto(`${BASE_URL}/features/student/index.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_1_register_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 2: Clicking Already have an account? Login Competitor link...');
    await page.waitForSelector('.form-footer a', { visible: true, timeout: 20000 });
    await page.click('.form-footer a');
    await page.waitForFunction(() => window.location.href.includes('login.html'), { timeout: 20000 });
    console.log('Login page loaded successfully on live site!');
    console.log('Current URL is:', await page.evaluate(() => window.location.href));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_2_login_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 3: Request Access Transition ──
    console.log('Step 3: Clicking Request Access link...');
    await page.waitForSelector('.card-footer a', { visible: true, timeout: 20000 });
    await page.click('.card-footer a');
    await page.waitForSelector('#fullName', { visible: true, timeout: 20000 });
    console.log('Registration page loaded back successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_3_register_page_returned.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 4: Submit Registration for teamfutrix@gmail.com ──
    console.log('Step 4: Filling registration fields for teamfutrix@gmail.com...');
    await page.type('#fullName', 'Team Futrix');
    await page.type('#emailAddress', email);
    await page.type('#phoneNumber', phone);
    await page.type('#dob', '15082005'); 
    await page.type('#guardianName', 'Guardian Name');
    await page.type('#guardianContact', '8642013579');
    await page.type('#city', 'Delhi');
    await page.type('#qualification', 'Class 12');
    await page.type('#instituteName', 'Futrix Academy');
    await page.type('#pinCode', '110001');

    console.log('Selecting NEET preparation stream...');
    await page.waitForSelector('.prep-btn', { visible: true, timeout: 20000 });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.prep-btn'));
      const neetBtn = buttons.find(b => b.innerText.includes('NEET'));
      if (neetBtn) neetBtn.click();
    });

    console.log('Submitting registration form...');
    await page.waitForSelector('#submitBtn', { visible: true, timeout: 20000 });
    await page.click('#submitBtn');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Waiting for OTP Verification modal...');
    await page.waitForSelector('#otpModal.show', { timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_4_otp_modal.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Entering mock OTP: 123456');
    await page.type('#modalOtpInput', '123456');
    await page.evaluate(() => {
      const btn = document.getElementById('modalVerifyBtn');
      if (btn) btn.click();
    });

    console.log('Waiting for onboarding success overlay...');
    await page.waitForFunction(() => {
      const overlay = document.getElementById('successOverlay');
      return overlay && overlay.classList.contains('show');
    }, { timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_5_registration_success.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Close onboarding success modal and go to login page to verify candidate logins
    console.log('Clearing sessionStorage and localStorage...');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // ── STEP 5: Logging in as the newly registered teamfutrix@gmail.com ──
    console.log('Navigating to login page to test login with teamfutrix@gmail.com...');
    await page.goto(`${BASE_URL}/features/auth/login.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 20000 });
    await page.type('#loginEmail', email);
    await page.type('#loginPhone', phone);
    await page.click('#loginBtn');

    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 20000 });
    console.log('Successfully logged in as newly registered user: teamfutrix@gmail.com!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'new_user_dashboard_success.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Logout again to test the pre-registered user
    console.log('Logging out newly registered user...');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // ── STEP 6: Logging in as ms71766@gmail.com ──
    console.log('Navigating back to login page...');
    await page.goto(`${BASE_URL}/features/auth/login.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 20000 });
    await page.type('#loginEmail', 'ms71766@gmail.com');
    await page.type('#loginPhone', '8707093973');
    await page.click('#loginBtn');

    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 20000 });
    console.log('Logged in successfully as ms71766@gmail.com! Dashboard (instruction.html) loaded!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_11_candidate_instruction.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ── STEP 7: Check Dashboard Buttons and Functions ──
    console.log('Opening Profile Settings Modal...');
    await page.waitForSelector('.settings-btn', { visible: true, timeout: 20000 });
    await page.click('.settings-btn');
    await page.waitForSelector('#profileSettingsModal', { visible: true, timeout: 20000 });
    console.log('Profile Settings modal opened successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'profile_settings_modal.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Closing Profile Settings Modal...');
    await page.click('#closeProfileModalBtn');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // ── STEP 8: Test pricing upgrade checks ──
    console.log('Checking Upgrade to Pro button...');
    await page.waitForSelector('.btn-upgrade', { visible: true, timeout: 20000 });
    await page.click('.btn-upgrade');
    await page.waitForFunction(() => window.location.href.includes('pricing.html'), { timeout: 20000 });
    console.log('Pricing/Pro page loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pricing_page_pro.png') });
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Go back to instruction dashboard
    console.log('Navigating back to instruction dashboard...');
    await page.goto(`${BASE_URL}/features/tests/instruction.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // ── STEP 9: Active Exam Page & Test Lifecycle ──
    console.log('Selecting NEET-CELL-DIV test...');
    await page.select('#dashboardSelectTest', 'NEET-CELL-DIV');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Agreeing to rules and guidelines...');
    await page.click('#confirmCheck');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Clicking Start Test...');
    await page.waitForFunction(() => {
      const btn = document.getElementById('startTestBtn');
      return btn && !btn.disabled;
    }, { timeout: 20000 });
    await page.click('#startTestBtn');
    await page.waitForFunction(() => window.location.href.includes('exam.html'), { timeout: 20000 });
    console.log('exam.html loaded!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_12_exam_fullscreen_prompt.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Launching Secure Sandbox...');
    await page.waitForSelector('#startFullscreenBtn', { visible: true, timeout: 20000 });
    await page.click('#startFullscreenBtn');
    await page.waitForSelector('#examLayout', { visible: true, timeout: 20000 });
    console.log('Exam layout loaded! Selecting answer option A on first question...');
    await page.waitForSelector('.option-btn', { visible: true, timeout: 20000 });
    await page.click('.option-btn');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_13_exam_option_selected.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Clicking Save & Next...');
    await page.waitForSelector('#btnNext', { visible: true, timeout: 20000 });
    await page.click('#btnNext');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Submitting the test...');
    await page.waitForSelector('#btnSubmit', { visible: true, timeout: 20000 });
    await page.click('#btnSubmit');
    await page.waitForSelector('#confirmSubmit', { visible: true, timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_14_submit_confirmation.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Confirming submission...');
    await page.click('#confirmSubmit');

    console.log('Waiting for redirection to performance/result views...');
    await page.waitForFunction(() => {
      return window.location.href.includes('result') || window.location.href.includes('performance') || document.getElementById('resultScreen');
    }, { timeout: 20000 });
    console.log('Test submitted and results dashboard loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_15_result_page.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Returning to student dashboard...');
    await page.waitForSelector('.btn-home', { visible: true, timeout: 20000 });
    await page.click('.btn-home');
    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 20000 });
    console.log('Back on instruction dashboard!');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 10: PvP Arena check ──
    console.log('Navigating to PvP Arena...');
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('aside.sidebar a, ul.nav-list a'));
      const target = anchors.find(a => a.getAttribute('href').includes('arena.html'));
      if (target) target.click();
    });
    await page.waitForFunction(() => window.location.href.includes('arena.html'), { timeout: 20000 });
    console.log('PvP Arena page loaded successfully!');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Clicking Create Challenge button...');
    await page.waitForSelector('#btnOpenCreateModal', { visible: true, timeout: 20000 });
    await page.click('#btnOpenCreateModal');
    await page.waitForSelector('#createBattleModal', { visible: true, timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pvp_create_modal.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Selecting Battle Test and Difficulty...');
    await page.select('#selectBattleTest', 'NEET-CELL-DIV');
    await page.select('#selectBattleDifficulty', 'level_1');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Submitting Challenge...');
    await page.click('#btnSubmitChallenge');
    console.log('Challenge submitted!');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pvp_battle_created.png') });

    // ── STEP 11: Memory Lab check ──
    console.log('Navigating to Memory Lab...');
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('aside.sidebar a, ul.nav-list a'));
      const target = anchors.find(a => a.getAttribute('href').includes('memory-lab.html'));
      if (target) target.click();
    });
    await page.waitForFunction(() => window.location.href.includes('memory-lab.html'), { timeout: 20000 });
    console.log('Memory Lab page loaded successfully!');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Checking for Skip Diagnostic button...');
    const skipBtn = await page.$('#assessmentOverlay button[title="Skip Diagnostic"]');
    if (skipBtn) {
      console.log('Clicking Skip Diagnostic button...');
      await page.click('#assessmentOverlay button[title="Skip Diagnostic"]');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Waiting for Memory Lab decks to load...');
    await page.waitForFunction(() => {
      const importBtn = document.getElementById('btnImportCards');
      const hasDecks = document.querySelectorAll('.deck-item').length > 0;
      const isImportVisible = importBtn && importBtn.style.display !== 'none';
      return hasDecks || isImportVisible;
    }, { timeout: 20000 });

    const importBtn = await page.$('#btnImportCards');
    if (importBtn && await page.evaluate(btn => btn.style.display !== 'none', importBtn)) {
      console.log('Seeding default memory lab cards...');
      await page.click('#btnImportCards');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('[TEST DATABASE] Updating revision queue items to be due immediately...');
    const dbTemp = new Client(dbConfig);
    await dbTemp.connect();
    const pRows = await dbTemp.query("SELECT id FROM public.profiles WHERE email = $1", ['ms71766@gmail.com']);
    if (pRows.rows.length > 0) {
      const uId = pRows.rows[0].id;
      await dbTemp.query("UPDATE public.revision_queue SET next_revision_at = NOW() - INTERVAL '1 day' WHERE user_id = $1", [uId]);
      console.log('[TEST DATABASE] Revision queue updated.');
    }
    await dbTemp.end();

    console.log('Reloading page to fetch updated queue items...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Starting deck study session...');
    await page.waitForSelector('button[onclick*="startStudyDeck"]', { visible: true, timeout: 20000 });
    await page.click('button[onclick*="startStudyDeck"]');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Clicking Show Answer to flip flashcard...');
    await page.waitForSelector('#btnPersonalShowAnswer', { visible: true, timeout: 20000 });
    await page.click('#btnPersonalShowAnswer');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flashcard_flipped.png') });

    console.log('Rating card confidence as Easy...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.btn-confidence'));
      const easyBtn = buttons.find(b => b.innerText.toLowerCase().includes('easy'));
      if (easyBtn) easyBtn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 12: Leaderboard & Performance Navigation ──
    console.log('Navigating to Leaderboard...');
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('aside.sidebar a, ul.nav-list a'));
      const target = anchors.find(a => a.getAttribute('href').includes('leaderboard.html'));
      if (target) target.click();
    });
    await page.waitForFunction(() => window.location.href.includes('leaderboard.html'), { timeout: 20000 });
    console.log('Leaderboard page loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'leaderboard_loaded.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Navigating to Performance page...');
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('aside.sidebar a, ul.nav-list a'));
      const target = anchors.find(a => a.getAttribute('href').includes('performance.html'));
      if (target) target.click();
    });
    await page.waitForFunction(() => window.location.href.includes('performance.html'), { timeout: 20000 });
    console.log('Performance page loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'performance_loaded.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('All steps in the user test plan executed successfully! E2E validation finished. ✅');
  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

main().catch(err => console.error(err));
