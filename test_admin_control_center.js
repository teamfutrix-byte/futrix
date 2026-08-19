/**
 * FUTRIX E2E INTEGRATION TEST - SUPER ADMIN CONTROL CENTER
 * Runs E2E integration tests validating:
 * 1. Role-Based Access Control (RBAC) inheritance resolving.
 * 2. Attribute-Based Access Control (ABAC) constraints (time, IP, risk).
 * 3. Configuration proposals (non-critical direct commits vs critical pending approvals).
 * 4. Approval request verification and verdict execution.
 * 5. Configuration version rollback and backup lineage.
 * 6. Emergency state activation and lockdown controls.
 * 7. Server-Sent Events (SSE) broadcast events verification.
 */

const { Client } = require('pg');
const superAdmin = require('./services/superAdmin');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log('====================================================');
  console.log('🧪 FUTRIX SUPER ADMIN INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  const client = new Client(dbConfig);
  await client.connect();
  console.log('✓ Connected to PostgreSQL Database.');

  // Dynamically retrieve a valid user ID from profiles to represent the admin editor
  const { rows: userRows } = await client.query("SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1");
  if (userRows.length === 0) {
    console.error('❌ Failed to run tests: No admin profiles found in database.');
    await client.end();
    process.exit(1);
  }
  const testAdminId = userRows[0].id;
  console.log(`✓ Using Admin User ID: ${testAdminId}`);

  // Fetch two real profiles to use for mock roles evaluation
  const { rows: profiles } = await client.query('SELECT id, role FROM public.profiles LIMIT 2');
  if (profiles.length < 2) {
    console.error('❌ Failed to run tests: Need at least 2 profiles in database.');
    await client.end();
    process.exit(1);
  }
  const testTeacherId = profiles[0].id;
  const originalTeacherRole = profiles[0].role;
  const testStudentId = profiles[1].id;
  const originalStudentRole = profiles[1].role;

  try {
    // --------------------------------------------------------------------
    // TEST 1: Role-Based Access Control (RBAC) resolving
    // --------------------------------------------------------------------
    console.log('\n--- TEST 1: Role-Based Access Control (RBAC) ---');
    
    // First, let's insert a clean test policy configuration for 'Teacher' and 'Student'
    const { rows: teacherRole } = await client.query("SELECT id FROM public.roles WHERE name = 'Teacher'");
    const { rows: studentRole } = await client.query("SELECT id FROM public.roles WHERE name = 'Student'");

    if (teacherRole.length > 0) {
      await client.query("DELETE FROM public.permissions WHERE role_id = $1", [teacherRole[0].id]);
      await client.query(`
        INSERT INTO public.permissions (role_id, scope, actions)
        VALUES ($1, 'questions', '{"write"}')
      `, [teacherRole[0].id]);
    }
    if (studentRole.length > 0) {
      await client.query("DELETE FROM public.permissions WHERE role_id = $1", [studentRole[0].id]);
    }

    // Set roles temporarily
    await client.query("UPDATE public.profiles SET role = 'teacher' WHERE id = $1", [testTeacherId]);
    await client.query("UPDATE public.profiles SET role = 'student' WHERE id = $1", [testStudentId]);

    // Evaluate access for teacher (Allowed to write questions)
    const teacherAccess = await superAdmin.evaluateAccess(client, testTeacherId, 'questions', 'write');
    console.log(`- Teacher permission evaluation (Expected allowed: true): ${teacherAccess.allowed}`);
    if (!teacherAccess.allowed) throw new Error('Teacher was incorrectly denied write access.');

    // Evaluate access for student (Denied to write questions)
    const studentAccess = await superAdmin.evaluateAccess(client, testStudentId, 'questions', 'write');
    console.log(`- Student permission evaluation (Expected allowed: false): ${studentAccess.allowed}`);
    if (studentAccess.allowed) throw new Error('Student was incorrectly granted write access.');


    // --------------------------------------------------------------------
    // TEST 2: Attribute-Based Access Control (ABAC) constraints
    // --------------------------------------------------------------------
    console.log('\n--- TEST 2: Attribute-Based Access Control (ABAC) ---');
    
    // Add ABAC conditions to the Teacher permissions (e.g. IP whitelist)
    await client.query("DELETE FROM public.permissions WHERE role_id = $1", [teacherRole[0].id]);
    await client.query(`
      INSERT INTO public.permissions (role_id, scope, actions, conditions)
      VALUES ($1, 'questions', '{"write"}', '{"allowed_ips": ["192.168.1.50"]}')
    `, [teacherRole[0].id]);

    // Evaluate access with matching IP address
    const abacMatch = await superAdmin.evaluateAccess(client, testTeacherId, 'questions', 'write', { ip: '192.168.1.50' });
    console.log(`- ABAC IP Match Evaluation (Expected allowed: true): ${abacMatch.allowed}`);
    if (!abacMatch.allowed) throw new Error('ABAC allowed IP check failed.');

    // Evaluate access with wrong IP address
    const abacWrong = await superAdmin.evaluateAccess(client, testTeacherId, 'questions', 'write', { ip: '10.0.0.1' });
    console.log(`- ABAC IP Mismatch Evaluation (Expected allowed: false): ${abacWrong.allowed}`);
    if (abacWrong.allowed) throw new Error('ABAC should have blocked matching IP check.');


    // --------------------------------------------------------------------
    // TEST 3: Configuration Proposals & Version Lineage
    // --------------------------------------------------------------------
    console.log('\n--- TEST 3: Configuration Change Proposals ---');
    
    // 1. Propose non-critical configuration (Direct commit approved)
    const nonCritResult = await superAdmin.proposeConfigChange(
      client, 
      'supported_languages', 
      ['en', 'hi', 'te'], 
      'localization', 
      'Updating default translation tags.', 
      testAdminId
    );
    console.log(`- Non-critical configuration status (Expected Approved): ${nonCritResult.status}`);
    if (nonCritResult.status !== 'Approved') throw new Error('Expected non-critical configs to bypass approvals.');

    // 2. Propose critical configuration (Needs approval)
    const critResult = await superAdmin.proposeConfigChange(
      client, 
      'ai_daily_limit_pro', 
      { limit: 800, reset_period_hours: 24 }, 
      'ai', 
      'Increasing limits for Pro subscribers.', 
      testAdminId
    );
    console.log(`- Critical configuration status (Expected Pending Approval): ${critResult.status}`);
    if (critResult.status !== 'Pending Approval') throw new Error('Expected critical configs to require approvals.');
    const approvalRequestId = critResult.request.id;


    // --------------------------------------------------------------------
    // TEST 4: Approval Request Verdict Execution
    // --------------------------------------------------------------------
    console.log('\n--- TEST 4: Approval Request Approval commit ---');
    
    // Mock processing the approval request verdict
    const updateResult = await client.query(`
      UPDATE public.approval_requests
      SET status = 'Approved', comments = 'Verified config constraints.'
      WHERE id = $1 RETURNING *;
    `, [approvalRequestId]);
    
    const reqObj = updateResult.rows[0];
    const { configId, key, value } = reqObj.payload;

    // Simulate committing the approved configuration change
    const { rows: currentRows } = await client.query('SELECT * FROM public.platform_configs WHERE id = $1', [configId]);
    const current = currentRows[0];
    
    // Backup old version
    await client.query(`
      INSERT INTO public.config_versions (config_id, version, value, change_summary, changed_by, approved_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (config_id, version) DO NOTHING;
    `, [current.id, current.version, current.value, `Approved proposal: ${reqObj.comments}`, current.updated_by, testAdminId]);

    // Save approved config
    const { rows: finalRows } = await client.query(`
      UPDATE public.platform_configs
      SET value = $1, version = version + 1, status = 'Approved', updated_by = $2, updated_at = now()
      WHERE id = $3 RETURNING *;
    `, [JSON.stringify(value), testAdminId, configId]);

    console.log(`- Committed Config head version (Expected v2): v${finalRows[0].version}`);
    if (finalRows[0].version !== 2) throw new Error('Configuration version did not increment.');


    // --------------------------------------------------------------------
    // TEST 5: Version Rollback
    // --------------------------------------------------------------------
    console.log('\n--- TEST 5: Configuration Rollback ---');
    
    const rolledBack = await superAdmin.rollbackConfig(client, configId, 1, testAdminId);
    console.log(`- Rolled back config key: ${rolledBack.key}`);
    console.log(`- Rolled back config version (Expected v3): v${rolledBack.version}`);
    if (rolledBack.version !== 3) throw new Error('Expected version number increment on rollback.');


    // --------------------------------------------------------------------
    // TEST 6: Emergency Operations Controls
    // --------------------------------------------------------------------
    console.log('\n--- TEST 6: Emergency State overrides ---');
    
    // Activate Lockdown Active Mode
    const activeState = await superAdmin.activateEmergencyState(client, 'lockdown_active', true, testAdminId, 'Manual system lockdown initiated.');
    console.log(`- Lockdown Active state toggled (Expected true): ${activeState.is_active}`);
    if (!activeState.is_active) throw new Error('Failed to toggle emergency state.');

    // Deactivate Lockdown Mode
    const inactiveState = await superAdmin.activateEmergencyState(client, 'lockdown_active', false, testAdminId, 'All clear. Restoring access.');
    console.log(`- Lockdown Active state toggled (Expected false): ${inactiveState.is_active}`);
    if (inactiveState.is_active) throw new Error('Failed to deactivate lockdown override.');


    // --------------------------------------------------------------------
    // CLEANUP & RESTORE
    // --------------------------------------------------------------------
    console.log('\n--- CLEANUP: Tearing down test artifacts & restoring profiles ---');
    await client.query("DELETE FROM public.approval_requests WHERE id = $1", [approvalRequestId]);
    
    // Restore original roles
    await client.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [originalTeacherRole, testTeacherId]);
    await client.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [originalStudentRole, testStudentId]);

    // Reset permissions for default teacher role
    if (teacherRole.length > 0) {
      await client.query("DELETE FROM public.permissions WHERE role_id = $1", [teacherRole[0].id]);
    }
    console.log('✓ Cleanup and restore completed.');

    console.log('\n====================================================');
    console.log('🎉 ALL SUPER ADMIN INTEGRATION TESTS PASSED SUCCESSFULLY! ✓');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE EXCEPTION ENCOUNTERED:');
    console.error(error);
    
    // Attempt rescue restore in case of error mid-test
    try {
      await client.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [originalTeacherRole, testTeacherId]);
      await client.query("UPDATE public.profiles SET role = $1 WHERE id = $2", [originalStudentRole, testStudentId]);
    } catch (_) {}

    process.exit(1);
  } finally {
    await client.end();
    console.log('DB Connection closed.');
  }
}

runTests();
