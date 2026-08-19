const { Client } = require('pg');
const { dbConfig } = require('./config/db');
const academicIntelligencePlatform = require('./services/academicIntelligencePlatform');

async function runTests() {
  console.log("=== STARTING ENTERPRISE ACADEMIC PLATFORM TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  let adminUserId = null;

  try {
    // 0. Seed or retrieve admin profile
    const { rows: adminRows } = await db.query(
      "SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1"
    );

    if (adminRows.length > 0) {
      adminUserId = adminRows[0].id;
      console.log(`Using existing admin user ID: ${adminUserId}`);
    } else {
      adminUserId = '44444444-4444-4444-4444-444444444444';
      console.log(`No admin found. Seeding test admin profile ID: ${adminUserId}`);
      await db.query(`
        INSERT INTO public.profiles (id, full_name, email, phone, role, xp_balance)
        VALUES ($1, 'Academic Admin Tester', 'academic-tester@futrix.io', '9333333333', 'admin', 100.0)
        ON CONFLICT (id) DO NOTHING
      `, [adminUserId]);
    }

    // Clean up past Academic Reports test records
    await db.query("DELETE FROM public.future_credentials");
    await db.query("DELETE FROM public.verification_records");
    await db.query("DELETE FROM public.generated_certificates");
    await db.query("DELETE FROM public.report_history");
    await db.query("DELETE FROM public.report_delivery");
    await db.query("DELETE FROM public.generated_reports");
    await db.query("DELETE FROM public.academic_reports");

    // Clean up previous dependencies
    await db.query("DELETE FROM public.student_prediction_models");
    await db.query("DELETE FROM public.student_analytics");

    // Seed mock student analytics
    await db.query(`
      INSERT INTO public.student_analytics (user_id, overall_score, accuracy_pct, avg_speed_sec, exam_readiness_score, consistency_score)
      VALUES ($1, 4.00, 100.00, 20.00, 96.60, 88.00)
    `, [adminUserId]);

    // Seed mock predictions
    await db.query(`
      INSERT INTO public.student_prediction_models (user_id, expected_score, expected_rank, expected_percentile, exam_success_probability)
      VALUES ($1, 720.00, 1, 100.00, 72.00)
    `, [adminUserId]);

    // ──────────────────────────────────────────────────────────────────────
    // 1. Student Academic Reports
    // ──────────────────────────────────────────────────────────────────────
    console.log("\n1. Testing Student Academic Report generation...");
    const studentReport = await academicIntelligencePlatform.generateStudentAcademicReport(db, adminUserId);
    console.log(`- Created Academic Report ID: "${studentReport.reportId}"`);
    console.log(`- Compiled Accuracy: ${studentReport.reportData.accuracy}%`);
    console.log(`- Predicted Score: ${studentReport.reportData.expectedScore}`);
    console.log(`- Predicted Rank: ${studentReport.reportData.expectedRank}`);
    console.log(`- AI Progress Summary: "${studentReport.aiSummary}"`);

    if (studentReport.reportData.accuracy !== 100.00 || studentReport.reportData.expectedScore !== 720.00) {
      throw new Error("Student academic report generation failed.");
    }
    console.log("✓ Student academic report verified.");

    // ──────────────────────────────────────────────────────────────────────
    // 2. Parent Reports
    // ──────────────────────────────────────────────────────────────────────
    console.log("\n2. Testing Parent Report generation...");
    const parentReport = await academicIntelligencePlatform.generateParentReport(db, adminUserId);
    console.log(`- Overall Progress Level: "${parentReport.overallProgress}"`);
    console.log(`- Exam Readiness: "${parentReport.examReadiness}"`);
    console.log(`- Consistency Level: "${parentReport.consistencyLevel}"`);
    console.log(`- Recommended Parent Action: "${parentReport.recommendedParentAction}"`);

    if (parentReport.overallProgress !== 'Excellent' || parentReport.consistencyLevel !== '88%') {
      throw new Error("Parent report generation failed.");
    }
    console.log("✓ Parent report verified.");

    // ──────────────────────────────────────────────────────────────────────
    // 3. Certificate Issuance
    // ──────────────────────────────────────────────────────────────────────
    console.log("\n3. Testing certificate issuance...");
    const cert = await academicIntelligencePlatform.issueCertificate(db, adminUserId, 'Achievement');
    console.log(`- Issued Certificate Code: "${cert.certificate_code}"`);
    console.log(`- Cryptographic Signature Hash: "${cert.digital_signature.substring(0, 40)}..."`);
    console.log(`- Verification Link: "${cert.verification_url}"`);

    if (!cert.certificate_code || !cert.digital_signature) {
      throw new Error("Certificate issuance failed.");
    }
    console.log("✓ Certificate issuance verified.");

    // ──────────────────────────────────────────────────────────────────────
    // 4. Certificate Verification Checkups
    // ──────────────────────────────────────────────────────────────────────
    console.log("\n4. Testing certificate verification checkups...");
    const verification = await academicIntelligencePlatform.verifyCertificate(
      db,
      cert.certificate_code,
      '192.168.1.100'
    );
    console.log(`- Cryptographic Verification Status: ${verification.verified}`);
    console.log(`- Verified Certificate Type: "${verification.certificateType}"`);
    console.log(`- Verified Issue Date: "${verification.issueDate}"`);

    if (verification.verified !== true || verification.certificateType !== 'Achievement') {
      throw new Error("Certificate cryptographic verification failed.");
    }

    // Verify lookup history logs
    const { rows: verifyLogs } = await db.query(
      "SELECT count(*)::int as count FROM public.verification_records WHERE certificate_code = $1",
      [cert.certificate_code]
    );
    console.log(`- Verification logs registered in DB: ${verifyLogs[0].count}`);

    if (verifyLogs[0].count !== 1) {
      throw new Error("Verification record lookup logging failed.");
    }
    console.log("✓ Certificate verification checkups verified.");

    console.log("\n=== ALL ENTERPRISE ACADEMIC PLATFORM TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ ACADEMIC PLATFORM TESTS FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Cleanup temporary seeds
    try {
      await db.query("DELETE FROM public.future_credentials");
      await db.query("DELETE FROM public.verification_records");
      await db.query("DELETE FROM public.generated_certificates");
      await db.query("DELETE FROM public.report_history");
      await db.query("DELETE FROM public.report_delivery");
      await db.query("DELETE FROM public.generated_reports");
      await db.query("DELETE FROM public.academic_reports");

      await db.query("DELETE FROM public.student_prediction_models");
      await db.query("DELETE FROM public.student_analytics");

      if (adminUserId === '44444444-4444-4444-4444-444444444444') {
        await db.query("DELETE FROM public.profiles WHERE id = $1", [adminUserId]);
      }
    } catch (_) {}
    await db.end();
  }
}

runTests();
