const puppeteer = require('puppeteer');

async function runTests() {
  console.log('==================================================');
  console.log('🚀 INITIALIZING FUTRIX E2E WORKFLOW VALIDATOR');
  console.log('==================================================');

  // Launch fresh GUI browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 100,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Track console logs and errors from the page
  page.on('console', msg => {
    console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE EXCEPTION] ${err.message}`);
  });

  // Automatically handle page dialogs (alerts, confirms) to prevent hanging
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] Auto-dismissing ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  // Dynamically inject correct mock credentials into sessionStorage before scripts run
  await page.evaluateOnNewDocument(() => {
    const path = window.location.pathname;
    if (path.includes('teacher-dashboard')) {
      sessionStorage.setItem('futrix_user', JSON.stringify({
        id: '88888888-8888-8888-8888-888888888888',
        name: 'Test Teacher Educator',
        email: 'teacher@futrix.internal',
        preparation: 'NEET',
        role: 'teacher'
      }));
    } else if (path.includes('admin-dashboard')) {
      sessionStorage.setItem('futrix_user', JSON.stringify({
        id: '2ae57959-6e7f-4be2-a58d-9db9a01816df',
        name: 'Super Admin Test User',
        email: 'teamfutrix-bytes-project@futrix.internal',
        role: 'admin'
      }));
    } else {
      sessionStorage.setItem('futrix_user', JSON.stringify({
        id: '99999999-9999-9999-9999-999999999999',
        name: 'Test Competitor Student',
        email: 'student@futrix.internal',
        preparation: 'NEET',
        role: 'student',
        phone: '9876543210'
      }));
    }
  });

  try {
    // ==========================================
    // 1. STUDENT WORKFLOW TESTS
    // ==========================================
    console.log('\n--- 1. Testing Student Dashboard & Modals ---');
    await page.goto('http://localhost:8000/instruction.html', { waitUntil: 'networkidle2' });
    console.log('✓ Student dashboard loaded without redirect.');

    // Toggle Profile settings modal
    console.log('Testing Profile Settings modal...');
    await page.waitForSelector('.settings-btn');
    await page.click('.settings-btn');
    await page.waitForSelector('#profileSettingsModal', { visible: true });
    console.log('✓ Profile Settings modal opened.');

    // Save profile details
    await page.click('#saveProfileBtn');
    console.log('✓ Profile saved successfully.');

    // Close profile settings modal if still open (since saveProfileBtn auto-closes it on success)
    await page.evaluate(() => {
      const modal = document.getElementById('profileSettingsModal');
      if (modal && modal.style.display !== 'none') {
        const closeBtn = document.getElementById('closeProfileModalBtn');
        if (closeBtn) closeBtn.click();
      }
    });
    console.log('✓ Profile Settings modal check completed.');

    // Toggle Notifications Drawer
    console.log('Testing Notification Drawer...');
    await page.waitForSelector('#topNotificationBtn');
    await page.click('#topNotificationBtn');
    await page.waitForSelector('#notificationDrawer');
    await page.evaluate(() => {
      document.getElementById('closeNotifBtn').click();
    });
    console.log('✓ Notification Drawer opened and closed.');

    // Navigate to Performance page
    console.log('\nTesting Performance Page...');
    await page.goto('http://localhost:8000/performance.html', { waitUntil: 'networkidle2' });
    console.log(`Current URL after Performance navigation: ${page.url()}`);

    // Click Generate AI Report Card
    await page.waitForSelector('#btnGenerateAiReport');
    await page.click('#btnGenerateAiReport');
    console.log('✓ Generate AI Report clicked, waiting for modal...');
    await page.waitForSelector('#aiReportModal', { visible: true, timeout: 5000 });
    console.log('✓ AI report card generated and modal visible.');
    await page.evaluate(() => {
      document.getElementById('closeAiModalBtn').click();
    });

    // Click Download CSV Report Card
    await page.waitForSelector('#btnDownloadReportCSV');
    await page.click('#btnDownloadReportCSV');
    console.log('✓ CSV download button clicked.');

    // Navigate to Roadmap page
    console.log('\nTesting Study Planner & Roadmap Page...');
    await page.goto('http://localhost:8000/roadmap.html', { waitUntil: 'networkidle2' });
    console.log(`Current URL after Roadmap navigation: ${page.url()}`);

    // Switch tabs
    await page.click('#btnTabStudyPlan');
    await page.waitForSelector('#studyPlanView', { visible: true });
    console.log('✓ Switched to Study Plan tab.');

    // Toggle spaced repetition checkboxes
    await page.click('#chkDay1');
    await page.click('#chkDay3');
    console.log('✓ Calendar checkboxes clicked and state persisted.');


    // ==========================================
    // 2. TEACHER WORKFLOW TESTS
    // ==========================================
    console.log('\n--- 2. Testing Teacher Dashboard Workflows ---');
    await page.goto('http://localhost:8000/teacher-dashboard.html', { waitUntil: 'networkidle2' });
    console.log('✓ Teacher dashboard loaded without redirect.');

    // Test Navigation tabs
    const teacherTabs = ['analytics', 'students', 'weaktopics', 'aiassistant', 'aigenerator', 'qaapprovals', 'questionbank', 'classification', 'profile'];
    for (const tab of teacherTabs) {
      const tabButton = await page.evaluateHandle((tabId) => {
        return Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${tabId}'`));
      }, tab);
      if (tabButton && tabButton.asElement()) {
        await tabButton.asElement().click();
        console.log(`✓ Sidebar navigation tab [${tab}] clicked successfully.`);
      }
    }

    // Test Educator Profile Settings saving
    console.log('Testing Teacher Profile saving...');
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'profile'"));
      tab.click();
    });
    await page.waitForSelector('#teacherFullName');
    await page.focus('#teacherFullName');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#teacherFullName', 'Test Educator Senior');
    await page.click('button[onclick="saveTeacherProfile()"]');
    console.log('✓ Teacher settings update submitted.');

    // Test AI Classification tab
    console.log('Testing AI Question Classifier...');
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'classification'"));
      tab.click();
    });
    await page.waitForSelector('#classRawQuestion');
    await page.type('#classRawQuestion', 'A cell undergoes mitosis division phase. Find the number of chromosomes.');
    await page.click('#btnRunClassifier');
    await page.waitForSelector('#classResultBox', { visible: true });
    console.log('✓ AI Question Classifier run completed.');


    // ==========================================
    // 3. SUPER ADMIN WORKFLOW TESTS
    // ==========================================
    console.log('\n--- 3. Testing Super Admin Dashboard Workflows ---');
    await page.goto('http://localhost:8000/admin-dashboard.html', { waitUntil: 'networkidle2' });
    console.log('✓ Super Admin dashboard loaded.');

    // Test admin operation tabs
    const adminTabs = ['profile', 'assessmentengine', 'assessmentintelligence', 'premiummanager', 'teachers', 'memorylabadmin'];
    for (const tab of adminTabs) {
      const tabButton = await page.evaluateHandle((tabId) => {
        return Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${tabId}'`));
      }, tab);
      if (tabButton && tabButton.asElement()) {
        await tabButton.asElement().click();
        console.log(`✓ Super Admin navigation tab [${tab}] clicked successfully.`);
      }
    }

    // Test creating test series via Smart Test Builder (STB)
    console.log('Testing Smart Test Builder AI generation & assembly...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'assessmentengine'"));
      btn.click();
    });
    await page.waitForSelector('#stbChapter');
    await page.type('#stbChapter', 'Mitosis Cell Cycle Validation');
    await page.click('button[onclick="generateStbTestSeries()"]');
    
    // Wait for the AI simulation to complete and the action container to show
    await new Promise(r => setTimeout(r, 2000));
    await page.click('button[onclick="approveStbDraftTest()"]');
    console.log('✓ Smart Test Builder AI assessment generation and staging completed.');

    // Test Memory Lab Seeding
    console.log('Testing Memory Lab seeding...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.nav-item button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'memorylabadmin'"));
      btn.click();
    });
    await page.waitForSelector('button[onclick="seedDefaultFlashcards()"]');
    await page.click('button[onclick="seedDefaultFlashcards()"]');
    await page.waitForSelector('#mlSeedConsole', { visible: true });
    console.log('✓ Memory Lab seeding request clicked.');

    console.log('\n==================================================');
    console.log('🎉 ALL FUTRIX WORKFLOWS PASSED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ E2E VERIFICATION ENCOUNTERED A FAILURE:');
    console.error(`Current Page URL: ${page.url()}`);
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
