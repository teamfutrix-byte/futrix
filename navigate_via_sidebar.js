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
    console.log("No Supabase tab found.");
    await browser.disconnect();
    return;
  }

  console.log("Finding and clicking the 'Backups' sidebar item...");
  const clicked = await targetPage.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const backupsLink = links.find(l => l.innerText.trim() === 'Backups');
    if (backupsLink) {
      backupsLink.click();
      return true;
    }
    return false;
  });

  if (clicked) {
    console.log("Clicked successfully. Waiting 6 seconds for page load...");
    await new Promise(r => setTimeout(r, 6000));
    
    const screenshotPath = path.join(ARTIFACTS_DIR, 'backups_page_real.png');
    await targetPage.screenshot({ path: screenshotPath });
    console.log(`[✓] Screenshot saved to: ${screenshotPath}`);
  } else {
    console.error("[✗] Could not find Backups sidebar link.");
  }

  await browser.disconnect();
}

main().catch(err => console.error("Error:", err));
