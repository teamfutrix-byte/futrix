/**
 * Enterprise Test Scheduling & Publishing Engine Service
 */
class TestLifecycleEngine {

  /**
   * Safe status transition validation and audit logging
   */
  async transitionTestStatus(db, userId, testId, nextStatus) {
    const { rows: testRows } = await db.query(
      "SELECT status FROM public.tests WHERE id = $1",
      [testId]
    );
    if (testRows.length === 0) throw new Error("Test not found.");

    const currentStatus = testRows[0].status;

    // Perform transition update
    const { rows } = await db.query(`
      UPDATE public.tests
      SET status = $1
      WHERE id = $2
      RETURNING *
    `, [nextStatus, testId]);

    // Record activity audit trail
    await db.query(`
      INSERT INTO public.test_activity_logs (test_id, event_name, details_json)
      VALUES ($1, 'Status Transition', $2)
    `, [testId, JSON.stringify({ currentStatus, nextStatus, triggeredBy: userId })]);

    return rows[0];
  }

  /**
   * Maps exam schedule windows and marks status as Scheduled
   */
  async scheduleTest(db, testId, scheduleData) {
    const { publishAt, expireAt, gracePeriodMinutes } = scheduleData;

    await db.query(`
      INSERT INTO public.test_schedule (test_id, publish_at, expire_at, grace_period_minutes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET publish_at = $2, expire_at = $3, grace_period_minutes = $4
    `, [testId, publishAt, expireAt, gracePeriodMinutes || 15]);

    // Transition test status
    return this.transitionTestStatus(db, 'system', testId, 'Scheduled');
  }

  /**
   * Sets premium rules, access control, and visibility tier restrictions
   */
  async updateVisibilityRules(db, testId, visibilityTier, accessData) {
    const { allowedSubscriptionTiers, allowedLeagues } = accessData;

    // Upsert visibility tier
    await db.query(`
      INSERT INTO public.test_visibility (test_id, visibility_tier)
      VALUES ($1, $2)
    `, [testId, visibilityTier]);

    // Upsert access controls
    await db.query(`
      INSERT INTO public.test_access (test_id, allowed_subscription_tiers_json, allowed_leagues_json)
      VALUES ($1, $2, $3)
    `, [testId, JSON.stringify(allowedSubscriptionTiers || []), JSON.stringify(allowedLeagues || [])]);

    return { testId, visibilityTier, accessData };
  }

  /**
   * Audit teacher submissions reviews
   */
  async approveOrRejectTest(db, userId, testId, isApproved, comments) {
    const status = isApproved ? 'Approved' : 'Rejected';

    await db.query(`
      INSERT INTO public.test_approvals (test_id, approver_id, status, review_comments)
      VALUES ($1, $2, $3, $4)
    `, [testId, userId, status, comments]);

    const nextStatus = isApproved ? 'Approved' : 'Draft';
    return this.transitionTestStatus(db, userId, testId, nextStatus);
  }

  /**
   * Soft deletes test nodes by moving to Recycle Bin
   */
  async sendToRecycleBin(db, userId, testId) {
    await db.query(`
      INSERT INTO public.test_recycle_bin (test_id, deleted_by)
      VALUES ($1, $2)
    `, [testId, userId]);

    return this.transitionTestStatus(db, userId, testId, 'Retired');
  }

  /**
   * Restores deleted tests
   */
  async restoreFromRecycleBin(db, userId, testId) {
    await db.query(
      "DELETE FROM public.test_recycle_bin WHERE test_id = $1",
      [testId]
    );

    return this.transitionTestStatus(db, userId, testId, 'Draft');
  }
}

module.exports = new TestLifecycleEngine();
