const { Client } = require('pg');
const iamManager = require('./services/iamManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE IAM & SECURITY POLICY TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  let testUserId = null;
  let originalRole = null;

  try {
    // Fetch a valid user ID dynamically to prevent FK violations
    const { rows: profiles } = await db.query("SELECT id, role FROM public.profiles LIMIT 1");
    if (profiles.length === 0) {
      throw new Error("No user profiles registered in database.");
    }
    testUserId = profiles[0].id;
    originalRole = profiles[0].role;
    console.log(`- Resolved test User ID: ${testUserId} (Original Role: ${originalRole})`);

    // Clean tables for tests
    await db.query("DELETE FROM public.iam_sessions WHERE user_id = $1", [testUserId]);
    await db.query("DELETE FROM public.iam_access_requests WHERE user_id = $1", [testUserId]);


    // 1. Assert RBAC permission engine validation
    console.log("\n1. Testing granular RBAC permission validation...");
    
    // Explicitly set role to student
    await db.query("UPDATE public.profiles SET role = 'student' WHERE id = $1", [testUserId]);
    
    // Student should NOT have payments:manage
    const studentCheck = await iamManager.verifyPermission(db, testUserId, 'payments:manage');
    console.log(`- Student has 'payments:manage' permission: ${studentCheck}`);
    if (studentCheck !== false) {
      throw new Error("RBAC failed: Student was granted administrative privileges.");
    }

    // Student SHOULD have ai:test
    const studentAiCheck = await iamManager.verifyPermission(db, testUserId, 'ai:test');
    console.log(`- Student has 'ai:test' permission: ${studentAiCheck}`);
    if (studentAiCheck !== true) {
      throw new Error("RBAC failed: Student was denied core academic privileges.");
    }

    // Set role to admin
    await db.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [testUserId]);
    const adminCheck = await iamManager.verifyPermission(db, testUserId, 'payments:manage');
    console.log(`- Admin has 'payments:manage' permission: ${adminCheck}`);
    if (adminCheck !== true) {
      throw new Error("RBAC failed: Admin was denied control privileges.");
    }
    console.log("✓ RBAC permission validation verified.");


    // 2. Assert Account Lockout Policy
    console.log("\n2. Testing failed login attempts lockout policy (5 failed attempts)...");
    
    await db.query(`
      INSERT INTO public.iam_verification_states (user_id, failed_logins, account_status)
      VALUES ($1, 0, 'Active')
      ON CONFLICT (user_id) DO UPDATE SET failed_logins = 0, account_status = 'Active', lock_expires_at = NULL
    `, [testUserId]);

    let lockoutResult = null;
    for (let i = 1; i <= 5; i++) {
      lockoutResult = await iamManager.trackFailedLogin(db, testUserId);
      console.log(`- Attempt ${i}: Status = ${lockoutResult.locked ? 'Locked' : 'Active'}, failedCount = ${lockoutResult.attempts}`);
    }

    if (!lockoutResult.locked) {
      throw new Error("Jailbreak Lockout failed: Account status was not marked Locked after 5 failed log attempts.");
    }

    const { rows: dbState } = await db.query(
      "SELECT account_status FROM public.iam_verification_states WHERE user_id = $1",
      [testUserId]
    );
    console.log(`- Database account status verification: "${dbState[0].account_status}"`);
    if (dbState[0].account_status !== 'Locked') {
      throw new Error("Database verification status mismatch.");
    }

    // Reset lock
    await iamManager.resetFailedLogins(db, testUserId);
    console.log("✓ Account lockout verified and reset.");


    // 3. Assert Concurrent Session Policy (Cap 5 active sessions)
    console.log("\n3. Testing concurrent active sessions limit (Max 5 sessions cap)...");
    
    const sessionDetails = {
      userId: testUserId,
      deviceId: 'e2e-device',
      browser: 'Chrome 122',
      os: 'Windows 11',
      ip: '192.168.1.50',
      location: 'New Delhi, IN'
    };

    const sessionIds = [];
    for (let i = 1; i <= 5; i++) {
      const sess = await iamManager.createSession(db, sessionDetails);
      sessionIds.push(sess.session_id);
    }
    console.log(`- Created 5 active concurrent sessions: ${sessionIds.length}`);

    // Create 6th session (should revoke the first)
    console.log("- Triggering 6th concurrent session execution...");
    const sess6 = await iamManager.createSession(db, sessionDetails);

    // Verify oldest session status is 'Revoked'
    const { rows: session1Row } = await db.query(
      "SELECT status FROM public.iam_sessions WHERE session_id = $1",
      [sessionIds[0]]
    );
    console.log(`- Oldest Session Status: "${session1Row[0].status}"`);
    if (session1Row[0].status !== 'Revoked') {
      throw new Error("Concurrent Session limit failed: Oldest session was not revoked.");
    }

    // Verify 6th session status is 'Active'
    const { rows: session6Row } = await db.query(
      "SELECT status FROM public.iam_sessions WHERE session_id = $1",
      [sess6.session_id]
    );
    console.log(`- 6th Session Status: "${session6Row[0].status}"`);
    if (session6Row[0].status !== 'Active') {
      throw new Error("New session activation mismatch.");
    }
    console.log("✓ Concurrent session limits verified.");


    // 4. Assert Upgrade workflows approval
    console.log("\n4. Testing Access Upgrade temporary role approval workflow...");
    
    // Explicitly set role back to student first
    await db.query("UPDATE public.profiles SET role = 'student' WHERE id = $1", [testUserId]);

    const request = await iamManager.processAccessRequest(db, {
      userId: testUserId,
      requestedRole: 'teacher',
      reason: 'Need teacher dashboard access for JEE syllabus review'
    });
    console.log(`- Access Request registered with ID: ${request.id} (Status: ${request.status})`);

    // Simulate Admin Approval Decision
    await db.query(
      `UPDATE public.iam_access_requests 
       SET status = 'Approved', approved_by = 'superadmin@futrix.io' 
       WHERE id = $1`,
      [request.id]
    );

    // Trigger role mapping modification
    await db.query("UPDATE public.profiles SET role = 'teacher' WHERE id = $1", [testUserId]);

    const { rows: updatedProfile } = await db.query(
      "SELECT role FROM public.profiles WHERE id = $1",
      [testUserId]
    );
    console.log(`- Upgraded User Role: "${updatedProfile[0].role}"`);
    if (updatedProfile[0].role !== 'teacher') {
      throw new Error("Upgrade Workflow failed: User role was not modified upon approval.");
    }
    console.log("✓ Access request workflow verified.");


    console.log("\n=== ALL IAM & SECURITY TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ IAM TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Restore user details
    await db.query("DELETE FROM public.iam_sessions WHERE user_id = $1", [testUserId]);
    await db.query("DELETE FROM public.iam_access_requests WHERE user_id = $1", [testUserId]);
    await db.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [originalRole, testUserId]);
    await db.end();
  }
}

runTests();
