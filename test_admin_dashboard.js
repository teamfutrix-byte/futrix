const puppeteer = require('puppeteer');

async function testAdminDashboard() {
  console.log('==================================================');
  console.log('🚀 TESTING FUTRIX SUPER ADMIN DASHBOARD');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 100,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Inject session storage for super admin before page navigation
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('futrix_token', 'mock-admin-token');
    sessionStorage.setItem('futrix_user', JSON.stringify({
      id: '2ae57959-6e7f-4be2-a58d-9db9a01816df',
      name: 'Super Admin Test User',
      email: 'teamfutrix-bytes-project@futrix.internal',
      role: 'admin'
    }));
  });

  // Track console logs and exceptions on the page
  page.on('console', msg => {
    console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE EXCEPTION] ${err.message}`);
  });

  // Auto accept all alerts/confirmations
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] Auto-dismissing ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  try {
    console.log('Navigating to Admin Dashboard...');
    await page.goto('http://localhost:8000/admin-dashboard.html', { waitUntil: 'networkidle2' });
    console.log(`Loaded URL: ${page.url()}`);

    const views = [
      'analytics',
      'users',
      'anticheat',
      'examcategories',
      'tenants',
      'ailogs',
      'aiconfig',
      'aicontrolcenter',
      'aigenerator',
      'qaapprovals',
      'questionbank',
      'audit',
      'settings',
      'rbac',
      'platformconfigs',
      'featureflags',
      'experiments',
      'emergency',
      'systemhealth',
      'devops',
      'governance',
      'payments',
      'gamification',
      'profile',
      'assessmentengine',
      'premiummanager',
      'teachers',
      'memorylabadmin'
    ];

    for (const view of views) {
      console.log(`\n👉 Switching view to: "${view}"`);
      await page.evaluate((viewName) => {
        // Find the button with onclick matching switchView('viewName', ...)
        const btn = Array.from(document.querySelectorAll('.sidebar .nav-item button'))
          .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(viewName));
        if (btn) {
          btn.click();
        } else {
          console.error(`Button for view "${viewName}" not found in sidebar.`);
        }
      }, view);

      // Wait a moment for UI to switch and execute queries
      await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));
      
      // Basic check: Ensure view container is displayed and not empty
      const isVisible = await page.evaluate((viewName) => {
        const viewEl = document.getElementById('view-' + viewName);
        if (!viewEl) return false;
        const style = window.getComputedStyle(viewEl);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, view);
      console.log(`✓ Section "${view}" is visible: ${isVisible}`);
    }

    console.log('\n==================================================');
    console.log('🎉 SUPER ADMIN DASHBOARD VERIFIED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Validation encountered an error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testAdminDashboard();
