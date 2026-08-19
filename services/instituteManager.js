const crypto = require('crypto');

/**
 * Enterprise Institute & Multi-Tenant Manager Service
 */
class InstituteManager {

  /**
   * Registers a brand new white-label tenant/organization
   */
  async registerTenant(db, {
    name, subdomain, domain = null, plan = 'Free', ownerId, orgType = 'Coaching Institute'
  }) {
    console.log(`[Multi-Tenant Engine] Registering tenant: '${name}' (${subdomain})`);

    const finalDomain = domain || `${subdomain}.futrix.io`;
    const defaultBranding = {
      primaryColor: '#4d8eff',
      secondaryColor: '#06b6d4',
      accentColor: '#10b981',
      typography: 'Geist',
      logoUrl: '',
      darkLogoUrl: ''
    };
    const defaultProfile = {
      address: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      email: '',
      principal: '',
      verification_status: 'Trial'
    };
    const defaultAcademic = {
      exam_types: ['JEE Main', 'NEET Sectional'],
      boards: ['CBSE'],
      subjects: ['Physics', 'Chemistry', 'Mathematics']
    };
    const defaultAiConfig = {
      enabled: true,
      daily_limit_tokens: 50000,
      tutor_enabled: true
    };
    const defaultLimits = {
      max_students: 100,
      max_teachers: 10,
      max_media_bytes: 104857600 // 100MB
    };

    const { rows } = await db.query(
      `INSERT INTO public.tenants (name, domain, subdomain, branding_config, status, subscription_plan, org_type, owner_id, profile_details, academic_config, ai_config, storage_limits)
       VALUES ($1, $2, $3, $4, 'Active', $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        name, finalDomain, subdomain, JSON.stringify(defaultBranding), plan, orgType, ownerId,
        JSON.stringify(defaultProfile), JSON.stringify(defaultAcademic), JSON.stringify(defaultAiConfig), JSON.stringify(defaultLimits)
      ]
    );

    const tenant = rows[0];
    await this.logAudit(db, tenant.id, ownerId, 'REGISTER_TENANT', { name, subdomain, plan });

    return tenant;
  }

  /**
   * Updates tenant branding configurations (colors, logo, typography)
   */
  async updateTenantBranding(db, tenantId, brandingConfig) {
    await db.query(
      `UPDATE public.tenants 
       SET branding_config = COALESCE(branding_config, '{}'::jsonb) || $1::jsonb,
           version = version + 1
       WHERE id = $2`,
      [JSON.stringify(brandingConfig), tenantId]
    );
    return { success: true };
  }

  /**
   * Enrolls a member (Student/Teacher/Admin) under a tenant scope
   */
  async enrollMember(db, { tenantId, userId, role, status = 'Active' }) {
    await db.query(
      `INSERT INTO public.institute_members (tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         status = EXCLUDED.status`,
      [tenantId, userId, role, status]
    );
    return { success: true };
  }

  /**
   * Manages (Creates/Updates) academic batches and section timetables
   */
  async manageBatch(db, {
    id, tenantId, academicYear, session, course, name, section = '', timing = '',
    teacherId = null, studentIds = [], capacity = 50, status = 'Active', schedule = []
  }) {
    const batchId = id || 'bat_' + crypto.randomBytes(8).toString('hex');
    await db.query(
      `INSERT INTO public.institute_batches (id, tenant_id, academic_year, session, course, name, section, timing, teacher_id, student_ids, capacity, status, schedule)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         academic_year = EXCLUDED.academic_year,
         session = EXCLUDED.session,
         course = EXCLUDED.course,
         name = EXCLUDED.name,
         section = EXCLUDED.section,
         timing = EXCLUDED.timing,
         teacher_id = EXCLUDED.teacher_id,
         student_ids = EXCLUDED.student_ids,
         capacity = EXCLUDED.capacity,
         status = EXCLUDED.status,
         schedule = EXCLUDED.schedule`,
      [
        batchId, tenantId, academicYear, session, course, name, section, timing,
        teacherId, studentIds, capacity, status, JSON.stringify(schedule)
      ]
    );
    return { success: true, batchId };
  }

  /**
   * Creates billing invoices for seats, storage, or subscriptions
   */
  async createInvoice(db, { tenantId, amount, breakdown = {}, dueDate = null, status = 'Unpaid' }) {
    const invoiceId = 'inv_' + crypto.randomBytes(8).toString('hex');
    const invoiceNum = 'FTX-' + Math.floor(100000 + Math.random() * 900000);
    const finalDueDate = dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days due

    const outstanding = status === 'Unpaid' ? amount : 0;

    const { rows } = await db.query(
      `INSERT INTO public.institute_billing (id, tenant_id, invoice_number, amount, outstanding, billing_date, due_date, status, breakdown)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
       RETURNING *`,
      [invoiceId, tenantId, invoiceNum, amount, outstanding, finalDueDate, status, JSON.stringify(breakdown)]
    );
    return rows[0];
  }

  /**
   * Compiles real-time metrics dashboard for a specific tenant
   */
  async getDashboardStats(db, tenantId) {
    // 1. Fetch Tenant details
    const { rows: tenants } = await db.query(
      `SELECT * FROM public.tenants WHERE id = $1`,
      [tenantId]
    );
    if (tenants.length === 0) throw new Error('Tenant not found');
    const tenant = tenants[0];

    // 2. Aggregate Students & Teachers
    const { rows: studentStats } = await db.query(
      `SELECT COUNT(*) as count FROM public.institute_members WHERE tenant_id = $1 AND role = 'student'`,
      [tenantId]
    );
    const { rows: teacherStats } = await db.query(
      `SELECT COUNT(*) as count FROM public.institute_members WHERE tenant_id = $1 AND role = 'teacher'`,
      [tenantId]
    );
    const { rows: activeUsers } = await db.query(
      `SELECT COUNT(*) as count FROM public.institute_members WHERE tenant_id = $1 AND status = 'Active'`,
      [tenantId]
    );

    // 3. Batches
    const { rows: batchStats } = await db.query(
      `SELECT COUNT(*) as count FROM public.institute_batches WHERE tenant_id = $1`,
      [tenantId]
    );

    // 4. Billing
    const { rows: billingStats } = await db.query(
      `SELECT SUM(amount) as total_rev, SUM(outstanding) as total_out 
       FROM public.institute_billing WHERE tenant_id = $1`,
      [tenantId]
    );

    const revenue = parseFloat(billingStats[0].total_rev || 0);
    const outstanding = parseFloat(billingStats[0].total_out || 0);

    // Enforce health scores based on subscription & overdue invoices
    const healthStatus = outstanding > 1000 ? 'Degraded' : 'Active';

    // Mock aggregates for courses & attendance & AI usage
    const courses = ['JEE', 'NEET', 'Foundation'];
    const avgAttendance = 88.4;
    const aiUsageCount = 3450;
    const storageMb = 145.8;

    return {
      tenantId,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.subscription_plan,
      branding: tenant.branding_config,
      totalStudents: parseInt(studentStats[0].count),
      totalTeachers: parseInt(teacherStats[0].count),
      activeUsersCount: parseInt(activeUsers[0].count),
      batchesCount: parseInt(batchStats[0].count),
      revenue,
      outstanding,
      healthStatus,
      courses,
      attendanceRate: avgAttendance,
      aiTokensUsed: aiUsageCount,
      storageUsedMb: storageMb,
      verificationStatus: tenant.profile_details.verification_status || 'Trial'
    };
  }

  /**
   * Writes compliance audit log at tenant-level
   */
  async logAudit(db, tenantId, actorId, action, details = {}) {
    try {
      await db.query(
        `INSERT INTO public.tenant_audit_logs (tenant_id, actor_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, actorId, action, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('[Tenant Audit Logger] CMS fail:', err);
    }
  }
}

module.exports = new InstituteManager();
