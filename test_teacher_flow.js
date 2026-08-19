const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('localhost:8000')) || await browser.newPage();

  // Clear session to start fresh
  await page.goto('http://localhost:8000/admin-login.html');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const errors = [];
  page.on('console', msg => {
    console.log(`[TEACHER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error(`[TEACHER ERROR] ${err.message}`);
  });

  // Handle alerts / dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  const email = `teacher_${Date.now()}@coaching.com`;
  const password = 'teacherPassword123';

  console.log("=== PHASE 1: Teacher Registration ===");
  await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#tabRegister');

  // Click Register Teacher Tab
  console.log("Clicking 'Register Teacher' tab...");
  await page.click('#tabRegister');
  await page.waitForSelector('#regName', { visible: true });

  await page.type('#regName', 'Dr. Ramesh Chandra');
  await page.type('#regEmail', email);
  await page.type('#regPhone', password);

  // Wait for regStream to load options and select 'NEET' explicitly
  console.log("Selecting specialization stream 'NEET'...");
  await page.waitForFunction(() => {
    const select = document.getElementById('regStream');
    return select && Array.from(select.options).some(o => o.value === 'NEET');
  }, { timeout: 8000 });
  await page.select('#regStream', 'NEET');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_1_reg_filled.png') });
  console.log("Submitting teacher registration form...");
  await page.click('#regBtn');

  // Wait for dialog alert of registration success, then switch to sign in form
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_2_reg_submitted.png') });

  console.log("=== PHASE 2: Teacher Login ===");
  await page.waitForSelector('#loginEmail', { visible: true });
  await page.type('#loginEmail', email);
  await page.type('#loginPhone', password);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_3_login_filled.png') });
  console.log("Submitting login form...");
  await page.click('#loginBtn');

  // Wait for redirect to teacher-dashboard.html
  await page.waitForFunction(() => window.location.href.includes('teacher-dashboard.html'), { timeout: 10000 });
  console.log("Successfully logged in and redirected to teacher-dashboard.html!");
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_4_dashboard_loaded.png') });

  console.log("=== PHASE 3: View Switching ===");
  const views = ['students', 'weaktopics', 'aiassistant'];
  for (const view of views) {
    console.log(`Switching to view: ${view}`);
    await page.evaluate((v) => {
      const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes(`switchView('${v}'`));
      if (button) button.click();
    }, view);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `teacher_view_${view}.png`) });
  }

  console.log("=== PHASE 4: AI Counseling Assistant Trigger ===");
  // Switch to AI Assistant
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('aiassistant'"));
    if (button) button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("Triggering Auto-Analyze Classroom Performance...");
  await page.click('#btnTriggerClassroomAnalysis');
  // Wait a few seconds for analysis response or fallback advice
  await new Promise(resolve => setTimeout(resolve, 4000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_counseling_assistant_result.png') });

  console.log("=== PHASE 5: Log Out ===");
  await page.click('#logoutBtn');
  await page.waitForFunction(() => window.location.href.includes('admin-login.html'), { timeout: 8000 });
  console.log("Successfully logged out and redirected to login page!");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'teacher_5_logged_out.png') });

  console.log("=== Verification Summary ===");
  console.log(`Page Errors: ${errors.length}`);
  errors.forEach(e => console.log("- " + e));

  await browser.disconnect();
}

main().catch(err => console.error(err));
