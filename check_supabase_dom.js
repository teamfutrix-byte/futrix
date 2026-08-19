const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('supabase.com/dashboard/project/dsduytkikxfgiyptdwex/auth/providers'));
  if (!page) {
    console.error("Supabase Auth page not found!");
    await browser.disconnect();
    return;
  }

  console.log("Analyzing Supabase Auth Providers page...");

  // Let's get the list of buttons and text
  const elements = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('button, input, label, h3, h4'));
    return items.map(el => {
      let label = '';
      if (el.tagName === 'BUTTON') label = el.innerText.trim();
      else if (el.tagName === 'INPUT') label = el.id || el.name || el.type;
      else if (el.tagName === 'LABEL') label = el.innerText.trim();
      else label = el.innerText.trim();
      return {
        tag: el.tagName,
        text: label,
        id: el.id || null,
        className: el.className || null
      };
    }).filter(x => x.text && x.text.length > 0);
  });

  console.log("Found elements:", JSON.stringify(elements, null, 2));

  await browser.disconnect();
}

main();
