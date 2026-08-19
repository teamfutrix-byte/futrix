const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\842db8fb-52b2-4d7f-a6a4-e027f5229a68';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Clear session to ensure fresh state
  await page.goto('http://localhost:8000/admin-login.html');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const errors = [];
  page.on('console', msg => {
    console.log(`[ADMIN CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error(`[ADMIN ERROR] ${err.message}`);
  });

  // Handle alerts / dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    try {
      await dialog.accept();
    } catch (e) {
      console.warn(`[DIALOG WARN] Handled dialog race: ${e.message}`);
    }
  });

  console.log("=== PHASE 1: Super Admin Login ===");
  await page.goto('http://localhost:8000/admin-login.html', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#loginEmail');

  await page.type('#loginEmail', "teamfutrix-bytes-project@futrix.internal");
  await page.type('#loginPhone', "FutrixAdmin#2026");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_1_login_filled.png') });

  console.log("Submitting login form...");
  await page.click('#loginBtn');

  // Wait for redirect to admin-dashboard.html
  await page.waitForFunction(() => window.location.href.includes('admin-dashboard.html'), { timeout: 10000 });
  console.log("Successfully logged in and redirected to admin-dashboard.html!");
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_2_dashboard_loaded.png') });

  console.log("=== PHASE 2: View Switching ===");
  const views = ['users', 'anticheat', 'ailogs', 'audit', 'settings', 'examcategories', 'featureflags', 'experiments', 'aicontrolcenter', 'systemhealth', 'devops', 'governance', 'payments'];
  for (const view of views) {
    console.log(`Switching to view: ${view}`);
    await page.evaluate((v) => {
      // Find the button associated with this view switch
      const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes(`switchView('${v}'`));
      if (button) button.click();
    }, view);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `admin_view_${view}.png`) });
  }

  console.log("=== PHASE 2b: AI Control Center Subtab Switcher ===");
  // Click Prompts subtab
  await page.evaluate(() => {
    const btn = document.getElementById('btnAiTabPrompts');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_aicontrolcenter_prompts.png') });

  // Click Analytics subtab
  await page.evaluate(() => {
    const btn = document.getElementById('btnAiTabAnalytics');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_aicontrolcenter_analytics.png') });

  // Reset to Providers
  await page.evaluate(() => {
    const btn = document.getElementById('btnAiTabProviders');
    if (btn) btn.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("=== PHASE 2c: DevOps View Custom Actions ===");
  // Switch to devops view explicitly just in case
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('devops'"));
    if (button) button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_devops_loaded.png') });

  // 1. Select dev environment
  console.log("Selecting Dev environment in selector...");
  await page.select('#devopsEnvSelector', 'dev');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_devops_dev_env.png') });

  // 2. Select back to production
  console.log("Selecting Production environment in selector...");
  await page.select('#devopsEnvSelector', 'production');
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 3. Initiate a rollout deployment
  console.log("Triggering simulated deployment rollout...");
  await page.click('button[onclick="triggerContainerDeployment()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_devops_rollout_progress.png') });

  // 4. Select a pod log stream
  console.log("Selecting pod container to stream logs...");
  await page.evaluate(() => {
    const selector = document.getElementById('devopsLogsPodSelector');
    if (selector && selector.options.length > 1) {
      selector.selectedIndex = 1;
      const event = new Event('change');
      selector.dispatchEvent(event);
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_devops_logs_streaming.png') });

  // 5. Trigger backup
  console.log("Triggering database backup...");
  await page.click('button[onclick="triggerDbBackup()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_devops_post_backup.png') });

  console.log("=== PHASE 2d: Governance View Custom Actions ===");
  // Switch to governance view explicitly just in case
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('governance'"));
    if (button) button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_governance_loaded.png') });

  // 1. Propose change proposal
  console.log("Proposing change proposal via modal...");
  await page.click('button[onclick="showProposeChangeModal()"]');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.type('#proposeChangeDesc', 'E2E Puppeteer test change description');
  await page.click('button[onclick="submitChangeProposal()"]');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_governance_post_propose.png') });

  // 2. Trigger Disaster Recovery Regional Failover
  console.log("Triggering Disaster Recovery regional failover...");
  await page.select('#govFailoverTargetCloud', 'AWS');
  await page.click('button[onclick="triggerRegionalCloudFailover()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_governance_post_failover.png') });

  // 3. Rotate Root secrets key
  console.log("Rotating root secrets key credentials...");
  await page.click('button[onclick="triggerRootSecretRotation()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_governance_post_key_rotation.png') });

  // 4. Developer Sandbox test query
  console.log("Testing developer sandbox API Gateway completions execution...");
  await page.click('button[onclick="executeSandboxApiCall()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_governance_sandbox_execution.png') });

  console.log("=== PHASE 2e: Payments View Custom Actions ===");
  // Switch to payments view explicitly
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('payments'"));
    if (button) button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_payments_loaded.png') });

  // 1. Calculate order checkout
  console.log("Calculating checkout order summary...");
  await page.select('#checkoutPlanSelector', 'plan_premium_monthly');
  await page.select('#checkoutCountrySelector', 'India');
  await page.click('button[onclick="initializeCheckoutSummary()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_payments_checkout_calculated.png') });

  // 2. Capture and complete checkout payment
  console.log("Capturing checkout payment signature...");
  await page.click('button[onclick="confirmSandboxPaymentCapture()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_payments_captured.png') });

  // 3. Switch to Premium Economy subtab
  console.log("Switching to Premium Economy subtab...");
  await page.click('#btnPayTabEconomy');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_economy_loaded.png') });

  // 4. Evaluate limit check enforcer
  console.log("Evaluating daily usage limit check...");
  await page.select('#usageActionSelector', 'ai_completion');
  await page.click('button[onclick="executeLimitCheck()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_economy_usage_check.png') });

  // 5. Estimate prorated upgrade
  console.log("Estimating prorated upgrade credit...");
  await page.select('#upgradeTargetPlan', 'plan_premium_annual');
  await page.click('button[onclick="estimateUpgradeProrata()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_economy_upgrade_prorated.png') });

  // 6. Referral code creation
  console.log("Generating referral code link...");
  await page.click('button[onclick="generateReferralCode()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_economy_referral_created.png') });

  // 7. Sponsoring gift subscription
  console.log("Purchasing sponsored gift subscription...");
  await page.type('#giftReceiverId', 'friend-e2e-recipient');
  await page.click('button[onclick="completeGiftPurchase()"]');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_view_economy_gift_completed.png') });

  console.log("=== PHASE 3: Adding Exam Category ===");
  // Switch back to examcategories
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.outerHTML.includes("switchView('examcategories'"));
    if (button) button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  const testCategoryName = `ADMIN_TEST_${Date.now()}`;
  console.log(`Typing new exam category name: ${testCategoryName}`);
  await page.type('#categoryName', testCategoryName);
  await page.type('#categoryDisplayName', `${testCategoryName} Prep`);
  
  // Submit category form
  console.log("Submitting new category form...");
  await page.click('#btnCategorySubmit');

  await new Promise(resolve => setTimeout(resolve, 2500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_category_added.png') });

  // Verify category exists in DOM list
  const categoryExistsInDOM = await page.evaluate((name) => {
    return document.body.innerText.includes(name);
  }, testCategoryName);
  console.log(`Is new category found in the dashboard list: ${categoryExistsInDOM}`);

  console.log("=== PHASE 4: Log Out ===");
  await page.click('#logoutBtn');
  await page.waitForFunction(() => window.location.href.includes('admin-login.html'), { timeout: 8000 });
  console.log("Successfully logged out and redirected to login page!");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_3_logged_out.png') });

  console.log("=== Verification Summary ===");
  console.log(`Page Errors: ${errors.length}`);
  errors.forEach(e => console.log("- " + e));

  await browser.close();
}

main().catch(err => console.error(err));
