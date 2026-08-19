/**
 * FUTRIX E2E INTEGRATION TEST - ENTERPRISE QUESTION BANK
 * Runs E2E tests validating the complete lifecycle:
 * 1. Content hashing & duplicate prevention.
 * 2. Question creation (v1) & metadata parsing.
 * 3. Question revision updates (v2) & lineage tracking.
 * 4. Version diffing comparisons.
 * 5. Version rollback (v3).
 * 6. Audit trail logging.
 * 7. Soft deletion, restoration, archiving.
 * 8. Bulk import, export, and transactional operations.
 * 9. Hybrid search query executions.
 */

const { Client } = require('pg');
const questionBank = require('./services/questionBank');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log('====================================================');
  console.log('🧪 FUTRIX QUESTION BANK INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  const client = new Client(dbConfig);
  await client.connect();
  console.log('✓ Successfully connected to PostgreSQL Database.');

  // Dynamically fetch a valid user ID from public.profiles to satisfy foreign keys
  const { rows: userRows } = await client.query('SELECT id FROM public.profiles LIMIT 1');
  if (userRows.length === 0) {
    console.error('❌ Failed to run tests: No users found in public.profiles table.');
    await client.end();
    process.exit(1);
  }
  const testUserId = userRows[0].id;
  console.log(`✓ Using test user ID: ${testUserId}`);

  // Set test state variables
  let testQuestionId = null;
  let testQuestionNum = null;

  try {
    // --------------------------------------------------------------------
    // TEST 1: Hashing & Duplicate Check
    // --------------------------------------------------------------------
    console.log('\n--- TEST 1: Content Hashing & Duplication Checks ---');
    const mockStem = 'Calculate the energy of a photon with wavelength 600 nm. [TEST_QB_' + Date.now() + ']';
    const mockOpts = { A: '3.3 x 10^-19 J', B: '2.5 x 10^-19 J', C: '4.1 x 10^-19 J', D: '1.2 x 10^-19 J' };
    
    const questionPayload = {
      question_text: mockStem,
      option_a: mockOpts.A,
      option_b: mockOpts.B,
      option_c: mockOpts.C,
      option_d: mockOpts.D,
      correct_answer: 'A',
      explanation: 'E = hc/lambda = (6.626e-34 * 3e8) / 600e-9 = 3.313e-19 J',
      detailed_solution: 'Step 1: Use Plancks equation.\nStep 2: Substitute constants.',
      topic: 'Dual Nature of Radiation',
      subject: 'Physics',
      exam: 'NEET',
      difficulty: 'Medium',
      marks: 4.00,
      negative_marks: -1.00,
      bloom_level: 'Apply',
      tags: ['Quantum Mechanics', 'Photons']
    };

    const hash = questionBank.generateContentHash(questionPayload);
    console.log(`- Generated SHA-256 Content Hash: ${hash}`);
    if (!hash || hash.length !== 64) throw new Error('Content hashing failed.');

    const dupResult = await questionBank.checkDuplicate(client, questionPayload);
    console.log(`- Duplicate Check Result (Expected duplicate: false): ${dupResult.duplicate}`);
    if (dupResult.duplicate) throw new Error('Unexpected duplicate flag on new question.');

    // --------------------------------------------------------------------
    // TEST 2: Save Question (v1)
    // --------------------------------------------------------------------
    console.log('\n--- TEST 2: Question Creation & Version 1 Save ---');
    const saved = await questionBank.saveQuestion(client, questionPayload, testUserId);
    testQuestionId = saved.id;
    testQuestionNum = saved.question_number;
    console.log(`- Saved New Question ID: ${testQuestionId}`);
    console.log(`- Assigned Question Number: ${testQuestionNum}`);
    console.log(`- Version Head: v${saved.version}`);
    console.log(`- Status: ${saved.status}`);

    if (saved.version !== 1) throw new Error('Expected initial version to be 1.');
    if (!saved.content_hash) throw new Error('Failed to persist content hash.');

    // Verify duplicate checks again
    const dupResultAfter = await questionBank.checkDuplicate(client, questionPayload);
    console.log(`- Duplicate Check Result after saving (Expected duplicate: true): ${dupResultAfter.duplicate}`);
    if (!dupResultAfter.duplicate) throw new Error('Duplicate check failed to detect existing question.');

    // --------------------------------------------------------------------
    // TEST 3: Create Revision (v2)
    // --------------------------------------------------------------------
    console.log('\n--- TEST 3: Create Version Revision (v2) ---');
    const updatedPayload = {
      ...questionPayload,
      question_text: mockStem + ' (Updated Revision Text)',
      option_a: '3.31 x 10^-19 Joules', // minor adjustment
    };

    const updated = await questionBank.createRevision(client, testQuestionId, updatedPayload, 'Adjusted Option A value to be more precise.', testUserId);
    console.log(`- Saved Revision ID: ${updated.id}`);
    console.log(`- New Head Version: v${updated.version}`);
    console.log(`- Stem Text: "${updated.question_text}"`);
    console.log(`- Change Summary: ${updated.change_summary}`);

    if (updated.version !== 2) throw new Error('Expected revision version to increment to 2.');

    // --------------------------------------------------------------------
    // TEST 4: Get Version Diff Comparisons
    // --------------------------------------------------------------------
    console.log('\n--- TEST 4: Version Difference Analysis ---');
    const diff = await questionBank.getVersionDiff(client, testQuestionId, 1, 2);
    console.log(`- Question Text Changed: ${diff.question_text.changed}`);
    console.log(`  - Old: "${diff.question_text.old}"`);
    console.log(`  - New: "${diff.question_text.new}"`);
    console.log(`- Option A Changed: ${diff.options.A.changed}`);
    console.log(`  - Old: "${diff.options.A.old}"`);
    console.log(`  - New: "${diff.options.A.new}"`);

    if (!diff.question_text.changed || !diff.options.A.changed) {
      throw new Error('Version diff failed to highlight expected changes.');
    }

    // --------------------------------------------------------------------
    // TEST 5: Version Rollback (v3)
    // --------------------------------------------------------------------
    console.log('\n--- TEST 5: Version Rollback Execution ---');
    const rolledBack = await questionBank.rollbackQuestion(client, testQuestionId, 1, testUserId);
    console.log(`- Rolled Back Question ID: ${rolledBack.id}`);
    console.log(`- New Head Version after rollback: v${rolledBack.version}`);
    console.log(`- Question Text Restored: "${rolledBack.question_text}"`);

    if (rolledBack.version !== 3) throw new Error('Expected rollback to increment version to 3.');
    if (rolledBack.question_text !== mockStem) throw new Error('Expected content to match original v1 stem.');

    // --------------------------------------------------------------------
    // TEST 6: Audit Trail Verification
    // --------------------------------------------------------------------
    console.log('\n--- TEST 6: Audit Trail & Lineage Logs ---');
    const trail = await questionBank.getAuditTrail(client, testQuestionId);
    console.log(`- Retrieved ${trail.length} audit logs:`);
    trail.forEach(t => {
      console.log(`  [${t.event}] v${t.version} - ${t.summary} by User: ${t.performed_by || t.user}`);
    });

    if (trail.length < 3) throw new Error('Missing expected audit trail events.');

    // --------------------------------------------------------------------
    // TEST 7: Soft Deletion, Restoration, Archiving
    // --------------------------------------------------------------------
    console.log('\n--- TEST 7: Soft Deletion, Restoration & Archiving ---');
    
    // Soft Delete
    const deleted = await questionBank.softDeleteQuestion(client, testQuestionId, testUserId, 'Obsolete topic parameters.');
    console.log(`- Soft Deleted status: ${deleted.status}`);
    if (deleted.status !== 'Soft Deleted') throw new Error('Failed to soft delete question.');

    // Restore
    const restored = await questionBank.restoreQuestion(client, testQuestionId, testUserId);
    console.log(`- Restored status: ${restored.status}`);
    if (restored.status !== 'Published') throw new Error('Failed to restore question.');

    // Archive
    const archived = await questionBank.archiveQuestion(client, testQuestionId, testUserId);
    console.log(`- Archived status: ${archived.status}`);
    if (archived.status !== 'Archived') throw new Error('Failed to archive question.');

    // --------------------------------------------------------------------
    // TEST 8: Hybrid Filterable Search
    // --------------------------------------------------------------------
    console.log('\n--- TEST 8: Hybrid Search & Filtering ---');
    const searchResults = await questionBank.searchQuestions(client, {
      exam: 'NEET',
      subject: 'Physics',
      status: 'Archived',
      difficulty: 'Medium'
    });
    console.log(`- Search matches found: ${searchResults.length}`);
    const foundTestQuestion = searchResults.some(q => q.id === testQuestionId);
    console.log(`- Found our test question in filtered results: ${foundTestQuestion}`);
    if (!foundTestQuestion) throw new Error('Failed to find archived question under filters.');

    // --------------------------------------------------------------------
    // TEST 9: Bulk Operations (Import, Export, Mass Update)
    // --------------------------------------------------------------------
    console.log('\n--- TEST 9: Transactional Bulk Operations ---');
    
    const bulkImportPayload = [
      {
        question_text: 'What is the SI unit of electric charge? [BULK_TEST_1]',
        option_a: 'Coulomb', option_b: 'Ampere', option_c: 'Volt', option_d: 'Ohm',
        correct_answer: 'A', topic: 'Electrostatics', subject: 'Physics', exam: 'NEET', difficulty: 'Easy',
        explanation: 'SI unit of electric charge is Coulomb (C).'
      },
      {
        question_text: 'Which element has the highest electronegativity? [BULK_TEST_2]',
        option_a: 'Oxygen', option_b: 'Fluorine', option_c: 'Chlorine', option_d: 'Nitrogen',
        correct_answer: 'B', topic: 'Chemical Bonding', subject: 'Chemistry', exam: 'JEE', difficulty: 'Easy',
        explanation: 'Fluorine is the most electronegative element in the periodic table.'
      }
    ];

    console.log('- Importing 2 questions in bulk...');
    const importResults = await questionBank.bulkImport(client, bulkImportPayload, testUserId);
    console.log(`  - Imported: ${importResults.imported}, Skipped: ${importResults.skipped}`);
    if (importResults.imported !== 2) throw new Error('Failed to import all bulk questions.');

    // Find their IDs to perform export & mass operate
    const { rows: bulkRows } = await client.query("SELECT id FROM public.questions WHERE question_text LIKE '%[BULK_TEST_%'");
    const bulkIds = bulkRows.map(r => r.id);
    console.log(`  - Found bulk imported IDs: [${bulkIds.join(', ')}]`);

    console.log('- Exporting bulk imported questions...');
    const exportedData = await questionBank.bulkExport(client, bulkIds, 'json');
    console.log(`  - Exported payload count: ${exportedData.length}`);
    if (exportedData.length !== 2) throw new Error('Export mismatch.');

    console.log('- Performing bulk operation (Archive)...');
    const bulkArchived = await questionBank.bulkOperate(client, bulkIds, 'archive', {}, testUserId);
    console.log(`  - Mass archived count: ${bulkArchived.count}`);
    if (bulkArchived.count !== 2) throw new Error('Mass archiving count mismatch.');

    // Cleanup E2E test data to keep the database tidy
    console.log('\n--- CLEANUP: Removing E2E Test Elements ---');
    const cleanIds = [testQuestionId, ...bulkIds];
    
    await client.query("DELETE FROM public.question_versions WHERE question_id = ANY($1)", [cleanIds]);
    await client.query("DELETE FROM public.questions WHERE id = ANY($1)", [cleanIds]);
    console.log('✓ Successfully cleaned up all test questions and version revisions.');

    console.log('\n====================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✓');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE RUNTIME EXCEPTION DETECTED:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('DB Connection closed.');
  }
}

runTests();
