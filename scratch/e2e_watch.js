const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');
const { dbConfig } = require('../config/db');

// Absolute path to current conversation artifacts directory
const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\a21ae10a-0af8-4e09-86f2-ab18aaa5afd1';
const BASE_URL = 'https://teamfutrix-byte.github.io/futrix';

async function cleanupDb(email) {
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
    }
    await db.query("DELETE FROM auth.users WHERE email = $1", [email]);
    await db.query("DELETE FROM public.profiles WHERE email = $1", [email]);
    console.log(`[TEST PRE-CLEANUP] Deleted auth user and profile for: ${email}`);
  } catch (err) {
    console.error('[TEST PRE-CLEANUP ERROR]', err);
  } finally {
    await db.end();
  }
}

async function main() {
  const email = 'teamfutrix@gmail.com';
  const phone = '9876543210';
  
  // Database pre-cleanup
  await cleanupDb(email);

  console.log('Launching headful browser to run E2E validation loop...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 100, // Slow down execution so user can watch on screen
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  // Track console errors and messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
  });

  try {
    // ── STEP 1: Navigation to Registration and testing Login Competitor Link ──
    console.log('Step 1: Navigating to student registration page...');
    await page.goto(`${BASE_URL}/features/student/index.html`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_1_register_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Clicking Already have an account? Login Competitor link...');
    await page.waitForSelector('.form-footer a', { visible: true, timeout: 8000 });
    await page.click('.form-footer a');
    await page.waitForFunction(() => window.location.href.includes('login.html'), { timeout: 8000 });
    console.log('Login page loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_2_login_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 2: Testing Request Access Link ──
    console.log('Clicking Request Access link...');
    await page.waitForSelector('.card-footer a', { visible: true, timeout: 8000 });
    await page.click('.card-footer a');
    await page.waitForFunction(() => window.location.href.includes('student/index.html'), { timeout: 8000 });
    console.log('Registration page loaded back successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_3_register_page_returned.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 3: Registration Submission & OTP Verification ──
    console.log('Filling registration fields...');
    await page.type('#fullName', 'Team Futrix');
    await page.type('#emailAddress', email);
    await page.type('#phoneNumber', phone);
    await page.type('#dob', '15082005'); // Format: DD/MM/YYYY
    await page.type('#city', 'Delhi');
    await page.type('#qualification', 'Class 12');
    await page.type('#instituteName', 'Futrix Academy');
    await page.type('#pinCode', '110001');

    console.log('Selecting NEET preparation stream...');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.prep-card'));
      const neetCard = cards.find(c => c.innerText.includes('NEET'));
      if (neetCard) neetCard.click();
    });

    console.log('Submitting registration form...');
    await page.click('#submitBtn');

    console.log('Waiting for OTP Verification modal...');
    await page.waitForSelector('#otpModal.show', { timeout: 8000 });
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
    }, { timeout: 8000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_5_registration_success.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Clicking Start Your First Test...');
    await page.waitForSelector('#successOverlay a', { visible: true, timeout: 8000 });
    await page.click('#successOverlay a'); // Clicks the first link in success modal
    await page.waitForFunction(() => window.location.href.includes('active-exams.html'), { timeout: 8000 });
    console.log('Active exams page loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_6_active_exams_dashboard.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 4: Sidebar Navigation check ──
    const sidebarPages = [
      { name: 'PvP Arena', urlSubstring: 'arena.html', screenshot: 'step_7_arena.png' },
      { name: 'Leaderboard', urlSubstring: 'leaderboard.html', screenshot: 'step_8_leaderboard.png' },
      { name: 'Performance', urlSubstring: 'performance.html', screenshot: 'step_9_performance.png' },
      { name: 'Memory Lab', urlSubstring: 'memory-lab.html', screenshot: 'step_10_memory_lab.png' }
    ];

    for (const link of sidebarPages) {
      console.log(`Navigating to ${link.name}...`);
      await page.evaluate((sub) => {
        const anchors = Array.from(document.querySelectorAll('aside.sidebar a, ul.nav-list a'));
        const target = anchors.find(a => a.getAttribute('href').includes(sub));
        if (target) target.click();
      }, link.urlSubstring);
      
      await page.waitForFunction((sub) => window.location.href.includes(sub), { timeout: 8000 }, link.urlSubstring);
      console.log(`${link.name} loaded successfully!`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, link.screenshot) });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // ── STEP 5: Logging out and Logging in with Pre-registered User ms71766@gmail.com ──
    console.log('Logging out from dashboard...');
    await page.evaluate(() => {
      const btn = document.getElementById('logoutBtn');
      if (btn) btn.click();
    });
    await page.waitForFunction(() => window.location.href.includes('login.html'), { timeout: 8000 });
    console.log('Logged out successfully!');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Logging in as pre-registered candidate ms71766@gmail.com...');
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 8000 });
    await page.type('#loginEmail', 'ms71766@gmail.com');
    await page.type('#loginPhone', '8707093973');
    await page.click('#loginBtn');

    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 8000 });
    console.log('Logged in successfully! instruction.html loaded!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_11_candidate_instruction.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force select test and run a test lifecycle
    console.log('Selecting NEET-CELL-DIV test...');
    await page.evaluate(() => {
      const select = document.getElementById('dashboardSelectTest');
      if (select) {
        select.value = 'NEET-CELL-DIV';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Agreeing to rules and guidelines...');
    await page.evaluate(() => {
      const checkbox = document.getElementById('confirmCheck');
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Clicking Start Test...');
    await page.waitForFunction(() => {
      const btn = document.getElementById('startTestBtn');
      return btn && !btn.disabled;
    }, { timeout: 8000 });
    await page.click('#startTestBtn');
    await page.waitForFunction(() => window.location.href.includes('exam.html'), { timeout: 8000 });
    console.log('exam.html loaded!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_12_exam_fullscreen_prompt.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Launching Secure Sandbox...');
    await page.waitForSelector('#startFullscreenBtn', { visible: true, timeout: 8000 });
    await page.click('#startFullscreenBtn');
    await page.waitForSelector('#examLayout', { visible: true, timeout: 8000 });
    console.log('Exam layout loaded! Selecting answer option A on first question...');
    await page.waitForSelector('.option-btn', { visible: true, timeout: 8000 });
    await page.click('.option-btn');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_13_exam_option_selected.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Clicking Save & Next...');
    await page.waitForSelector('#btnNext', { visible: true, timeout: 8000 });
    await page.click('#btnNext');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Submitting the test...');
    await page.waitForSelector('#btnSubmit', { visible: true, timeout: 8000 });
    await page.click('#btnSubmit');
    await page.waitForSelector('#confirmSubmit', { visible: true, timeout: 4000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_14_submit_confirmation.png') });
    
    console.log('Confirming submission...');
    await page.click('#confirmSubmit');

    console.log('Waiting for redirection to performance/result views...');
    await page.waitForFunction(() => {
      return window.location.href.includes('result') || window.location.href.includes('performance') || document.getElementById('resultScreen');
    }, { timeout: 12000 });
    console.log('Test submitted and results dashboard loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_15_result_page.png') });
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
