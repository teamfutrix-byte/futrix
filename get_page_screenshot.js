const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

async function main() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const url = p.url();
      console.log(`[Tab ${i}] URL: ${url}`);
      try {
        const screenshotPath = path.join(ARTIFACTS_DIR, `tab_${i}_screenshot.png`);
        await p.screenshot({ path: screenshotPath });
        console.log(`  Saved screenshot to ${screenshotPath}`);
      } catch (err) {
        console.error(`  Failed screenshot for tab ${i}:`, err.message);
      }
    }

    await browser.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
