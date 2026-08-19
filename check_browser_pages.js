const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  console.log("=== Open Pages ===");
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    try {
      const title = await page.title();
      const url = page.url();
      console.log(`Page ${i}: Title="${title}" URL="${url}"`);
    } catch (e) {
      console.log(`Page ${i}: [Error reading details: ${e.message}]`);
    }
  }

  await browser.disconnect();
}

main();
