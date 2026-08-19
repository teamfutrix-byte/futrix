const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\f8172e77-5228-4e79-98a5-57b52aeff003';

async function runCheck() {
  console.log("Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Monitor page console errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  try {
    console.log("Navigating to student registration page...");
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle2' });
    
    // Wait for dynamic elements to render
    await page.waitForSelector('#fullName', { timeout: 5000 });
    
    // Screenshot 1: Home View
    const screenshot1Path = path.join(ARTIFACTS_DIR, 'step1_home.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`[✓] Screenshot 1 saved to: ${screenshot1Path}`);

    // Fill registration form
    console.log("Filling form...");
    await page.type('#fullName', 'Test Student');
    await page.type('#emailAddress', 'teamfutrix@gmail.com'); // Test with registered email
    await page.type('#phoneNumber', '9812345678');
    await page.type('#dob', '01/01/2000');
    await page.type('#guardianName', 'Test Parent');
    await page.type('#guardianContact', '9823456789');
    await page.type('#city', 'Delhi');
    await page.type('#qualification', '12th Pass');
    await page.type('#pinCode', '110001');

    // Click Category: Click on the NEET Prep button
    // It's a dynamically loaded prep-btn
    await page.waitForSelector('.prep-btn', { timeout: 5000 });
    const buttons = await page.$$('.prep-btn');
    if (buttons.length > 0) {
      await buttons[0].click();
      console.log("Selected stream category.");
    } else {
      console.warn("Category buttons not found!");
    }

    // Screenshot 2: Form Filled
    const screenshot2Path = path.join(ARTIFACTS_DIR, 'step2_filled.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`[✓] Screenshot 2 saved to: ${screenshot2Path}`);

    // Click Submit
    console.log("Clicking submit button...");
    await page.click('#submitBtn');

    // Wait for the OTP modal to appear
    console.log("Waiting for OTP modal...");
    await page.waitForSelector('#otpModal.show', { timeout: 8000 }).catch(e => {
      console.log("OTP modal did not show up in 8s. Checking page state...");
    });

    // Screenshot 3: Final State / OTP Modal
    const screenshot3Path = path.join(ARTIFACTS_DIR, 'step3_result.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`[✓] Screenshot 3 saved to: ${screenshot3Path}`);

  } catch (err) {
    console.error("Execution error during browser run:", err);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

runCheck();
