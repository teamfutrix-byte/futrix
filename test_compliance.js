const { Client } = require('pg');
const crypto = require('crypto');
const auditManager = require('./services/auditManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE COMPLIANCE & AUDIT TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  const corrId = 'e2e_corr_' + crypto.randomBytes(4).toString('hex');

  try {
    // 0. Clean old E2E records
    console.log("Cleaning up old test entries...");
    await db.query("DELETE FROM public.legal_holds WHERE case_id = 'HOLD-E2E-TEST'");

    // 1. Assert Cryptographic Hashing Chain
    console.log("\n1. Testing tamper-evident cryptographic chaining...");
    const log1 = await auditManager.logAuditEvent(db, {
      actor: 'system_admin',
      action: 'SYSTEM_STARTUP',
      target: 'k8s_cluster',
      ipAddress: '127.0.0.1',
      device: 'Console API',
      environment: 'production',
      result: 'SUCCESS',
      correlationId: corrId,
      severity: 'Low',
      statusCode: 200,
      module: 'infrastructure'
    });

    const log2 = await auditManager.logAuditEvent(db, {
      actor: 'security_manager',
      action: 'ROTATE_API_KEY',
      target: 'ai_router_key',
      ipAddress: '127.0.0.1',
      device: 'Console API',
      environment: 'production',
      result: 'SUCCESS',
      correlationId: corrId,
      severity: 'High',
      statusCode: 200,
      module: 'security'
    });

    console.log(`- Log 1 Hash: ${log1.immutable_hash}`);
    console.log(`- Log 2 Hash: ${log2.immutable_hash}`);

    // Recompute Hash 2 manually to assert chain integrity
    // Block payload string: prevHash | actor | action | target | result | statusCode
    const expectedPayload = `${log1.immutable_hash}|security_manager|ROTATE_API_KEY|ai_router_key|SUCCESS|200`;
    const computedHash2 = crypto.createHash('sha256').update(expectedPayload).digest('hex');

    console.log(`- Recomputed Log 2 Hash: ${computedHash2}`);

    if (log2.immutable_hash !== computedHash2) {
      throw new Error("Cryptographic chaining link broke. Manual hash does not match stored block hash.");
    }
    console.log("✓ Tamper-evident cryptographic chaining verified.");


    // 2. Assert Database Log Immutability (UPDATE & DELETE protection)
    console.log("\n2. Testing PostgreSQL Immutability Trigger blocks...");
    
    // Disable node process exit on unhandled rejection for trigger throw test
    let updateBlocked = false;
    try {
      await db.query(
        "UPDATE public.gov_audit_logs SET result = 'FAILED' WHERE id = $1",
        [log1.id]
      );
    } catch (err) {
      if (err.message.includes('FUTRIX SECURITY PROTOCOL')) {
        updateBlocked = true;
        console.log("- Trigger blocked UPDATE successfully! Error:", err.message);
      } else {
        throw err;
      }
    }

    if (!updateBlocked) {
      throw new Error("Audit log database record was updated successfully! Immutability trigger failed.");
    }

    let deleteBlocked = false;
    try {
      await db.query(
        "DELETE FROM public.gov_audit_logs WHERE id = $1",
        [log1.id]
      );
    } catch (err) {
      if (err.message.includes('FUTRIX SECURITY PROTOCOL')) {
        deleteBlocked = true;
        console.log("- Trigger blocked DELETE successfully! Error:", err.message);
      } else {
        throw err;
      }
    }

    if (!deleteBlocked) {
      throw new Error("Audit log database record was deleted successfully! Immutability trigger failed.");
    }

    console.log("✓ PostgreSQL Immutability Trigger blocks verified.");


    // 3. Assert Compliance Score calculations
    console.log("\n3. Testing Compliance Score Calculations...");
    const baseScore = await auditManager.calculateComplianceScore(db);
    console.log(`- Base Compliance Score: ${baseScore}/100`);

    // Propose status modification: change 'Password Complexity Rule Check' to 'Non-Compliant'
    // Score impact is 15. Score should become baseScore - 15.
    const policyRow = await db.query(
      `SELECT id, score_impact FROM public.compliance_checks WHERE policy_name = 'Password Complexity Rule Check'`
    );
    const pId = policyRow.rows[0].id;
    const impact = policyRow.rows[0].score_impact;

    await db.query(
      `UPDATE public.compliance_checks SET status = 'Non-Compliant' WHERE id = $1`,
      [pId]
    );

    const updatedScore = await auditManager.calculateComplianceScore(db);
    console.log(`- Updated Compliance Score (after Non-Compliant policy): ${updatedScore}/100`);

    // Reset status back to Compliant
    await db.query(
      `UPDATE public.compliance_checks SET status = 'Compliant' WHERE id = $1`,
      [pId]
    );

    if (updatedScore !== baseScore - impact) {
      throw new Error(`Expected score ${baseScore - impact}, got ${updatedScore}`);
    }
    console.log("✓ Compliance Score calculations verified.");


    // 4. Assert Legal Hold Preservations
    console.log("\n4. Testing Legal Holds Vault and audit track...");
    const hold = await auditManager.createLegalHold(db, {
      caseId: 'HOLD-E2E-TEST',
      reason: 'DOJ external audit preservation order',
      approvedBy: 'CISO Officer'
    });

    console.log(`- Legal hold created: ID=${hold.id}, Case=${hold.case_id}`);

    // Verify hold exists
    const { rows: holds } = await db.query(
      `SELECT * FROM public.legal_holds WHERE case_id = 'HOLD-E2E-TEST'`
    );
    if (holds.length === 0) {
      throw new Error("Legal hold case was not saved in database.");
    }
    console.log("✓ Legal hold preservation verified.");


    // 5. Assert Forensic Timeline Sequencer
    console.log("\n5. Testing forensic timeline sequencer...");
    const timeline = await auditManager.getForensicTimeline(db, corrId);
    console.log(`- Chronological timeline events count: ${timeline.length}`);
    if (timeline.length !== 2) {
      throw new Error(`Expected exactly 2 timeline entries, got ${timeline.length}`);
    }
    console.log(`  * Chronology 1: ${timeline[0].action} (Actor: ${timeline[0].actor})`);
    console.log(`  * Chronology 2: ${timeline[1].action} (Actor: ${timeline[1].actor})`);

    if (timeline[0].action !== 'SYSTEM_STARTUP' || timeline[1].action !== 'ROTATE_API_KEY') {
      throw new Error("Timeline event sequence returned incorrect ordering.");
    }
    console.log("✓ Forensic timeline sequencer verified.");


    console.log("\n=== ALL COMPLIANCE & AUDIT ENGINE TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ COMPLIANCE & AUDIT TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Clean up E2E records
    console.log("\nCleaning up test logs...");
    await db.query("DELETE FROM public.legal_holds WHERE case_id = 'HOLD-E2E-TEST'");
    await db.end();
  }
}

runTests();
