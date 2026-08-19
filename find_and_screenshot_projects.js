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
  console.log("All open pages:");
  for (const page of pages) {
    const url = page.url();
    console.log(`- ${url}`);
    if (url.includes('supabase.com')) {
      targetPage = page;
    }
  }

  if (!targetPage) {
    console.log("No Supabase page found.");
    await browser.disconnect();
    return;
  }

  console.log(`Targeting page: ${targetPage.url()}`);
  const title = await targetPage.title();
  console.log(`Page Title: ${title}`);
  
  const screenshotPath = path.join(ARTIFACTS_DIR, 'supabase_active_view.png');
  await targetPage.screenshot({ path: screenshotPath });
  console.log(`[✓] Screenshot saved to: ${screenshotPath}`);

  // Fetch buttons and links
  const elements = await targetPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    return btns.map(el => ({
      tagName: el.tagName,
      text: el.innerText.trim(),
      href: el.href || null,
      className: el.className
    })).filter(el => el.text.length > 0);
  });

  console.log("Interactive elements count:", elements.length);
  console.log("Elements:", JSON.stringify(elements.slice(0, 30), null, 2));

  await browser.disconnect();
}

main().catch(err => console.error("Error:", err));
