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
    let page = pages.find(p => p.url().includes('supabase.com'));
    if (!page) {
      console.error("Supabase page not found!");
      await browser.disconnect();
      return;
    }

    console.log("Clicking SMTP Settings tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, a, span'));
      const smtpTab = tabs.find(t => t.innerText.trim() === 'SMTP Settings');
      if (smtpTab) smtpTab.click();
      else console.error("SMTP Settings tab not found.");
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'supabase_smtp_settings_view.png') });
    console.log("[✓] Screenshot saved to supabase_smtp_settings_view.png");

    await browser.disconnect();
  } catch (err) {
    console.error("Error clicking SMTP Settings tab:", err);
  }
}

main();
