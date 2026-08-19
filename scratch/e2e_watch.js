const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');
const { dbConfig } = require('../config/db');

const { spawn } = require('child_process');

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
  
  // Start local server to handle database requests
  console.log('Starting local backend server...');
  const serverProc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' // Forward server output to E2E script stdout/stderr
  });

  // Wait 3 seconds for server to start and bind to port 8000
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Database pre-cleanup
  await cleanupDb(email, false);
  await cleanupDb('ms71766@gmail.com', true);

  console.log('Launching headful browser to run E2E validation loop...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 100, // Slow down execution so user can watch on screen
    args: ['--start-maximized', '--allow-running-insecure-content']
  });

  const page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.setCacheEnabled(false);

  // Redirect Render backend API requests to local server (bypassing Render IPv6 DB connection limits)
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('futrix-backend-7ly8.onrender.com')) {
      const redirectedUrl = url.replace('https://futrix-backend-7ly8.onrender.com', 'http://localhost:8000');
      console.log(`[PUPPETEER REDIRECT] ${url} -> ${redirectedUrl}`);
      req.continue({ url: redirectedUrl });
    } else {
      req.continue();
    }
  });

  // Track console errors and messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
  });
  page.on('requestfailed', request => {
    console.error(`[PUPPETEER REQ FAILED] ${request.url()} -> ${request.failure().errorText}`);
  });

  try {
    // ── STEP 1: Navigation to Registration and testing Login Competitor Link ──
    console.log('Step 1: Navigating to student registration page...');
    await page.goto(`${BASE_URL}/features/student/index.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    await bustPageLinks(page);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_1_register_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Clicking Already have an account? Login Competitor link...');
    await page.waitForSelector('.form-footer a', { visible: true, timeout: 20000 });
    await page.click('.form-footer a');
    await page.waitForFunction(() => window.location.href.includes('login.html'), { timeout: 20000 });
    console.log('Login page loaded successfully!');
    console.log('Current URL is:', await page.evaluate(() => window.location.href));
    await bustPageLinks(page);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_2_login_page.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 2: Testing Request Access Link ──
    console.log('Clicking Request Access link...');
    await page.waitForSelector('.card-footer a', { visible: true, timeout: 20000 });
    await page.click('.card-footer a');
    await page.waitForFunction(() => window.location.href.includes('student/index.html'), { timeout: 20000 });
    console.log('Registration page loaded back successfully!');
    await bustPageLinks(page);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_3_register_page_returned.png') });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── STEP 3: Registration Submission & OTP Verification ──
    console.log('Filling registration fields...');
    await page.type('#fullName', 'Team Futrix');
    await page.type('#emailAddress', email);
    await page.type('#phoneNumber', phone);
    await page.type('#dob', '15082005'); // Format: DD/MM/YYYY (auto-formatted by input listener)
    await page.type('#guardianName', 'Guardian Name');
    await page.type('#guardianContact', '8642013579');
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
    await page.waitForSelector('#submitBtn', { visible: true, timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_3b_before_submit.png') });
    await page.click('#submitBtn');
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_3c_after_submit.png') });

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

    console.log('Clicking Start Your First Test...');
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('#successOverlay a'));
      const startBtn = anchors.find(a => a.innerText.includes('Start Your First Test'));
      if (startBtn) startBtn.click();
    });
    await page.waitForFunction(() => window.location.href.includes('active-exams.html'), { timeout: 20000 });
    console.log('Active exams page loaded successfully!');
    await bustPageLinks(page);
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
      
      await page.waitForFunction((sub) => window.location.href.includes(sub), { timeout: 20000 }, link.urlSubstring);
      console.log(`${link.name} loaded successfully!`);
      await bustPageLinks(page);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, link.screenshot) });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // ── STEP 5: Logging out and Logging in with Pre-registered User ms71766@gmail.com ──
    console.log('Navigating back to login page...');
    await page.goto(`${BASE_URL}/features/auth/login.html?t=${Date.now()}`, { waitUntil: 'networkidle2' });
    console.log('Login page loaded!');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('Logging in as pre-registered candidate ms71766@gmail.com...');
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 20000 });
    await page.type('#loginEmail', 'ms71766@gmail.com');
    await page.type('#loginPhone', '8707093973');
    await page.click('#loginBtn');

    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 20000 });
    console.log('Logged in successfully! instruction.html loaded!');
    await bustPageLinks(page);
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
    }, { timeout: 20000 });
    await page.click('#startTestBtn');
    await page.waitForFunction(() => window.location.href.includes('exam.html'), { timeout: 20000 });
    console.log('exam.html loaded!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_12_exam_fullscreen_prompt.png') });
    await new Promise(resolve => setTimeout(resolve, 1500));

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
    
    console.log('Confirming submission...');
    await page.click('#confirmSubmit');

    console.log('Waiting for redirection to performance/result views...');
    await page.waitForFunction(() => {
      return window.location.href.includes('result') || window.location.href.includes('performance') || document.getElementById('resultScreen');
    }, { timeout: 20000 });
    console.log('Test submitted and results dashboard loaded successfully!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'step_15_result_page.png') });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('All steps in the user test plan executed successfully! E2E validation finished. ✅');
  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    
    // Stop local server
    console.log('Stopping local backend server...');
    serverProc.kill();
  }
}

main().catch(err => console.error(err));
