const { Client } = require('pg');
const governanceManager = require('./services/governanceManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE GOVERNANCE, COMPLIANCE & SECURITY TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 1. Assert Audit Logs Immutability
    console.log("\n1. Testing security audit trail log immutability policies...");
    
    // Insert a test audit log
    const testLog = await governanceManager.logAudit(db, {
      actor: 'Test Auditor',
      action: 'SECURITY_COMPLIANCE_TEST',
      target: 'immutability-check',
      ipAddress: '127.0.0.1',
      device: 'NodeTestEngine',
      environment: 'production',
      result: 'SUCCESS'
    });
    console.log(`- Created audit log entry: ${testLog.id}`);

    // Try to update the row
    console.log("- Attempting to update audit log details (should be blocked by trigger)...");
    let updateBlockPassed = false;
    try {
      await db.query("UPDATE public.gov_audit_logs SET result = 'FAILED' WHERE id = $1", [testLog.id]);
    } catch (err) {
      console.log(`✓ Blocked successfully! DB exception: ${err.message}`);
      if (err.message.includes('FUTRIX SECURITY PROTOCOL')) {
        updateBlockPassed = true;
      }
    }
    if (!updateBlockPassed) throw new Error("Security breach: Audit log table allowed modifications!");

    // Try to delete the row
    console.log("- Attempting to delete audit log entry (should be blocked by trigger)...");
    let deleteBlockPassed = false;
    try {
      await db.query("DELETE FROM public.gov_audit_logs WHERE id = $1", [testLog.id]);
    } catch (err) {
      console.log(`✓ Blocked successfully! DB exception: ${err.message}`);
      if (err.message.includes('FUTRIX SECURITY PROTOCOL')) {
        deleteBlockPassed = true;
      }
    }
    if (!deleteBlockPassed) throw new Error("Security breach: Audit log table allowed deletions!");
    console.log("✓ Audit trail immutability checks passed.");

    // 2. Assert Change Management Lifecycle
    console.log("\n2. Testing Change Management & Production Release Authorization workflow...");
    const change = await governanceManager.proposeChange(db, {
      moduleId: 'ai-gateway',
      proposedChange: 'Upgrade temperature configuration constraints',
      draftBy: 'Lead AI Engineer',
      testingEvidence: 'Passed 48h performance load tests.',
      deploymentPlan: 'Rolling upgrade. Target: 100% replicas.'
    });
    console.log(`- Proposal ticket created. ID: ${change.id} | Status: ${change.status} | Review: ${change.review_status}`);
    if (change.status !== 'Pending' || change.review_status !== 'Review') {
      throw new Error("Change proposed did not start in Review/Pending status.");
    }

    // Approve the change ticket
    console.log("- Signing off and authorizing production release...");
    const approved = await governanceManager.approveChange(db, change.id, 'Super Admin');
    console.log(`- Authorized status: ${approved.status} | Review: ${approved.review_status} | Approved By: ${approved.approved_by}`);
    if (approved.status !== 'Completed' || approved.review_status !== 'Approved' || approved.approved_by !== 'Super Admin') {
      throw new Error("Failed to authorize change release successfully.");
    }
    console.log("✓ Change management release workflow passed.");

    // 3. Assert Disaster Recovery Regional Failover
    console.log("\n3. Testing Disaster Recovery regional failover triggers and SLA speeds...");
    const dr = await governanceManager.triggerFailover(db, 'main-cluster', 'AWS');
    console.log(`- Triggered regional failover to AWS. Active Cloud: ${dr.active_cloud} | Region: ${dr.active_region}`);
    console.log(`- Measured RTO Speed: ${dr.rto_seconds}s | RPO Loss: ${dr.rpo_seconds}s`);

    if (parseFloat(dr.rto_seconds) >= 1.0) {
      throw new Error(`DR failover RTO speed violated SLA limits (<1.0s): ${dr.rto_seconds}s`);
    }
    if (parseFloat(dr.rpo_seconds) >= 5.0) {
      throw new Error(`DR failover RPO loss violated SLA limits (<5.0s): ${dr.rpo_seconds}s`);
    }
    console.log("✓ Disaster Recovery SLA verification passed.");

    // 4. Assert Root Keys Vault Rotation
    console.log("\n4. Testing root credentials secrets vault rotation...");
    const { rows: origSecret } = await db.query("SELECT version FROM public.infra_secrets WHERE environment_id = 'production' AND key_name = 'GEMINI_PRIMARY_API_KEY'");
    const origVersion = origSecret[0].version;

    const rotation = await governanceManager.rotateRootKeys(db, 'Super Admin', '10.0.0.1', 'AuditRunnerNode');
    console.log(`- Rotated keys. New Version: v${rotation.newVersion}`);
    if (rotation.newVersion !== origVersion + 1) {
      throw new Error(`Expected secrets version to increment from ${origVersion} to ${origVersion + 1}, got ${rotation.newVersion}`);
    }

    // Verify key rotation audit trail is recorded
    const { rows: auditCheck } = await db.query("SELECT * FROM public.gov_audit_logs WHERE action = 'ROTATE_ROOT_KEYS' AND actor = 'Super Admin' ORDER BY timestamp DESC LIMIT 1");
    console.log(`- Rotated key audit logged: ${auditCheck[0] ? 'YES' : 'NO'}`);
    if (auditCheck.length === 0) throw new Error("Rotated keys audit entry was not recorded in log.");
    console.log("✓ Root secrets vault rotation checks passed.");

    console.log("\n=== ALL GOVERNANCE, COMPLIANCE & SECURITY POLICIES PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n❌ GOVERNANCE TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    // We can clean up our test change ticket to avoid polluting the DB
    await db.query("DELETE FROM public.gov_change_management WHERE draft_by = 'Lead AI Engineer'");
    await db.end();
  }
}

runTests();
