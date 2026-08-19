const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('supabase.com/dashboard/project/dsduytkikxfgiyptdwex'));
  if (!page) {
    console.error("Supabase Auth page not found!");
    await browser.disconnect();
    return;
  }

  console.log("Navigating to providers page...");
  await page.goto('https://supabase.com/dashboard/project/dsduytkikxfgiyptdwex/auth/providers', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("Analyzing Confirm Email checkbox state...");

  const result = await page.evaluate(() => {
    // Helper to find label with text
    const labels = Array.from(document.querySelectorAll('label'));
    const confirmLabel = labels.find(l => l.innerText.includes('Confirm email'));
    if (!confirmLabel) return { success: false, error: 'Confirm email label not found' };

    const grandparent = confirmLabel.closest('.relative') || confirmLabel.parentElement.parentElement;
    if (!grandparent) return { success: false, error: 'Grandparent container not found' };

    const switchBtn = grandparent.querySelector('button[role="switch"]');
    const input = grandparent.querySelector('input[type="checkbox"]');
    
    if (switchBtn) {
      const isChecked = switchBtn.getAttribute('aria-checked') === 'true' || switchBtn.getAttribute('data-state') === 'checked';
      if (isChecked) {
        switchBtn.click();
        return { success: true, toggled: true, msg: 'Toggled Radix switch OFF' };
      } else {
        return { success: true, toggled: false, msg: 'Radix switch already OFF' };
      }
    } else if (input) {
      const isChecked = input.checked;
      if (isChecked) {
        input.click();
        return { success: true, toggled: true, msg: 'Clicked checkbox input OFF' };
      } else {
        return { success: true, toggled: false, msg: 'Checkbox input already OFF' };
      }
    }
    return { success: false, error: 'No Radix switch or checkbox found in grandparent' };
  });

  console.log("Toggle result:", result);

  if (result.success && result.toggled) {
    console.log("Waiting 1s before saving...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("Clicking 'Save changes' button...");
    const saveClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => b.innerText.includes('Save changes'));
      if (saveBtn) {
        if (saveBtn.disabled || saveBtn.getAttribute('aria-disabled') === 'true' || saveBtn.className.includes('cursor-not-allowed')) {
          return { success: false, msg: 'Save button is disabled or not clickable' };
        }
        saveBtn.click();
        return { success: true };
      }
      return { success: false, msg: 'Save button not found' };
    });
    console.log("Save click result:", saveClicked);

    if (saveClicked.success) {
      console.log("Waiting 3s for save to complete...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  await browser.disconnect();
}

main().catch(err => console.error(err));
