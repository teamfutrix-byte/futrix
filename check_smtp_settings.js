const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\L470\\.gemini\\antigravity-ide\\brain\\d2074952-6ce0-4029-9666-6d8204c259be';

async function main() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    // Find the Supabase page or open a new tab
    let page = pages.find(p => p.url().includes('supabase.com'));
    if (!page) {
      console.log("Opening new tab for Supabase dashboard...");
      page = await browser.newPage();
    }

    console.log("Navigating to Supabase Auth SMTP Settings...");
    await page.goto('https://supabase.com/dashboard/project/dsduytkikxfgiyptdwex/auth/providers', { waitUntil: 'networkidle2' });
    
    // Wait for the page content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Screenshot current view
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'supabase_providers_view.png') });
    console.log("[✓] Screenshot saved.");

    // Scroll to SMTP section if exists, or click SMTP accordion
    const smtpStatus = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h3, span, button, label'));
      const smtpHeader = headers.find(h => h.innerText.includes('SMTP') || h.innerText.includes('Mail'));
      if (smtpHeader) {
        smtpHeader.scrollIntoView();
        return { found: true, text: smtpHeader.innerText };
      }
      return { found: false };
    });
    
    console.log("SMTP Section Search:", smtpStatus);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'supabase_smtp_view.png') });

    await browser.disconnect();
  } catch (err) {
    console.error("Error checking SMTP settings:", err);
  }
}

main();
