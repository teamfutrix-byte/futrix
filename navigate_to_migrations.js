const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\f8172e77-5228-4e79-98a5-57b52aeff003';

async function main() {
  console.log("Connecting to Chrome...");
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let targetPage = null;
  for (const page of pages) {
    if (page.url().includes('supabase.com')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log("No Supabase page found.");
    await browser.disconnect();
    return;
  }

  console.log("Navigating to Database Migrations URL...");
  await targetPage.goto('https://supabase.com/dashboard/project/dsduytkikxfgiyptdwex/database/migrations', {
    waitUntil: 'domcontentloaded'
  });

  console.log("Waiting for page load...");
  await new Promise(r => setTimeout(r, 6000));

  const screenshotPath = path.join(ARTIFACTS_DIR, 'migrations_page.png');
  await targetPage.screenshot({ path: screenshotPath });
  console.log(`[✓] Screenshot saved to: ${screenshotPath}`);

  // Fetch page details
  const details = await targetPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const btnsText = btns.map(b => b.innerText.trim());
    return {
      bodyText: document.body.innerText.substring(0, 1500),
      buttons: btnsText
    };
  });

  console.log("Page details:", JSON.stringify(details, null, 2));

  await browser.disconnect();
}

main().catch(err => console.error("Error:", err));
