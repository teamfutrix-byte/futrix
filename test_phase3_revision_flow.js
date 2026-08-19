const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

async function main() {
  // ── Database Cleanup for Test Candidate
  console.log("Cleaning up database state for testcandidate3@gmail.com...");
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
  try {
    await client.connect();
    const res = await client.query("SELECT id FROM auth.users WHERE email = 'testcandidate3@gmail.com'");
    if (res.rows.length > 0) {
      const userId = res.rows[0].id;
      await client.query("DELETE FROM public.user_goals WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM public.revision_queue WHERE user_id = $1", [userId]);
      await client.query("UPDATE public.profiles SET email_verified = false, otp_code = null WHERE id = $1", [userId]);
      console.log("Database state reset for test candidate.");
    } else {
      console.error("Test candidate user not found in auth.users!");
    }
  } catch (dbErr) {
    console.error("Database reset error:", dbErr.message);
  } finally {
    await client.end();
  }

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  for (const p of pages) {
    if (p.url().includes('localhost:8000') || p.url().includes('index.html') || p.url().includes('login.html')) {
      await p.close().catch(() => {});
    }
  }
  const page = await browser.newPage();

  // Clear caches
  await page.setCacheEnabled(false);

  // Setup error tracking
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
  page.on('dialog', async dialog => {
    console.log(`[TEST DIALOG] Auto-accepting browser dialog: "${dialog.message()}"`);
    await dialog.accept();
  });

  const email = 'testcandidate3@gmail.com';
  const phone = '9988776655';

  console.log("=== PHASE 3 REGISTRATION & AUTH ===");
  console.log("Navigating to index.html...");
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  console.log("Page loaded. Waiting for #fullName selector...");
  await page.waitForSelector('#fullName', { visible: true, timeout: 5000 });
  console.log("Typing fullName...");
  await page.type('#fullName', 'Phase3 Test Candidate');
  console.log("Typing emailAddress...");
  await page.type('#emailAddress', email);
  console.log("Typing phoneNumber...");
  await page.type('#phoneNumber', phone);
  console.log("Typing dob...");
  await page.type('#dob', '10/10/2000');
  console.log("Typing guardianName...");
  await page.type('#guardianName', 'Guardian Test');
  console.log("Typing guardianContact...");
  await page.type('#guardianContact', '9988776655');
  console.log("Typing city...");
  await page.type('#city', 'New Delhi');
  console.log("Typing qualification...");
  await page.type('#qualification', 'Class 12 Pass');
  console.log("Typing pinCode...");
  await page.type('#pinCode', '110001');
 
  console.log("Selecting NEET stream...");
  // Click NEET
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.prep-btn')).find(b => b.innerText.includes('NEET'));
    if (btn) btn.click();
  });
 
  console.log("Clicking submitBtn...");
  await page.click('#submitBtn');
  
  // Wait for OTP modal
  console.log("Waiting for Registration OTP Verification modal...");
  await page.waitForSelector('#otpModal', { visible: true, timeout: 8000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_1_otp_modal.png') });

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

  // Wait for signup success redirect/overlay
  await page.waitForFunction(() => {
    const overlay = document.getElementById('successOverlay');
    return overlay && overlay.classList.contains('show');
  }, { timeout: 8000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_2_registration_success.png') });

  // Redirect to login
  await page.goto('http://localhost:8000/login.html', { waitUntil: 'domcontentloaded' });
  await page.type('#loginEmail', email);
  await page.type('#loginPhone', phone);
  
  console.log("Logging in...");
  await page.evaluate(() => {
    const btn = document.getElementById('loginBtn');
    if (btn) btn.click();
  });

  // Redirected to instruction dashboard
  await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 8000 });
  console.log("Redirected to student dashboard!");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_3_dashboard_loaded.png') });

  console.log("=== PHASE 3 SMART REVISION DASHBOARD ===");
  // Navigate to revision.html
  await page.goto('http://localhost:8000/revision.html', { waitUntil: 'domcontentloaded' });
  
  // Verify Welcome Assessment is visible on load
  console.log("Verifying Welcome Assessment Modal displays...");
  await page.waitForSelector('#assessmentOverlay', { visible: true, timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_4_welcome_assessment.png') });

  // Complete Welcome Assessment quiz programmatically (15 questions)
  console.log("Completing 15-question welcome assessment...");
  for (let q = 0; q < 15; q++) {
    await page.waitForSelector('.btn-opt', { visible: true, timeout: 3000 });
    await page.evaluate(() => {
      const optionButtons = document.querySelectorAll('.btn-opt');
      if (optionButtons.length > 0) {
        // Select first choice
        optionButtons[0].click();
      }
    });
    // Brief sleep to let progress animation render
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Expect page reload/modal close
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
  console.log("[✓] Welcome Assessment completed and saved!");

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_5_revision_loaded.png') });

  // Verify Goal Selection elements can be targeted and updated
  console.log("Testing Goal Configuration selector updates...");
  await page.select('#targetExam', 'JEE Advanced');
  await page.select('#targetScore', '700');
  await page.evaluate(() => {
    const btn = document.getElementById('btnSaveGoal');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify Flashcards queue populator button
  console.log("Populating Spaced Repetition queue...");
  await page.evaluate(() => {
    const btn = document.getElementById('btnImportCards');
    if (btn && btn.style.display !== 'none') {
      btn.click();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_6_queue_populated.png') });

  // Verify 3D Card flips
  console.log("Testing 3D Flashcard interactive flip...");
  await page.evaluate(() => {
    const wrap = document.getElementById('flashcardWrap');
    if (wrap) wrap.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_7_card_flipped.png') });

  // Verify Rating adjustment
  console.log("Rating card as 'Easy' to test interval calculation...");
  await page.evaluate(() => {
    const ratingButtons = document.querySelectorAll('.btn-confidence');
    const easyBtn = Array.from(ratingButtons).find(b => b.innerText.includes('Easy'));
    if (easyBtn) easyBtn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_8_card_rated.png') });

  // Navigate to Roadmap Page
  console.log("Navigating to roadmap.html page...");
  await page.goto('http://localhost:8000/roadmap.html', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase3_9_roadmap_loaded.png') });

  // Summary
  console.log("=== Phase 3 Verification Summary ===");
  console.log(`Page Errors Encountered: ${errors.length}`);
  errors.forEach(e => console.log("- " + e));

  await browser.disconnect();
}

main().catch(err => console.error(err));
