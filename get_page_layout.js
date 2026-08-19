const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\f8172e77-5228-4e79-98a5-57b52aeff003';

async function main() {
  console.log("Connecting to active Chrome session on port 9222...");
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  console.log("Successfully connected. Listing active pages...");
  const pages = await browser.pages();
  
  // Find a tab that has Supabase dashboard or use the active tab
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    console.log(`- Page: ${await page.title()} (${url})`);
    if (url.includes('supabase.com')) {
      targetPage = page;
    }
  }

  if (!targetPage) {
    console.log("No Supabase tab found, creating a new tab...");
    targetPage = await browser.newPage();
  }

  console.log("Navigating to Database Settings...");
  await targetPage.goto('https://supabase.com/dashboard/project/dsduytkikxfgiyptdwex/settings/database', {
    waitUntil: 'domcontentloaded'
  });

  console.log("Page loaded. Waiting 5 seconds to ensure all React elements render...");
  await new Promise(r => setTimeout(r, 5000));

  // Save screenshot
  const screenshotPath = path.join(ARTIFACTS_DIR, 'db_settings_page.png');
  await targetPage.screenshot({ path: screenshotPath });
  console.log(`[✓] Screenshot saved to: ${screenshotPath}`);

  // Find all buttons on the page
  const buttonsInfo = await targetPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => ({
      text: b.innerText.trim(),
      id: b.id,
      className: b.className,
      outerHTML: b.outerHTML.substring(0, 150)
    }));
  });

  console.log("\nFound buttons on page:", JSON.stringify(buttonsInfo, null, 2));

}

main().catch(err => console.error("Error:", err));
