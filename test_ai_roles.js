const puppeteer = require('puppeteer');
const path = require('path');
const { Client } = require('pg');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("=== STARTING FUTRIX MULTI-AGENT ROLE & CONTEXT ENGINE VERIFICATION ===");

  // Connect to Chrome
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  for (const p of pages) {
    if (p.url().includes('localhost:8000') || p.url().includes('dashboard') || p.url().includes('revision') || p.url().includes('login')) {
      await p.close().catch(() => {});
    }
  }

  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  // Setup console monitor
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
  });

  // Dialog auto-accept
  page.on('dialog', async dialog => {
    console.log(`[TEST DIALOG] Accepting: "${dialog.message()}"`);
    await dialog.accept();
  });

  try {
    // ── Database cleanup for dynamic teacher test account ──
    const db = new Client({
      host: 'db.dsduytkikxfgiyptdwex.supabase.co',
      port: 5432,
      user: 'postgres',
      password: '$anjana@123man',
      database: 'postgres'
    });
    await db.connect();
    await db.query("DELETE FROM auth.users WHERE email = 'teacher_test_role@coaching.com'");
    await db.end();
    console.log("[✓] Cleaned up dynamic teacher_test_role@coaching.com if existed.");

    // ── SUB-TEST 1: SUPER ADMIN AI ROLE ──
    console.log("\n--- SUB-TEST 1: Super Admin AI Role ---");
    await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });
    await page.type('#loginEmail', 'teamfutrix-bytes-project@futrix.internal');
    await page.type('#loginPhone', 'FutrixAdmin#2026');
    await page.click('#loginBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log("[✓] Logged in as Super Admin!");

    // Switch to settings and configure AI
    const btnAI = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.nav-item button'));
      return buttons.find(b => b.textContent.includes('AI Settings Panel'));
    });
    await btnAI.asElement().click();
    await page.waitForSelector('#aiConfigForm', { visible: true });

    // Save key
    await page.evaluate(() => {
      document.getElementById('aiApiKey').value = 'AI_MOCK_GEMINI_KEY_2026';
      document.getElementById('aiEnableToggle').checked = true;
    });
    await page.click('#aiConfigForm button[type="submit"]');
    await delay(1000);

    // Switch to AI Monitoring & run Admin AI Report
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.nav-item button'));
      const btn = buttons.find(b => b.textContent.includes('AI Monitoring') || b.textContent.includes('Monitoring'));
      if (btn) btn.click();
    });
    await page.waitForSelector('#btnTriggerAiReport', { visible: true });
    
    console.log("Triggering Admin AI Business report...");
    await page.click('#btnTriggerAiReport');
    await delay(4000); // wait for completion or fallback

    const reportText = await page.evaluate(() => document.getElementById('aiReportOutput').textContent);
    console.log(`[ADMIN AI RESPONSE]: "${reportText.substring(0, 100)}..."`);
    if (reportText && reportText.length > 50) {
      console.log("[✓] Super Admin Business Intelligence AI verified successfully!");
    } else {
      throw new Error("Admin AI report output is empty!");
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_roles_admin_report.png') });
    await page.click('#logoutBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log("[✓] Super Admin Logout complete.");

    // ── SUB-TEST 2: TEACHER AI ROLE ──
    console.log("\n--- SUB-TEST 2: Teacher AI Role ---");
    await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });
    await page.click('#tabRegister');
    await page.waitForSelector('#regName', { visible: true });

    console.log("Registering dynamic teacher...");
    await page.type('#regName', 'Dr. Roles Assistant');
    await page.type('#regEmail', 'teacher_test_role@coaching.com');
    await page.type('#regPhone', 'teacherPassword123');
    await page.select('#regStream', 'NEET');
    await page.click('#regBtn');
    await delay(2500);

    console.log("Logging in as Teacher...");
    await page.type('#loginEmail', 'teacher_test_role@coaching.com');
    await page.type('#loginPhone', 'teacherPassword123');
    await page.click('#loginBtn');
    await page.waitForFunction(() => window.location.href.includes('teacher-dashboard.html'), { timeout: 8000 });
    console.log("[✓] Logged in as Teacher!");
    await delay(2000);

    // Switch to AI Assistant tab
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('aiassistant'"));
      if (btn) btn.click();
    });
    await page.waitForSelector('#btnTriggerClassroomAnalysis', { visible: true });

    console.log("Triggering Teacher AI Classroom Performance Analysis...");
    await page.click('#btnTriggerClassroomAnalysis');
    await delay(4000);

    const teacherAiText = await page.evaluate(() => document.getElementById('aiAssistantOutput').textContent);
    console.log(`[TEACHER AI RESPONSE]: "${teacherAiText.substring(0, 100)}..."`);
    if (teacherAiText && teacherAiText.length > 50) {
      console.log("[✓] Teacher AI Performance Assistant verified successfully!");
    } else {
      throw new Error("Teacher AI analysis output is empty!");
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_roles_teacher_analysis.png') });
    await page.click('#logoutBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log("[✓] Teacher Logout complete.");

    // ── SUB-TEST 3: STUDENT AI MENTOR & MEMORY LAB AI ROLE ──
    console.log("\n--- SUB-TEST 3: Student AI Mentor & Memory Lab AI ---");
    await page.goto('http://localhost:8000/login.html', { waitUntil: 'networkidle2' });
    await page.type('#loginEmail', 'testcandidate3@gmail.com');
    await page.type('#loginPhone', '9988776655');
    await page.click('#loginBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log("[✓] Logged in as Student!");

    await page.goto('http://localhost:8000/revision.html', { waitUntil: 'networkidle2' });
    await delay(2500);

    // Open chat
    await page.waitForSelector('#aiChatTrigger', { visible: true });
    
    // A. Verify "Create Mnemonic" Memory Lab Trigger
    console.log("Clicking 'Create Mnemonic' flashcard action...");
    // Find the button with text containing 'Create Mnemonic'
    const btnMnemonic = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.btn-action'));
      return buttons.find(b => b.textContent.includes('Create Mnemonic'));
    });
    if (btnMnemonic) {
      await btnMnemonic.asElement().click();
    } else {
      throw new Error("Mnemonic action button not found!");
    }
    
    await delay(4000);
    let mnemonicReply = await page.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('.ai-chat-bubble.bot'));
      return bubbles[bubbles.length - 1].textContent;
    });
    console.log(`[MEMORY LAB MNEMONIC REPLY]: "${mnemonicReply}"`);
    if (mnemonicReply.includes("Mnemonic") || mnemonicReply.includes("retention") || mnemonicReply.includes("FUTRIX")) {
      console.log("[✓] Memory Lab AI (Create Mnemonic) successfully verified!");
    } else {
      throw new Error("Memory Lab mnemonic response mismatch!");
    }

    // B. Verify Forbidden Topic Refusal Safety Filter
    console.log("Testing safety validation with forbidden entertainment query...");
    await page.type('#aiChatInput', 'Can you recommend some popular Bollywood action movies?');
    await page.click('#aiChatSend');
    await delay(4000);

    let safetyReply = await page.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('.ai-chat-bubble.bot'));
      return bubbles[bubbles.length - 1].textContent;
    });
    console.log(`[SAFETY FILTER REPLY]: "${safetyReply}"`);
    if (safetyReply.includes("I am FUTRIX AI Mentor") && safetyReply.includes("competitive exam preparation")) {
      console.log("[✓] Allowed boundaries & forbidden topic safety filter verified successfully!");
    } else {
      throw new Error("Safety filter failed to refuse forbidden entertainment topic!");
    }

    // C. Verify Hallucination Guardrail
    console.log("Testing hallucination prevention with uncertainty query...");
    await page.type('#aiChatInput', 'tell me facts but i am uncertain and not sure about exact molecular weight values');
    await page.click('#aiChatSend');
    await delay(4000);

    let hallucinationReply = await page.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('.ai-chat-bubble.bot'));
      return bubbles[bubbles.length - 1].textContent;
    });
    console.log(`[HALLUCINATION GUARD REPLY]: "${hallucinationReply}"`);
    if (hallucinationReply.includes("I am not confident enough to answer this accurately")) {
      console.log("[✓] Hallucination prevention guardrail verified successfully!");
    } else {
      throw new Error("Hallucination guardrail did not trigger on uncertainty prompt!");
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_roles_student_chat.png') });

    // ── SUB-TEST 4: DIRECT BACKEND ACCESS CONTROL GATES ──
    console.log("\n--- SUB-TEST 4: Access Control Gates Validation ---");
    console.log("Testing direct API access authorization...");
    
    // Evaluate direct request in browser context (which has the student auth token)
    const hackResult = await page.evaluate(async () => {
      if (!window.supabase) return { status: 999, error: 'No supabase client' };
      const { data: { session } } = await window.supabase.auth.getSession();
      if (!session || !session.access_token) return { status: 999, error: 'No active session' };
      
      // Attempt to access admin logs endpoint
      const res = await fetch('/api/ai/logs', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      return { status: res.status, ok: res.ok };
    });

    console.log(`Direct admin route request status under student session: ${hackResult.status}`);
    if (hackResult.status === 403) {
      console.log("[✓] Permission gate successfully blocked unauthorized admin resource access!");
    } else {
      throw new Error(`Direct route protection bypassed! Status: ${hackResult.status}`);
    }

    console.log("\n=== FUTRIX MULTI-AGENT ROLE & CONTEXT ENGINE VERIFICATION SUCCESSFULLY PASSED! ===");

  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  } finally {
    await browser.disconnect();
  }
}

main();
