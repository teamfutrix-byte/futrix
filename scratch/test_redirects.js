const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[CONSOLE]', msg.text()));
  page.on('requestfailed', request => {
    console.log('Request Failed:', request.url(), 'Error:', request.failure().errorText);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP Error:', response.url(), 'Status:', response.status());
    }
  });

  try {
    // 1. Login first to set the session
    console.log('Logging in...');
    await page.goto('https://teamfutrix-byte.github.io/futrix/features/auth/login.html?t=' + Date.now(), { waitUntil: 'networkidle2' });
    await page.type('#loginEmail', 'ms71766@gmail.com');
    await page.type('#loginPhone', '8707093973');
    await page.click('#loginBtn');
    
    // Wait for navigation to instruction.html
    await page.waitForFunction(() => window.location.href.includes('instruction.html'), { timeout: 15000 });
    console.log('Logged in! Current URL:', page.url());

    // 2. Select test and click start
    await page.evaluate(() => {
      const select = document.getElementById('dashboardSelectTest');
      if (select) {
        select.value = 'NEET-CELL-DIV';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const checkbox = document.getElementById('confirmCheck');
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Clicking start test button...');
    await page.click('#startTestBtn');
    
    // Wait and track next URL / navigation failures
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Final URL after click:', page.url());
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
