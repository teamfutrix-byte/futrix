const puppeteer = require('puppeteer');

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

    const values = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(i => ({
        id: i.id,
        name: i.name,
        placeholder: i.placeholder,
        value: i.type === 'password' ? '********' : i.value,
        type: i.type
      }));
    });

    console.log("=== Supabase Inputs ===");
    console.log(JSON.stringify(values, null, 2));

    await browser.disconnect();
  } catch (err) {
    console.error("Error reading inputs:", err);
  }
}

main();
