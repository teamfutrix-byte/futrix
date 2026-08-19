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

    console.log("Clicking Emails sidebar link...");
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const emailsLink = links.find(l => l.innerText.trim() === 'Emails');
      if (emailsLink) emailsLink.click();
      else console.error("Emails link not found via text match.");
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'supabase_emails_view.png') });
    console.log("[✓] Screenshot saved to supabase_emails_view.png");

    await browser.disconnect();
  } catch (err) {
    console.error("Error clicking emails sidebar:", err);
  }
}

main();
