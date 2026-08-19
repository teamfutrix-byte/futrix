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

  const html = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const confirmLabel = labels.find(l => l.innerText.includes('Confirm email'));
    if (!confirmLabel) return 'Confirm email label not found';
    return confirmLabel.parentElement.parentElement.outerHTML;
  });

  console.log("Outer HTML of grandparent container:", html);

  await browser.disconnect();
}

main();
