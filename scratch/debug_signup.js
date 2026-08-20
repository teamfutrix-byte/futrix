const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function debug() {
  console.log('Starting local server...');
  const server = spawn('node', ['server.js']);
  
  // Wait 3 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--allow-running-insecure-content', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setBypassCSP(true);

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
  });

  console.log('Navigating to local onboarding page...');
  await page.goto('http://localhost:8000/host/features/student/index.html', { waitUntil: 'networkidle2' });

  // Get the HTML of prepGrid
  const prepGridHtml = await page.evaluate(() => {
    const el = document.getElementById('prepGrid');
    return el ? el.innerHTML : 'prepGrid element not found';
  });

  console.log('--- prepGrid HTML content ---');
  console.log(prepGridHtml);
  console.log('-----------------------------');

  console.log('Closing browser...');
  await browser.close();
  
  console.log('Stopping local server...');
  server.kill();
  process.exit(0);
}

debug();
