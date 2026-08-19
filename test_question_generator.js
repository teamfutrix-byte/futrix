const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

function getDbClient() {
  return new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });
}

async function cleanTestUser() {
  const db = getDbClient();
  await db.connect();
  try {
    console.log("[TEST CLEANUP] Removing prior test user teacher_generator_test@coaching.com...");
    await db.query("DELETE FROM auth.users WHERE email = 'teacher_generator_test@coaching.com'");
    console.log("[TEST CLEANUP] Cleanup done.");
  } catch (err) {
    console.warn("[TEST CLEANUP] Error during user cleanup:", err.message);
  } finally {
    await db.end();
  }
}

async function main() {
  await cleanTestUser();

  console.log("=== STARTING E2E AI QUESTION GENERATION TEST ===");
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('localhost:8000')) || await browser.newPage();
  
  await page.setCacheEnabled(false);

  // Track console logs and errors
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.message}`);
  });

  // Handle alerts / dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  // 1. Go to Admin/Teacher Registration
  console.log("Navigating to login/register console...");
  await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });

  // Clear any existing session
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });

  // Click Register Teacher Tab
  console.log("Switching to Register Teacher tab...");
  await page.waitForSelector('#tabRegister');
  await page.click('#tabRegister');
  await page.waitForSelector('#regName', { visible: true });

  // Fill Register Teacher form
  console.log("Filling teacher registration form...");
  await page.type('#regName', 'Dr. AI Generator Test');
  await page.type('#regEmail', 'teacher_generator_test@coaching.com');
  await page.type('#regPhone', 'teacherPassword123');
  
  // Wait for regStream to load options and select 'NEET' explicitly
  console.log("Selecting specialization stream 'NEET'...");
  await page.waitForFunction(() => {
    const select = document.getElementById('regStream');
    return select && Array.from(select.options).some(o => o.value === 'NEET');
  }, { timeout: 8000 });
  await page.select('#regStream', 'NEET');
  
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_1_reg_filled.png') });
  
  console.log("Submitting teacher registration...");
  await page.click('#regBtn');

  // Wait for dynamic OTP or success message
  console.log("Waiting for registration redirection or login switch...");
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_2_reg_success.png') });

  // 2. Perform Login
  console.log("Filling login credentials...");
  await page.waitForSelector('#loginEmail', { visible: true });
  await page.type('#loginEmail', 'teacher_generator_test@coaching.com');
  await page.type('#loginPhone', 'teacherPassword123');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_3_login_filled.png') });

  console.log("Submitting login form...");
  await page.click('#loginBtn');

  console.log("Waiting for redirection to teacher-dashboard.html...");
  await page.waitForFunction(() => window.location.href.includes('teacher-dashboard.html'), { timeout: 10000 });
  console.log("[✓] Successfully logged in and redirected to Teacher Dashboard!");
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_4_dashboard_loaded.png') });

  // 3. Switch to AI Question Generator tab
  console.log("Switching to AI Question Generator View panel...");
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.nav-item button');
    const genBtn = Array.from(buttons).find(b => b.textContent.includes('AI Question Generator'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_5_panel_selected.png') });

  // 4. Fill parameters and trigger generation
  console.log("Configuring generator parameters...");
  await page.select('#genSubject', 'Physics');
  await page.evaluate(() => updateChapterDropdown());
  await new Promise(r => setTimeout(r, 500));

  await page.select('#genChapter', 'Newton\'s Laws');
  await page.select('#genDifficulty', 'Medium');
  await page.select('#genBloom', 'Apply');
  await page.select('#genType', 'Single Correct MCQ');
  await page.select('#genLanguage', 'English');
  await page.type('#genNotes', 'Generate Newton second law inclined plane calculation with friction');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_6_params_configured.png') });

  console.log("Triggering AI question generation pipeline...");
  await page.click('#btnGenerateQuestion');

  // 5. Wait for pipeline generation
  console.log("Waiting for pipeline pipeline logs and database commit...");
  // Wait up to 25 seconds for LLM output, validation checks, and database save
  await page.waitForFunction(() => {
    const card = document.getElementById('genQuestionResultCard');
    return card && card.style.display === 'flex';
  }, { timeout: 25000 });

  console.log("[✓] Question generation completed and loaded into UI!");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_7_question_rendered.png') });

  // 6. Test Interactive tabs
  console.log("Testing detailed explanation tab...");
  await page.click('#tabSolutionBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_8_explanation_active.png') });

  console.log("Testing progressive hints tab...");
  await page.click('#tabHintsBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_9_hints_active.png') });

  console.log("Testing concept dependency graph tab...");
  await page.click('#tabGraphBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_generator_10_graph_active.png') });

  // 7. Verify database entry has ai_metadata populated
  console.log("Verifying question is successfully saved to Supabase with metadata...");
  const db = getDbClient();
  await db.connect();
  try {
    const { rows } = await db.query("SELECT * FROM public.questions WHERE topic = $1 ORDER BY question_number DESC LIMIT 1", ['Newton\'s Laws']);
    if (rows.length === 0) {
      throw new Error("No question entry found in public.questions for topic 'Newton's Laws'!");
    }
    const q = rows[0];
    console.log(`[✓] Found question in DB: ID = ${q.question_id}, Topic = ${q.topic}`);
    console.log("Checking ai_metadata column contents...");
    const meta = q.ai_metadata;
    if (!meta || !meta.bloom_level || !meta.hints || !meta.concept_graph) {
      throw new Error("ai_metadata column is empty or missing required schema properties!");
    }
    console.log("[✓] ai_metadata verified successfully:", JSON.stringify(meta, null, 2));
  } finally {
    await db.end();
  }

  // 8. Log out
  console.log("Clicking logout...");
  await page.click('#logoutBtn');
  await new Promise(r => setTimeout(r, 1000));
  console.log("E2E AI Question Generator test completed successfully!");
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
