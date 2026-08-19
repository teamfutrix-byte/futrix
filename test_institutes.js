const { Client } = require('pg');
const instituteManager = require('./services/instituteManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE MULTI-TENANT SAAS TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  let tenantAId = null;
  let tenantBId = null;

  try {
    // 0. Clean slate E2E
    console.log("Cleaning up old test tenant records...");
    const { rows: oldTenants } = await db.query(
      `SELECT id FROM public.tenants WHERE name IN ('Test SaaS School', 'Second Isolation Tenant')`
    );
    const oldIds = oldTenants.map(t => t.id);
    if (oldIds.length > 0) {
      await db.query(`DELETE FROM public.institute_batches WHERE tenant_id = ANY($1)`, [oldIds]);
      await db.query(`DELETE FROM public.institute_members WHERE tenant_id = ANY($1)`, [oldIds]);
      await db.query(`DELETE FROM public.institute_billing WHERE tenant_id = ANY($1)`, [oldIds]);
      await db.query(`DELETE FROM public.tenant_audit_logs WHERE tenant_id = ANY($1)`, [oldIds]);
      await db.query(`DELETE FROM public.tenants WHERE id = ANY($1)`, [oldIds]);
    }

    // 1. Test Tenant Registration
    console.log("\n1. Testing tenant registration...");
    const tenantA = await instituteManager.registerTenant(db, {
      name: 'Test SaaS School',
      subdomain: 'test-saas',
      plan: 'Starter',
      ownerId: 'admin_test',
      orgType: 'School'
    });

    tenantAId = tenantA.id;
    console.log(`- Tenant registered successfully! ID: ${tenantAId}`);
    console.log(`- Subdomain: ${tenantA.subdomain}`);
    console.log(`- Domain: ${tenantA.domain}`);
    console.log(`- Default Plan: ${tenantA.subscription_plan}`);

    if (tenantA.name !== 'Test SaaS School' || tenantA.subdomain !== 'test-saas') {
      throw new Error("Tenant name or subdomain details mismatch.");
    }
    console.log("✓ Tenant registration verified.");


    // 2. Test Branding Update
    console.log("\n2. Testing branding / white-label customization...");
    const customBranding = {
      primaryColor: '#ff00ff', // magenta theme
      typography: 'Sora',
      logoUrl: '/media/test-logo.png'
    };

    await instituteManager.updateTenantBranding(db, tenantAId, customBranding);

    // Retrieve and verify
    const { rows: brandCheck } = await db.query(`SELECT branding_config FROM public.tenants WHERE id = $1`, [tenantAId]);
    console.log(`- Active primary color in DB: ${brandCheck[0].branding_config.primaryColor}`);
    console.log(`- Active typography in DB: ${brandCheck[0].branding_config.typography}`);

    if (brandCheck[0].branding_config.primaryColor !== '#ff00ff' || brandCheck[0].branding_config.typography !== 'Sora') {
      throw new Error("White-label branding stylesheet config failed to update.");
    }
    console.log("✓ Branding configurations verified.");


    // 3. Test Roster Enrollments
    console.log("\n3. Testing member roster enrollment...");
    await instituteManager.enrollMember(db, {
      tenantId: tenantAId,
      userId: 'student_e2e_user',
      role: 'student'
    });
    await instituteManager.enrollMember(db, {
      tenantId: tenantAId,
      userId: 'teacher_e2e_user',
      role: 'teacher'
    });

    const { rows: members } = await db.query(
      `SELECT * FROM public.institute_members WHERE tenant_id = $1 ORDER BY role DESC`,
      [tenantAId]
    );
    console.log(`- Enrolled members count: ${members.length}`);
    members.forEach(m => console.log(`  * User: ${m.user_id}, Role: ${m.role}`));

    if (members.length !== 2) {
      throw new Error(`Expected 2 enrolled members, found ${members.length}`);
    }
    console.log("✓ Roster enrollments verified.");


    // 4. Test Batch Allocations & Timetables
    console.log("\n4. Testing batch management and timetables...");
    const batch = await instituteManager.manageBatch(db, {
      tenantId: tenantAId,
      academicYear: '2026',
      session: 'Regular Term',
      course: 'Foundation',
      name: 'Grade-X-2026',
      section: 'Section A',
      timing: '9:00 AM - 12:00 PM',
      teacherId: 'teacher_e2e_user',
      studentIds: ['student_e2e_user'],
      capacity: 25,
      status: 'Active',
      schedule: ['Mon', 'Wed', 'Fri']
    });

    console.log(`- Batch allocated successfully! ID: ${batch.batchId}`);

    const { rows: batchCheck } = await db.query(`SELECT * FROM public.institute_batches WHERE id = $1`, [batch.batchId]);
    console.log(`- Created batch name: "${batchCheck[0].name}"`);
    console.log(`- Student slots filled: ${batchCheck[0].student_ids.length}/${batchCheck[0].capacity}`);
    console.log(`- Schedule days: ${batchCheck[0].schedule.join(', ')}`);

    if (batchCheck[0].name !== 'Grade-X-2026' || batchCheck[0].teacher_id !== 'teacher_e2e_user') {
      throw new Error("Batch configurations allocation mismatch.");
    }
    console.log("✓ Batch management verified.");


    // 5. Test Invoicing & Health Degradation
    console.log("\n5. Testing billing invoices and health scoring...");
    // Normal base invoice
    const inv1 = await instituteManager.createInvoice(db, {
      tenantId: tenantAId,
      amount: 499.00,
      breakdown: { base_fee: 499.00 },
      status: 'Unpaid'
    });
    console.log(`- Normal invoice created: ${inv1.invoice_number}, Amount: $${inv1.amount}, Status: ${inv1.status}`);

    const stats1 = await instituteManager.getDashboardStats(db, tenantAId);
    console.log(`- Outstanding balance: $${stats1.outstanding}`);
    console.log(`- Institute Health Score: ${stats1.healthStatus}`);
    
    if (stats1.healthStatus !== 'Active') {
      throw new Error(`Expected Active health status, got ${stats1.healthStatus}`);
    }

    // Heavy unpaid invoice (triggers Degradation)
    const inv2 = await instituteManager.createInvoice(db, {
      tenantId: tenantAId,
      amount: 1500.00,
      breakdown: { base_fee: 1000.00, seat_usage: 500.00 },
      status: 'Unpaid'
    });
    console.log(`- Overdue invoice created: ${inv2.invoice_number}, Amount: $${inv2.amount}`);

    const stats2 = await instituteManager.getDashboardStats(db, tenantAId);
    console.log(`- Total Outstanding balance: $${stats2.outstanding}`);
    console.log(`- Updated Institute Health Score: ${stats2.healthStatus}`);

    if (stats2.healthStatus !== 'Degraded') {
      throw new Error("SaaS engine failed to transition health status to Degraded on high outstanding balance.");
    }
    console.log("✓ Invoicing and health scoring verified.");


    // 6. Test Data Isolation (Strict SaaS Guardrails)
    console.log("\n6. Testing strict data isolation between tenants...");
    const tenantB = await instituteManager.registerTenant(db, {
      name: 'Second Isolation Tenant',
      subdomain: 'tenant-b',
      plan: 'Free',
      ownerId: 'some_other_admin',
      orgType: 'Coaching Institute'
    });
    tenantBId = tenantB.id;

    // Enroll member under Tenant B
    await instituteManager.enrollMember(db, {
      tenantId: tenantBId,
      userId: 'student_isolation_b',
      role: 'student'
    });

    // Query members list of Tenant A, verify student_isolation_b is NOT retrieved
    const { rows: tenantAMembers } = await db.query(
      `SELECT * FROM public.institute_members WHERE tenant_id = $1`,
      [tenantAId]
    );
    const leaksB = tenantAMembers.some(m => m.user_id === 'student_isolation_b');
    console.log(`- Checking for Tenant B student inside Tenant A directory: ${leaksB ? 'FAIL (LEAK)' : 'PASS (ISOLATED)'}`);

    // Query members list of Tenant B, verify student_e2e_user is NOT retrieved
    const { rows: tenantBMembers } = await db.query(
      `SELECT * FROM public.institute_members WHERE tenant_id = $1`,
      [tenantBId]
    );
    const leaksA = tenantBMembers.some(m => m.user_id === 'student_e2e_user');
    console.log(`- Checking for Tenant A student inside Tenant B directory: ${leaksA ? 'FAIL (LEAK)' : 'PASS (ISOLATED)'}`);

    if (leaksB || leaksA) {
      throw new Error("Strict data isolation breach! Tenants can access each other's members rosters.");
    }
    console.log("✓ Tenant data isolation confirmed.");


    console.log("\n=== ALL MULTI-TENANT SAAS TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ SAAS TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Clean up E2E records
    console.log("\nCleaning up test logs...");
    const ids = [];
    if (tenantAId) ids.push(tenantAId);
    if (tenantBId) ids.push(tenantBId);

    if (ids.length > 0) {
      await db.query(`DELETE FROM public.institute_batches WHERE tenant_id = ANY($1)`, [ids]);
      await db.query(`DELETE FROM public.institute_members WHERE tenant_id = ANY($1)`, [ids]);
      await db.query(`DELETE FROM public.institute_billing WHERE tenant_id = ANY($1)`, [ids]);
      await db.query(`DELETE FROM public.tenant_audit_logs WHERE tenant_id = ANY($1)`, [ids]);
      await db.query(`DELETE FROM public.tenants WHERE id = ANY($1)`, [ids]);
    }
    await db.end();
  }
}

runTests();
