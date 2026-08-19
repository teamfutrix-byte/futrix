const { Client } = require('pg');
const securityManager = require('./services/securityManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE CYBER SECURITY & SOC TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  const testIp = '198.51.100.12';
  const wafTestIp = '203.0.113.88';

  try {
    // 0. Clean test states
    console.log("Cleaning up prior test security states...");
    await db.query("DELETE FROM public.security_blocked_ips WHERE ip_address IN ($1, $2)", [testIp, wafTestIp]);
    await db.query("DELETE FROM public.incidents WHERE title LIKE 'Web Application Firewall%'");


    // 1. Assert SOC stats and KPIs aggregation
    console.log("\n1. Testing SOC telemetry stats and health score...");
    const stats = await securityManager.getSecurityKPIs(db);
    console.log(`- Current Threat Level: ${stats.threatLevel}`);
    console.log(`- Security Health Score: ${stats.securityScore}`);
    console.log(`- Open Vulnerabilities: ${stats.openVulnerabilities}`);
    console.log(`- Pending Hotfix Patches: ${stats.pendingPatches}`);

    if (stats.securityScore <= 0 || !stats.threatLevel) {
      throw new Error("SOC Telemetry failed to fetch valid cyber security metrics.");
    }
    console.log("✓ SOC stats verified.");


    // 2. Assert Manual IP Blocking and Firewall rules
    console.log("\n2. Testing manual IP blocking and WAF firewall rules...");
    const block = await securityManager.blockIpAddress(db, {
      ipAddress: testIp,
      reason: 'E2E Testing simulated brute force',
      durationMinutes: 30
    });

    console.log(`- Blocked IP: ${block.ip_address}`);
    console.log(`- Reason: "${block.blocked_reason}"`);
    console.log(`- Expiration: ${block.expires_at}`);

    // Verify it exists in database WAF list
    const { rows: blockCheck } = await db.query(
      "SELECT 1 FROM public.security_blocked_ips WHERE ip_address = $1",
      [testIp]
    );
    if (blockCheck.length === 0) {
      throw new Error("IP address was not saved in blocked list database.");
    }

    // Unblock the IP
    await securityManager.unblockIpAddress(db, testIp);
    const { rows: unblockCheck } = await db.query(
      "SELECT 1 FROM public.security_blocked_ips WHERE ip_address = $1",
      [testIp]
    );
    if (unblockCheck.length > 0) {
      throw new Error("IP address was not deleted from firewall rules.");
    }
    console.log("✓ Manual IP blocking and WAF rules verified.");


    // 3. Assert Vulnerability registration and Hotfix patch application
    console.log("\n3. Testing hotfix patches application and SRE compliance...");
    
    // Get a pending patch
    const { rows: patches } = await db.query(
      "SELECT id, patch_name FROM public.security_patches WHERE status = 'Pending' LIMIT 1"
    );
    if (patches.length === 0) {
      throw new Error("No pending security patches found to test.");
    }
    const patchId = patches[0].id;
    console.log(`- Target Patch: "${patches[0].patch_name}" (ID: ${patchId})`);

    // Apply patch
    const appliedPatch = await securityManager.applyPatch(db, {
      patchId,
      appliedBy: 'test-sre@futrix.io'
    });

    console.log(`- Applied status: "${appliedPatch.status}"`);
    console.log(`- Applied at: ${appliedPatch.applied_at}`);
    console.log(`- Applied by: ${appliedPatch.applied_by}`);

    if (appliedPatch.status !== 'Applied' || appliedPatch.applied_by !== 'test-sre@futrix.io') {
      throw new Error("Patch management status update mismatch.");
    }
    console.log("✓ Hotfix patch application verified.");


    // 4. Assert WAF signature middleware scanner (WAF Auto-blocking)
    console.log("\n4. Testing WAF incoming request scanner & auto-blocking...");
    
    const maliciousPayload = "' UNION SELECT * FROM public.profiles--";
    const inspection = await securityManager.inspectIncomingRequest(db, {
      ipAddress: wafTestIp,
      userId: '2ae57959-6e7f-4be2-a58d-9db9a01816df',
      endpoint: '/api/analytics/forecast',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WAF Test Client',
      payload: { query: maliciousPayload }
    });

    console.log(`- Inspection Block Verdict: ${inspection.blocked}`);
    console.log(`- Block Reason: "${inspection.reason}"`);

    if (!inspection.blocked || !inspection.reason.includes('WAF threat signature matched')) {
      throw new Error("WAF Scanner failed to detect SQL injection threat payload!");
    }

    // Verify attacker IP is auto-blocked
    const { rows: wafBlockCheck } = await db.query(
      "SELECT blocked_reason FROM public.security_blocked_ips WHERE ip_address = $1",
      [wafTestIp]
    );
    console.log(`- Auto-blocked IP record in WAF: "${wafBlockCheck[0].blocked_reason}"`);
    if (wafBlockCheck.length === 0) {
      throw new Error("Attacker IP address was not auto-blocked by WAF!");
    }

    // Verify security incident ticket was filed in public.incidents
    const { rows: incidents } = await db.query(
      "SELECT title, severity, status FROM public.incidents WHERE title LIKE 'Web Application Firewall%' ORDER BY created_at DESC LIMIT 1"
    );
    console.log(`- Auto-filed SOC Incident Ticket: "${incidents[0].title}" (Severity: ${incidents[0].severity}, Status: ${incidents[0].status})`);
    if (incidents.length === 0) {
      throw new Error("Security incident ticket was not logged in public.incidents database!");
    }
    console.log("✓ WAF incoming request scanner & auto-blocking verified.");


    console.log("\n=== ALL CYBER SECURITY & SOC TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ CYBER SECURITY TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Restore default database states
    await db.query("DELETE FROM public.security_blocked_ips WHERE ip_address IN ($1, $2)", [testIp, wafTestIp]);
    await db.query("DELETE FROM public.incidents WHERE title LIKE 'Web Application Firewall%'");
    await db.query("UPDATE public.security_patches SET status = 'Pending', applied_at = NULL, applied_by = NULL");
    await db.end();
  }
}

runTests();
