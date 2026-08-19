const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');
const { dbConfig } = require('./config/db');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\842db8fb-52b2-4d7f-a6a4-e027f5229a68';

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  
  // Disable cache to ensure fresh code is loaded
  await page.setCacheEnabled(false);

  // Clean session storage and local storage to start fresh
  await page.goto('http://localhost:8000/index.html');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  // Track console logs and errors
  const errors = [];
  let latestOtp = '';
  page.on('console', msg => {
    const txt = msg.text();
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${txt}`);
    if (txt.includes('[TEST OTP]')) {
      latestOtp = txt.split('[TEST OTP]')[1].trim();
      console.log(`[TEST RUNNER] Extracted dynamic OTP: ${latestOtp}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error(`[BROWSER ERROR] ${err.message}`);
  });

  // Track network requests
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure() ? request.failure().errorText : 'unknown error'}`);
  });
  page.on('response', async response => {
    if (response.status() >= 400) {
      console.log(`[RESPONSE ERROR] ${response.status()} on ${response.url()}`);
    }
  });

  const email = 'testcandidate3@gmail.com';
  const phone = '9988776655';

  // Database Pre-Cleanup
  const db = new Client(dbConfig);
  try {
    await db.connect();
    // Fetch user ID first to delete dependent rows
    const { rows } = await db.query("SELECT id FROM public.profiles WHERE email = $1", [email]);
    if (rows.length > 0) {
      const uId = rows[0].id;
      console.log(`[TEST PRE-CLEANUP] Cleaning up attempts/analytics for user ID: ${uId}`);
      await db.query("DELETE FROM public.attempts WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.assessment_attempts WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.results WHERE user_id = $1", [uId]);
      await db.query("DELETE FROM public.student_analytics WHERE user_id = $1", [uId]);
    }
    // Delete auth user and profile
    await db.query("DELETE FROM auth.users WHERE email = $1", [email]);
    await db.query("DELETE FROM public.profiles WHERE email = $1", [email]);
    console.log(`[TEST PRE-CLEANUP] Deleted auth user and profile for: ${email}`);
  } catch (err) {
    console.error('[TEST PRE-CLEANUP ERROR]', err);
  } finally {
    await db.end();
  }

  console.log("=== PHASE 1: Registration ===");
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.prep-btn');

  await page.type('#fullName', 'Automation Test Candidate');
  await page.type('#emailAddress', email);
  await page.type('#phoneNumber', phone);
  await page.type('#dob', '15/08/2001');
  await page.type('#guardianName', 'Sunil Kumar');
  await page.type('#guardianContact', '9988776654');
  await page.type('#city', 'New Delhi');
  await page.type('#qualification', 'Class 12');
  await page.type('#instituteName', 'Futrix Institute');
  await page.type('#pinCode', '110001');

  // Select NEET preparation
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.prep-btn'));
    const neetBtn = buttons.find(b => b.innerText.includes('NEET'));
    if (neetBtn) neetBtn.click();
  });

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_1_registration_filled.png') });
  console.log("Submitting registration form...");
  await page.click('#submitBtn');

  // Wait for OTP modal
  console.log("Waiting for Registration OTP Verification modal...");
  await page.waitForSelector('#otpModal', { visible: true, timeout: 8000 });

  // Input mock OTP
  console.log("Entering OTP...");
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for console event
  const otpToEnter = latestOtp || '123456';
  console.log(`Typing OTP: ${otpToEnter}`);
  await page.type('#modalOtpInput', otpToEnter);
  await page.evaluate(() => {
    const btn = document.getElementById('modalVerifyBtn');
    if (btn) btn.click();
  });

  // Wait for success overlay
  await page.waitForFunction(() => {
    const overlay = document.getElementById('successOverlay');
    return overlay && overlay.classList.contains('show');
  }, { timeout: 8000 });

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_2_registration_success.png') });
  console.log("Registration succeeded!");

  console.log("=== PHASE 2: Login ===");
  await page.goto('http://localhost:8000/login.html', { waitUntil: 'networkidle2' });
  await page.type('#loginEmail', email);
  await page.type('#loginPhone', phone);
  
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_3_login_filled.png') });
  console.log("Submitting login form...");
  await page.click('#loginBtn');

  // Wait for redirect to instruction.html
  await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 8000 });
  console.log("Successfully redirected to instruction.html!");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_4_instruction_loaded.png') });

  console.log("=== PHASE 3: Instruction Page ===");
  // Wait for tests to load and auto-select
  console.log("Waiting for test catalog to load from Supabase...");
  await page.waitForFunction(() => {
    const select = document.getElementById('dashboardSelectTest');
    return select && select.value !== '';
  }, { timeout: 10000 });

  // Force select NEET-CELL-DIV
  console.log("Forcing selection of NEET-CELL-DIV...");
  await page.evaluate(() => {
    const select = document.getElementById('dashboardSelectTest');
    select.value = 'NEET-CELL-DIV';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  
  const selectedValue = await page.evaluate(() => document.getElementById('dashboardSelectTest').value);
  console.log(`Manually selected test series ID: ${selectedValue}`);

  const diagInfo = await page.evaluate(() => {
    const unlocked = document.getElementById('footerUnlocked').style.display;
    const locked = document.getElementById('footerLocked').style.display;
    const selectValue = document.getElementById('dashboardSelectTest').value;
    return {
      unlockedDisplay: unlocked,
      lockedDisplay: locked,
      selectValue,
      liveTestsLength: typeof liveTestsList !== 'undefined' ? liveTestsList.length : -1,
      liveTests: typeof liveTestsList !== 'undefined' ? liveTestsList : null
    };
  });
  console.log("DIAGNOSTIC DATA:", JSON.stringify(diagInfo, null, 2));

  // Check agreement checkbox
  console.log("Checking rules agreement...");
  await page.evaluate(() => {
    const checkbox = document.getElementById('confirmCheck');
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Wait for start button to become enabled
  await page.waitForFunction(() => {
    const btn = document.getElementById('startTestBtn');
    return btn && !btn.disabled;
  }, { timeout: 5000 });

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_5_instruction_ready.png') });

  // Click start test button
  console.log("Clicking Start Test button...");
  await page.click('#startTestBtn');

  // Wait for redirect to exam.html or arena.html
  await page.waitForFunction(() => window.location.href.includes('exam.html') || window.location.href.includes('arena.html'), { timeout: 10000 });
  console.log(`Redirected to exam page: ${page.url()}`);
  
  console.log("Waiting for Secure Sandbox Launch button to become visible...");
  await page.waitForSelector('#startFullscreenBtn', { visible: true, timeout: 10000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_5b_sandbox_launch_ready.png') });

  console.log("Clicking Launch Secure Sandbox button...");
  await page.evaluate(() => {
    const btn = document.getElementById('startFullscreenBtn');
    if (btn) btn.click();
  });

  console.log("Waiting for exam layout to load...");
  await page.waitForSelector('#examLayout', { visible: true, timeout: 8000 });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_6_exam_loaded.png') });

  console.log("=== PHASE 4: Exam Page ===");
  // Verify questions count
  const examDetails = await page.evaluate(() => {
    const options = document.querySelectorAll('.option-btn');
    return {
      optionsCount: options.length
    };
  });
  console.log(`Found ${examDetails.optionsCount} option choices on first question.`);

  // Click option on first question
  console.log("Clicking option A on first question...");
  await page.evaluate(() => {
    const btn = document.querySelector('.option-btn');
    if (btn) btn.click();
  });
  console.log("Selected option on first question.");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_7_option_selected.png') });

  // Click Save & Next
  console.log("Clicking Save & Next...");
  await page.evaluate(() => {
    const btn = document.getElementById('btnNext');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Submit test
  console.log("Submitting test...");
  await page.evaluate(() => {
    const btn = document.getElementById('btnSubmit');
    if (btn) btn.click();
  });

  // Accept confirmation in dialog
  console.log("Confirming test submission...");
  await page.waitForSelector('#confirmSubmit', { visible: true, timeout: 3000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_7b_confirm_dialog.png') });
  await page.evaluate(() => {
    const btn = document.getElementById('confirmSubmit');
    if (btn) btn.click();
  });

  // Wait for redirect to result/leaderboard/performance
  console.log("Waiting for result redirect...");
  await page.waitForFunction(() => {
    const url = window.location.href;
    return url.includes('result') || url.includes('leaderboard') || url.includes('performance') || document.getElementById('resultScreen');
  }, { timeout: 12000 });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_8_result_loaded.png') });
  console.log(`Current result page URL: ${page.url()}`);

  console.log("=== PHASE 5: Active Exams Page ===");
  await page.goto('http://localhost:8000/active-exams.html', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_9_active_exams.png') });
  
  // Test search bar
  console.log("Testing search bar in active-exams.html...");
  const searchBarExists = await page.evaluate(() => {
    const input = document.querySelector('input[type="search"]') || document.querySelector('input[placeholder*="search" i]');
    if (input) {
      input.value = 'NEET';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  });
  console.log("Search bar found and input typed:", searchBarExists);
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_10_search_completed.png') });

  // Verify testingNoticeBanner is visible, then close it
  console.log("Verifying testingNoticeBanner...");
  const bannerVisible = await page.evaluate(() => {
    const banner = document.getElementById('testingNoticeBanner');
    return banner && banner.style.display !== 'none' && window.getComputedStyle(banner).display !== 'none';
  });
  console.log(`Is testing notice banner visible on load: ${bannerVisible}`);

  console.log("Closing notice banner...");
  await page.evaluate(() => {
    const btn = document.getElementById('btnCloseNotice');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  const bannerVisibleAfterClose = await page.evaluate(() => {
    const banner = document.getElementById('testingNoticeBanner');
    return banner && banner.style.display !== 'none' && window.getComputedStyle(banner).display !== 'none';
  });
  console.log(`Is testing notice banner visible after close: ${bannerVisibleAfterClose}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'flow_11_banner_closed.png') });

  // Check errors
  console.log("=== Verification Summary ===");
  console.log(`Page Errors: ${errors.length}`);
  errors.forEach(e => console.log("- " + e));
  
  await browser.close();
}

main().catch(err => console.error(err));
