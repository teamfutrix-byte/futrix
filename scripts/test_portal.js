const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('[+] Launching Puppeteer browser (watch your screen)...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  
  // Register dialog handler to automatically accept alerts
  page.on('dialog', async dialog => {
    console.log('[✓] Alert Dialog opened:', dialog.message());
    await dialog.accept();
  });

  try {
    // 1. Navigate to admin login
    console.log('[+] Navigating to admin login page...');
    await page.goto('http://127.0.0.1:8000/features/auth/admin-login.html');
    await page.waitForSelector('#loginEmail');

    // 2. Login as Super Admin
    console.log('[+] Logging in as Super Admin...');
    await page.type('#loginEmail', '$uperadmin@futrix.com');
    await page.type('#loginPhone', '$anjana@123man');
    await page.click('#loginBtn');

    // 3. Wait for dashboard redirection
    console.log('[+] Waiting for Admin Dashboard...');
    await page.waitForSelector('#aie-tab-btn-import', { timeout: 15000 });

    // 4. Navigate to Question Bank
    console.log('[+] Clicking on Question Bank side tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const qbBtn = btns.find(b => b.textContent.includes('Question Bank'));
      if (qbBtn) qbBtn.click();
    });
    await page.waitForSelector('#aie-tab-btn-import');
    await new Promise(r => setTimeout(r, 1000));

    // 5. Navigate to Import Center
    console.log('[+] Opening Import Center sub-tab...');
    await page.evaluate(() => document.getElementById('aie-tab-btn-import').click());
    await page.waitForSelector('#aieImportFileInput');
    await new Promise(r => setTimeout(r, 1000));

    // 6. Upload JEE CSV file
    console.log('[+] Uploading btech_jee_2020.csv...');
    const fileInput = await page.$('#aieImportFileInput');
    await fileInput.uploadFile(path.join(__dirname, '..', 'btech_jee_2020.csv'));

    // Wait for mock upload animation and dialog accept
    console.log('[+] Waiting for ingestion to finish......');
    await new Promise(r => setTimeout(r, 5000));

    // 7. Verify inside Library
    console.log('[+] Switching to Library & Search sub-tab...');
    await page.evaluate(() => document.getElementById('aie-tab-btn-library').click());
    await new Promise(r => setTimeout(r, 3000));

    // Search for Young's Modulus
    console.log('[+] Searching for Young\'s modulus question...');
    await page.type('#qbSearchQuery', "Young's modulus");
    await page.evaluate(() => {
      loadQbQuestions();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Take screenshot of imported JEE questions
    console.log('[+] Taking screenshot of Admin Question Bank...');
    await page.screenshot({ path: path.join(__dirname, '..', 'admin_question_bank.png') });

    // 8. Sign out / navigate back to login
    console.log('[+] Navigating back to login page...');
    await page.goto('http://127.0.0.1:8000/features/auth/login.html');
    await page.waitForSelector('#loginEmail');

    // 9. Login as Candidate
    console.log('[+] Logging in as Candidate...');
    await page.type('#loginEmail', 'ms71766@gmail.com');
    await page.type('#loginPhone', '8707093973');
    await page.click('#loginBtn');

    // 10. Wait for redirection
    console.log('[+] Waiting for Candidate redirection...');
    await new Promise(r => setTimeout(r, 3000));

    // 11. Go to Active Exams
    console.log('[+] Opening Active Exams catalog...');
    await page.goto('http://127.0.0.1:8000/features/tests/active-exams.html');
    
    // Print session storage user data
    const userSession = await page.evaluate(() => sessionStorage.getItem('futrix_user'));
    console.log('[DEBUG] futrix_user in sessionStorage:', userSession);
    
    await page.waitForSelector('.exam-category-card');
    await new Promise(r => setTimeout(r, 2000));

    // 12. Open NEET Test Center
    console.log('[+] Opening NEET Test Center view directly...');
    await page.evaluate(() => {
      openExamDetailView('NEET');
    });
    
    // Wait for tests to load and render cards
    console.log('[+] Waiting for challenge cards to load...');
    await page.waitForSelector('.challenge-card', { timeout: 10000 }).catch(() => {});
    
    // Log rendered challenge card details
    const cardTitles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.challenge-card')).map(c => {
        const titleEl = c.querySelector('.card-title');
        const btnEl = c.querySelector('.btn-start-test-action, .btn-start-card');
        return {
          title: titleEl ? titleEl.textContent.trim() : 'No Title',
          buttonText: btnEl ? btnEl.textContent.trim() : 'No Button'
        };
      });
    });
    console.log('[DEBUG] Rendered challenge cards:', JSON.stringify(cardTitles, null, 2));

    // 13. Select NEET 2020 Biology Subject Test
    console.log('[+] Locating NEET 2020 Biology Subject Test...');
    const clicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.challenge-card'));
      const bioCard = cards.find(c => c.innerHTML.includes('NEET 2020 Biology Subject Test'));
      if (bioCard) {
        const btn = bioCard.querySelector('.btn-start-test-action');
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('[DEBUG] Clicked start button:', clicked);
    await page.waitForSelector('#confirmCheck', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // 14. Proceed on Instruction page
    console.log('[+] Proceeding past instructions page...');
    await page.waitForSelector('#confirmCheck');
    await page.click('#confirmCheck');
    await page.click('#startTestBtn');
    await page.waitForSelector('#testLanguageSelect', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // 15. In exam.html - Test Bilingual Language toggler
    console.log('[+] Exam started. Testing bilingual toggling...');
    await page.waitForSelector('#qText');
    
    // Take screenshot in English
    console.log('[+] Taking screenshot in English...');
    await page.screenshot({ path: path.join(__dirname, '..', 'candidate_exam_english.png') });
    await new Promise(r => setTimeout(r, 1000));
    
    // Toggle to Hindi
    console.log('[+] Toggling language to Hindi...');
    await page.select('#testLanguageSelect', 'Hindi');
    await new Promise(r => setTimeout(r, 2000));
    
    // Take screenshot in Hindi
    console.log('[+] Taking screenshot in Hindi...');
    await page.screenshot({ path: path.join(__dirname, '..', 'candidate_exam_hindi.png') });
    await new Promise(r => setTimeout(r, 2000));
    
    // Toggle back to English
    console.log('[+] Toggling language back to English...');
    await page.select('#testLanguageSelect', 'English');
    await new Promise(r => setTimeout(r, 2000));

    console.log('[✓] Portal automation testing completed successfully!');

  } catch (err) {
    console.error('[X] Puppeteer Testing Error:', err);
  } finally {
    console.log('[+] Closing browser in 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
  }
})();
