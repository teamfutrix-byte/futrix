const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

async function main() {
  console.log("Connecting to Chrome on port 9222...");
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('localhost:8000')) || await browser.newPage();
  
  // Monitor console
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log("Navigating to index.html...");
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'networkidle2' });

  // Wait for categories to load
  await page.waitForSelector('.prep-btn');

  // Fill in the form fields
  console.log("Filling form...");
  await page.type('#fullName', 'Test Candidate');
  await page.type('#emailAddress', 'testcandidate2@gmail.com');
  await page.type('#phoneNumber', '9988776655');
  await page.type('#dob', '01/01/2000');
  await page.type('#guardianName', 'Sunil Kumar');
  await page.type('#guardianContact', '9988776654');
  await page.type('#city', 'Delhi');
  await page.type('#qualification', '12th Pass');
  await page.type('#instituteName', 'Futrix Institute');
  await page.type('#pinCode', '110001');

  // Select exam category
  console.log("Selecting exam category...");
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.prep-btn');
    if (buttons.length > 0) {
      buttons[0].click();
    }
  });

  // Take screenshot of filled form
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_index_filled.png') });
  console.log("Form filled screenshot saved.");

  // Click Submit
  console.log("Submitting form...");
  await page.click('#submitBtn');

  // Wait 5 seconds to see what happens
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check DOM state
  const state = await page.evaluate(() => {
    const otpModal = document.getElementById('otpModal');
    const toast = document.getElementById('toast');
    const successOverlay = document.getElementById('successOverlay');
    return {
      otpModalClass: otpModal ? otpModal.className : null,
      toastText: toast ? toast.innerText : null,
      toastClass: toast ? toast.className : null,
      successOverlayClass: successOverlay ? successOverlay.className : null
    };
  });

  console.log("Current page state:", JSON.stringify(state, null, 2));

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_index_post_submit.png') });
  console.log("Post-submit screenshot saved.");

  await browser.disconnect();
}

main().catch(err => console.error(err));
