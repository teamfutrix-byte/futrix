const puppeteer = require('puppeteer');

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

  console.log("Navigating to Database Settings to inspect links...");
  await targetPage.goto('https://supabase.com/dashboard/project/dsduytkikxfgiyptdwex/settings/database', {
    waitUntil: 'domcontentloaded'
  });

  console.log("Waiting for sidebar to render...");
  await new Promise(r => setTimeout(r, 5000));

  const links = await targetPage.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors.map(a => ({
      text: a.innerText.trim(),
      href: a.href
    })).filter(item => item.text.length > 0);
  });

  console.log("Found links in sidebar/page:", JSON.stringify(links, null, 2));

  await browser.disconnect();
}

main().catch(err => console.error("Error:", err));
