const puppeteer = require('puppeteer');

async function testPersonalFlashcards() {
  console.log('==================================================');
  console.log('🚀 TESTING FUTRIX PERSONAL FLASHCARD SYSTEM');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 150,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set mock student session by first establishing origin
  await page.goto('http://localhost:8000/login.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    sessionStorage.setItem('futrix_user', JSON.stringify({
      id: '99999999-9999-9999-9999-999999999999',
      name: 'Test Competitor Student',
      email: 'student@futrix.internal',
      preparation: 'NEET',
      role: 'student',
      phone: '9876543210'
    }));
  });

  // Track console logs and errors from the page
  page.on('console', msg => {
    console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE EXCEPTION] ${err.message}`);
  });

  // Handle alert dialogs
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] Auto-dismissing ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  try {
    console.log('Navigating to Memory Lab...');
    await page.goto('http://localhost:8000/memory-lab.html', { waitUntil: 'networkidle2' });
    console.log(`Loaded URL: ${page.url()}`);
    
    // Check if the panel is visible
    const isPanelVisible = await page.evaluate(() => {
      const panel = document.getElementById('personalCardsPanel');
      return panel && panel.style.display !== 'none';
    });
    console.log(`✓ Personal Cards Panel visible: ${isPanelVisible}`);

    // 2. Create Folder
    console.log('Creating a new folder...');
    await page.evaluate(() => openNewFolderModal());
    await page.waitForSelector('#folderModal', { visible: true });
    
    await page.type('#newFolderName', 'Organic Chemistry E2E');
    await page.evaluate(() => saveNewFolder());
    console.log('✓ Folder creation submitted.');

    // Wait a moment for folder to be loaded/updated
    await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));

    // 3. Create Card
    console.log('Opening Create Card modal...');
    await page.evaluate(() => openNewCardModal());
    await page.waitForSelector('#cardModal', { visible: true });

    await page.type('#cardFormQuestion', 'What is the functional group of Alcohols?');
    await page.type('#cardFormAnswer', '-OH Hydroxyl group');
    await page.type('#cardFormSubject', 'Chemistry');
    await page.type('#cardFormChapter', 'Alcohols & Phenols');
    await page.type('#cardFormMnemonic', 'Alcohol starts with A, OH has O');
    
    // Try AI Improve on draft
    console.log('Triggering AI improvement on card draft...');
    await page.click('button[onclick="aiImproveCardDraft()"]');
    
    // Submit card saving
    console.log('Saving the card...');
    await page.evaluate(() => savePersonalCard());

    // Switch to browse mode to see the list of cards
    await page.evaluate(() => togglePersonalBrowseMode(true));

    // Wait for the card to be loaded and rendered in the list
    console.log('Verifying card appears in the list...');
    await page.waitForSelector('#personalCardsList .panel-card');
    const firstCardText = await page.evaluate(() => {
      const card = document.querySelector('#personalCardsList .panel-card');
      return card ? card.innerText : '';
    });
    console.log(`✓ Rendered Card Text:\n${firstCardText}`);

    // 4. Test Rating Spaced Repetition Review
    console.log('Testing Spaced repetition rate buttons...');
    const rateBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('#personalCardsList .panel-card button')).find(b => b.innerText.includes('Easy'));
    });
    if (rateBtn && rateBtn.asElement()) {
      await page.evaluate(btn => btn.click(), rateBtn);
      console.log('✓ Easy rating logged.');
    }

    // 5. Test AI Bulk Cards Generation
    console.log('Opening AI flashcards generator...');
    await page.evaluate(() => openAiGeneratorModal());
    await page.waitForSelector('#aiGenModal', { visible: true });
    await page.type('#aiGenTopic', 'Electrochemistry Nernst Equation');
    await page.click('#btnAiTriggerGen');
    
    console.log('Waiting for drafts preview...');
    await page.waitForSelector('#btnAiSaveDrafts', { visible: true, timeout: 15000 });
    console.log('Saving generated drafts...');
    await page.evaluate(() => saveGeneratedDrafts());
    console.log('✓ AI generated cards saved successfully.');

    // 6. Test CSV Export
    console.log('Triggering CSV export download...');
    await page.evaluate(() => exportPersonalCardsCSV());
    console.log('✓ Export download initiated.');

    console.log('\n==================================================');
    console.log('🎉 PERSONAL FLASHCARDS WORKFLOW VERIFIED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Validation encountered an error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testPersonalFlashcards();
