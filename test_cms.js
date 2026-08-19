const { Client } = require('pg');
const cmsManager = require('./services/cmsManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE CMS ENGINE TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  const testContentId = 'test_landing_page';
  const authorId = 'admin_test';

  try {
    // 0. Clean slate E2E
    console.log("Cleaning old test page entries...");
    await db.query("DELETE FROM public.cms_versions WHERE content_id = $1", [testContentId]);
    await db.query("DELETE FROM public.cms_content WHERE id = $1", [testContentId]);
    await db.query("DELETE FROM public.cms_faqs WHERE id = 'test_faq_1'");
    await db.query("DELETE FROM public.cms_audit_logs WHERE target = $1", [testContentId]);

    // 1. Assert Draft content creation
    console.log("\n1. Testing draft content creation...");
    const draft = await cmsManager.saveContent(db, {
      id: testContentId,
      title: 'JEE Practice Hub',
      slug: 'jee-practice-hub',
      description: 'The master practice page for JEE exam candidates.',
      summary: 'Practice mocks for JEE prep.',
      category: 'Landing Page',
      authorId: authorId,
      contentBody: '{"hero": {"title": "Master JEE Prep"}}',
      status: 'Draft',
      keywords: ['jee prep', 'mock exams']
    });

    console.log(`- Saved version: ${draft.version}`);
    console.log(`- Approval status: ${draft.approvalStatus}`);
    console.log(`- SEO Score: ${draft.seoScore}`);

    if (draft.version !== 1) {
      throw new Error(`Expected initial version 1, got ${draft.version}`);
    }
    if (draft.approvalStatus !== 'Pending') {
      throw new Error(`Expected initial status Pending, got ${draft.approvalStatus}`);
    }
    console.log("✓ Draft content creation verified.");


    // 2. Assert Workflow state cycle (Draft -> Review -> Published)
    console.log("\n2. Testing workflow lifecycle state cycles...");
    // Submit for review
    const review = await cmsManager.saveContent(db, {
      id: testContentId,
      title: 'JEE Practice Hub',
      slug: 'jee-practice-hub',
      category: 'Landing Page',
      authorId: authorId,
      contentBody: '{"hero": {"title": "Master JEE Prep"}}',
      status: 'Review',
      keywords: ['jee prep', 'mock exams']
    });

    const { rows: contentReview } = await db.query(
      `SELECT status, approval_status FROM public.cms_content WHERE id = $1`,
      [testContentId]
    );
    console.log(`- State after review submit: status=${contentReview[0].status}, approval=${contentReview[0].approval_status}`);
    
    if (contentReview[0].status !== 'Review') {
      throw new Error(`Expected status Review, got ${contentReview[0].status}`);
    }

    // Approve and Publish
    const published = await cmsManager.saveContent(db, {
      id: testContentId,
      title: 'JEE Practice Hub',
      slug: 'jee-practice-hub',
      category: 'Landing Page',
      authorId: authorId,
      contentBody: '{"hero": {"title": "Master JEE Prep"}}',
      status: 'Published',
      keywords: ['jee prep', 'mock exams']
    });

    const { rows: contentPub } = await db.query(
      `SELECT status, approval_status, published_at FROM public.cms_content WHERE id = $1`,
      [testContentId]
    );
    console.log(`- State after publish: status=${contentPub[0].status}, approval=${contentPub[0].approval_status}`);
    
    if (contentPub[0].status !== 'Published' || contentPub[0].approval_status !== 'Approved') {
      throw new Error("Workflow failed to update status to Published & Approved.");
    }
    if (!contentPub[0].published_at) {
      throw new Error("Published date published_at not set.");
    }
    console.log("✓ Workflow lifecycle states verified.");


    // 3. Assert Version control & Git-like rollback
    console.log("\n3. Testing version control and Git-like rollback...");
    // Save version 2 changes
    const v2 = await cmsManager.saveContent(db, {
      id: testContentId,
      title: 'JEE Practice Hub v2',
      slug: 'jee-practice-hub-v2',
      category: 'Landing Page',
      authorId: authorId,
      contentBody: '{"hero": {"title": "Advanced JEE Preparation"}}',
      status: 'Published',
      keywords: ['jee prep', 'advanced prep'],
      changeSummary: 'Updated title to v2 and content body'
    });

    console.log(`- Saved updated version: ${v2.version}`);
    if (v2.version !== 4) {
      throw new Error(`Expected version 4, got ${v2.version}`);
    }

    // Verify version 1 is backed up in versions table
    const { rows: versionsLog } = await db.query(
      `SELECT * FROM public.cms_versions WHERE content_id = $1 ORDER BY version_number ASC`,
      [testContentId]
    );
    console.log(`- Backed up versions count: ${versionsLog.length}`);
    if (versionsLog.length === 0 || versionsLog[0].version_number !== 1) {
      throw new Error("Version history vault missing version 1 snapshot.");
    }
    console.log(`- Backed up version 1 content body: "${versionsLog[0].content_body}"`);

    // Perform rollback to version 1
    const rollback = await cmsManager.rollbackContent(db, {
      contentId: testContentId,
      targetVersionNumber: 1,
      actorId: authorId
    });

    console.log(`- Rollback completed. Current active version: ${rollback.currentVersion}`);
    if (rollback.currentVersion !== 5) {
      throw new Error(`Expected version 5 post-rollback, got ${rollback.currentVersion}`);
    }

    // Query active content and verify it matches version 1
    const { rows: contentActive } = await db.query(
      `SELECT title, content_body FROM public.cms_content WHERE id = $1`,
      [testContentId]
    );
    console.log(`- Active title post-rollback: "${contentActive[0].title}"`);
    console.log(`- Active content body post-rollback: "${contentActive[0].content_body}"`);

    if (contentActive[0].title !== 'JEE Practice Hub' || !contentActive[0].content_body.includes('Master JEE Prep')) {
      throw new Error("Rollback failed to restore content state to version 1 details.");
    }
    console.log("✓ Version logs and rollback checkpoints verified.");


    // 4. Assert SEO Engine calculations
    console.log("\n4. Testing SEO Engine suggestions and score calculations...");
    const poorScore = cmsManager.calculateSeoScore('Short', 'Short desc', 'Bad Slug Spaces!', []);
    const suggestions = cmsManager.getSeoSuggestions('Short', 'Short desc', 'Bad Slug Spaces!', []);
    
    console.log(`- Poor SEO parameters score: ${poorScore}/100`);
    console.log(`- Unoptimized alerts raised:`, suggestions);

    if (poorScore >= 50) {
      throw new Error("SEO engine failed to flag unoptimized metadata parameters.");
    }

    const goodScore = cmsManager.calculateSeoScore(
      'JEE Advanced Gamified Practice Portal Mocks',
      'Maximize your JEE score with our live gamified practice test platform. Compete on leaderboards and view real-time score statistics.',
      'jee-advanced-mocks-portal',
      ['jee prep', 'mock test']
    );
    console.log(`- Optimized SEO parameters score: ${goodScore}/100`);
    
    if (goodScore < 80) {
      throw new Error("SEO engine failed to compute a high score for optimized metadata.");
    }
    console.log("✓ SEO calculations and suggestions verified.");


    // 5. Assert Search Engine full-text query
    console.log("\n5. Testing search engine full-text queries...");
    const searchResult = await cmsManager.searchContent(db, 'Practice');
    console.log(`- Found pages matching 'Practice': ${searchResult.length}`);
    searchResult.forEach(r => console.log(`  * Match: Title="${r.title}", Slug="/${r.slug}"`));

    const hasJeePage = searchResult.some(r => r.id === testContentId);
    if (!hasJeePage) {
      throw new Error("Search engine failed to retrieve matching page for full-text query.");
    }
    console.log("✓ Search engine query verified.");


    // 6. Assert FAQ view counting and dynamic role menu trees
    console.log("\n6. Testing FAQ view statistics and navigation permissions...");
    // Save a test FAQ
    await db.query(
      `INSERT INTO public.cms_faqs (id, question, answer, category, display_order, visibility)
       VALUES ('test_faq_1', 'How does E2E testing work?', 'It connects directly to the Supabase client.', 'General', 1, 'Public')
       ON CONFLICT (id) DO NOTHING`
    );

    // Retrieve FAQ which will increment views
    const faqs1 = await cmsManager.getFaqs(db, 'General');
    const targetFaq1 = faqs1.find(f => f.id === 'test_faq_1');
    const initialViews = targetFaq1 ? targetFaq1.views : 0;
    console.log(`- FAQ views before request: ${initialViews}`);

    // Request again
    const faqs2 = await cmsManager.getFaqs(db, 'General');
    const targetFaq2 = faqs2.find(f => f.id === 'test_faq_1');
    const finalViews = targetFaq2 ? targetFaq2.views : 0;
    console.log(`- FAQ views after request: ${finalViews}`);

    if (finalViews <= initialViews) {
      throw new Error("FAQ view counter did not increment upon retrieve request.");
    }

    // Menu Dynamic Role filtering
    const guestMenu = await cmsManager.getMenu(db, 'menu_header', 'guest');
    const studentMenu = await cmsManager.getMenu(db, 'menu_header', 'student');

    console.log(`- Guest header menu links count: ${guestMenu.items.length}`);
    console.log(`- Student header menu links count: ${studentMenu.items.length}`);

    const hasStudentLinkInGuest = guestMenu.items.some(i => i.role === 'student');
    const hasStudentLinkInStudent = studentMenu.items.some(i => i.role === 'student');

    if (hasStudentLinkInGuest || !hasStudentLinkInStudent) {
      throw new Error("Menus failed to filter link nodes based on role restrictions.");
    }
    console.log("✓ FAQ popularity tracking and role-based menus verified.");


    // 7. Verify Dashboard KPIs
    console.log("\n7. Testing dashboard overview aggregates...");
    const stats = await cmsManager.getDashboardStats(db);
    console.log(`- Total pages count: ${stats.totalPages}`);
    console.log(`- Published pages: ${stats.publishedCount}`);
    console.log(`- Average SEO: ${stats.seoScoreAvg}%`);
    console.log(`- Recent audit logs retrieved: ${stats.recentActivities.length}`);

    if (stats.totalPages === 0) {
      throw new Error("Dashboard reports 0 pages in database, which is incorrect.");
    }
    console.log("✓ Dashboard stats query verified.");


    console.log("\n=== ALL CMS ENGINE TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ CMS TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Clean up E2E records
    console.log("\nCleaning up test logs...");
    await db.query("DELETE FROM public.cms_versions WHERE content_id = $1", [testContentId]);
    await db.query("DELETE FROM public.cms_content WHERE id = $1", [testContentId]);
    await db.query("DELETE FROM public.cms_faqs WHERE id = 'test_faq_1'");
    await db.query("DELETE FROM public.cms_audit_logs WHERE target = $1", [testContentId]);
    await db.end();
  }
}

runTests();
