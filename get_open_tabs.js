const puppeteer = require('puppeteer');

async function main() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    console.log("=== Open Chrome Tabs ===");
    pages.forEach((p, idx) => {
      console.log(`[Tab ${idx}] Title: ${p.title()}`);
      console.log(`      URL: ${p.url()}`);
    });
    
    await browser.disconnect();
  } catch (err) {
    console.error("Error connecting to debug Chrome:", err.message);
  }
}

main();
