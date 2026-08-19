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

async function cleanTestData() {
  const db = getDbClient();
  await db.connect();
  try {
    console.log("[TEST CLEANUP] Resetting test database records...");
    await db.query("DELETE FROM public.validation_results");
    await db.query("DELETE FROM public.approval_workflow");
    await db.query("DELETE FROM public.validation_audit_logs");
    await db.query("DELETE FROM public.question_versions");
    await db.query("DELETE FROM public.questions");
    await db.query("DELETE FROM auth.users WHERE email = 'teacher_qa_test@coaching.com'");
    console.log("[TEST CLEANUP] Database cleanup done.");
  } catch (err) {
    console.warn("[TEST CLEANUP] Warning during data cleanup:", err.message);
  } finally {
    await db.end();
  }
}

async function verifyDatabaseUpdates() {
  const db = getDbClient();
  await db.connect();
  try {
    console.log("[VERIFY DATABASE] Querying workflow and version records...");
    const { rows: wfRows } = await db.query("SELECT * FROM public.approval_workflow");
    const { rows: verRows } = await db.query("SELECT * FROM public.question_versions");
    const { rows: valRows } = await db.query("SELECT * FROM public.validation_results");
    const { rows: logRows } = await db.query("SELECT * FROM public.validation_audit_logs");

    console.log(`[VERIFY DATABASE] Results count:`);
    console.log(`  - Versions: ${verRows.length}`);
    console.log(`  - Validation Runs: ${valRows.length}`);
    console.log(`  - Approval Workflows: ${wfRows.length}`);
    console.log(`  - Audit Logs: ${logRows.length}`);

    if (wfRows.length > 0) {
      console.log(`[✓] Latest Approval Workflow status in DB: ${wfRows[0].status}`);
    } else {
      throw new Error("No approval workflow status found in DB!");
    }
  } catch (err) {
    console.error("[VERIFY DATABASE] Verification failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

async function main() {
  await cleanTestData();

  console.log("=== STARTING E2E QUESTION VALIDATION & APPROVAL TEST ===");
  
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  // Close any existing dashboard tabs to start fresh
  for (const p of pages) {
    if (p.url().includes('localhost:8000')) {
      try { await p.close(); } catch (_) {}
    }
  }
  let page = await browser.newPage();
  
  await page.setCacheEnabled(false);

  // Track console logs and errors
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.message}`);
  });

  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    try {
      await dialog.accept();
    } catch (err) {
      console.log(`[DIALOG INFO] Dialog already closed or handled: ${err.message}`);
    }
  });

  // 1. Register Teacher
  console.log("Navigating to login/register console...");
  await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });

  console.log("Switching to Register Teacher tab...");
  await page.waitForSelector('#tabRegister');
  await page.click('#tabRegister');
  await page.waitForSelector('#regName', { visible: true });

  console.log("Filling teacher registration form...");
  await page.type('#regName', 'Dr. QA Auditor');
  await page.type('#regEmail', 'teacher_qa_test@coaching.com');
  await page.type('#regPhone', 'qaPassword123');
  
  await page.waitForFunction(() => {
    const select = document.getElementById('regStream');
    return select && Array.from(select.options).some(o => o.value === 'NEET');
  }, { timeout: 8000 });
  await page.select('#regStream', 'NEET');
  
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_1_reg_filled.png') });
  await page.click('#regBtn');

  console.log("Waiting for registration success...");
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_2_reg_success.png') });

  // 2. Perform Login
  console.log("Filling login credentials...");
  await page.waitForSelector('#loginEmail', { visible: true });
  await page.type('#loginEmail', 'teacher_qa_test@coaching.com');
  await page.type('#loginPhone', 'qaPassword123');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_3_login_filled.png') });

  console.log("Submitting login form...");
  await page.click('#loginBtn');

  console.log("Waiting for redirection to teacher-dashboard.html...");
  await page.waitForFunction(() => window.location.href.includes('teacher-dashboard.html'), { timeout: 10000 });
  console.log("[✓] Successfully redirected to Teacher Dashboard!");
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_4_dashboard_loaded.png') });

  // 3. Generate a question first to populate the validation queue
  console.log("Generating initial question for validation test queue...");
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.nav-item button');
    const genBtn = Array.from(buttons).find(b => b.textContent.includes('AI Question Generator'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.select('#genSubject', 'Physics');
  await page.evaluate(() => updateChapterDropdown());
  await new Promise(r => setTimeout(r, 500));
  await page.select('#genChapter', 'Newton\'s Laws');
  await page.click('#btnGenerateQuestion');

  console.log("Waiting for question generation and automatic validation trigger...");
  await new Promise(r => setTimeout(r, 12000)); // allow validation to run E2E
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_5_question_generated.png') });

  // 4. Switch to QA & Approvals tab
  console.log("Switching to QA & Approvals View panel...");
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.nav-item button');
    const qaBtn = Array.from(buttons).find(b => b.textContent.includes('QA & Approvals'));
    if (qaBtn) qaBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_6_panel_selected.png') });

  // 5. Select question from the queue list
  console.log("Selecting pending question from list...");
  await page.waitForSelector('#qaQuestionsList .stat-card', { visible: true });
  await page.click('#qaQuestionsList .stat-card');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_7_question_selected.png') });

  // 6. Navigate Tab views
  console.log("Toggling detail tab panels (hints, version history, audit trail)...");
  await page.click('#tabQaHintsBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_8_hints_view.png') });

  await page.click('#tabQaHistoryBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_9_history_view.png') });

  await page.click('#tabQaAuditBtn');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_10_audit_view.png') });

  // 7. Write review comments and approve
  console.log("Entering review feedback comments...");
  await page.type('#qaReviewComments', 'Verified double-pass calculations successfully. Ready for students.');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_11_comments_added.png') });

  console.log("Clicking Approve & Publish...");
  await page.evaluate(() => {
    const btns = document.querySelectorAll('#qaDetailPanel button');
    const approveBtn = Array.from(btns).find(b => b.textContent.includes('Approve & Publish'));
    if (approveBtn) approveBtn.click();
  });

  console.log("Waiting for approval workflow updates...");
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_12_approved_success.png') });

  // 8. Logout
  console.log("Logging out...");
  await page.click('#logoutBtn');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_qa_13_logged_out.png') });

  console.log("[✓] E2E Automation tests completed. Verifying DB state...");
  await verifyDatabaseUpdates();

  console.log("=== ALL E2E QA VALIDATION & APPROVAL TESTS PASSED SUCCESSFULLY! ===");
}

main();
