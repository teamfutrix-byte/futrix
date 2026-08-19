/**
 * Enterprise Content Access Control Center (CACC) Service
 * Central policy validation and content visibility manager.
 */
class ContentAccessManager {

  /**
   * Validates if a user can access a specific resource based on subscription policies,
   * leagues, XP, and admin overrides.
   */
  async validateAccess(db, userId, contentType, contentId, resourceKey) {
    // 1. Admin/Teacher Bypass
    const { rows: profileRows } = await db.query(
      "SELECT role FROM public.profiles WHERE id = $1",
      [userId]
    );
    const role = profileRows[0]?.role || 'student';
    if (role === 'admin' || role === 'teacher') {
      return { allowed: true, reason: 'Role override bypass' };
    }

    // 2. Fetch User's Active Subscription Plan (mapping student_id and plan_id values)
    const { rows: subRows } = await db.query(`
      SELECT plan_id, status
      FROM public.subscriptions
      WHERE student_id::text = $1::text AND status = 'Active'
      ORDER BY id DESC LIMIT 1
    `, [userId]);

    let planName = 'FREE';
    if (subRows.length > 0) {
      const pId = subRows[0].plan_id;
      if (pId === 'plan_premium_monthly' || pId === 'plan_premium_annual' || pId === 'PREMIUM' || pId === 'PRO') {
        planName = 'PREMIUM';
      } else if (pId === 'plan_free_trial' || pId === 'FREE') {
        planName = 'FREE';
      } else if (pId) {
        planName = pId.toUpperCase();
      }
    }

    // 3. Check Resource-Specific Visibility Tiers
    let visibilityLevel = 'Free';
    let isLocked = false;

    const { rows: accessRows } = await db.query(`
      SELECT id, visibility_level, is_locked FROM public.content_access
      WHERE (content_type = $1 AND content_id = $2)
         OR (content_type = $1 AND resource_key = $3)
      LIMIT 1
    `, [contentType, contentId || null, resourceKey || null]);

    if (accessRows.length > 0) {
      visibilityLevel = accessRows[0].visibility_level;
      isLocked = accessRows[0].is_locked;
    }

    if (isLocked) {
      return {
        allowed: false,
        lockReason: 'Resource explicitly locked by Admin',
        benefits: `Unlock premium ${contentType} content for advanced practice`,
        estimatedUnlockValueXP: 150
      };
    }

    // 4. Resolve Plan Eligibility via Content Policies
    const { rows: policyRows } = await db.query(`
      SELECT allowed_plans_json, allowed_leagues_json, required_xp
      FROM public.content_policies
      WHERE content_type = $1 AND visibility_level = $2 AND is_enabled = true
      LIMIT 1
    `, [contentType, visibilityLevel]);

    if (policyRows.length > 0) {
      const allowedPlans = policyRows[0].allowed_plans_json || [];
      
      // If plan is not in allowed plans
      if (allowedPlans.length > 0 && !allowedPlans.includes(planName)) {
        return {
          allowed: false,
          lockReason: `Requires a ${visibilityLevel} subscription plan`,
          benefits: `Gain complete unlimited access to all ${contentType} content`,
          estimatedUnlockValueXP: 250
        };
      }
    }

    // 5. Resolve Plan Eligibility via Subscription Rules
    const { rows: ruleRows } = await db.query(`
      SELECT access_granted, daily_limit FROM public.subscription_rules
      WHERE plan_name = $1 AND feature_key = $2
    `, [planName, resourceKey || contentType]);

    if (ruleRows.length > 0) {
      const rule = ruleRows[0];
      if (!rule.access_granted) {
        return {
          allowed: false,
          lockReason: `Plan ${planName} does not grant access to this feature`,
          benefits: `Unlock active modules like ${resourceKey || contentType}`,
          estimatedUnlockValueXP: 200
        };
      }
    }

    return { allowed: true, planName };
  }

  /**
   * Updates visibility level of a single content resource
   */
  async updateContentVisibility(db, contentType, contentId, resourceKey, visibilityLevel) {
    const { rows } = await db.query(`
      INSERT INTO public.content_access (content_type, content_id, resource_key, visibility_level)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (content_type, content_id, resource_key) DO UPDATE
      SET visibility_level = $4, updated_at = now()
      RETURNING *
    `, [contentType, contentId || null, resourceKey || null, visibilityLevel]);

    return rows[0];
  }

  /**
   * Bulk updates content policies based on filters
   */
  async bulkUpdateContentPolicy(db, filters, visibilityLevel) {
    const { subject, chapter, topic, difficulty } = filters;

    // Scan questions matching criteria
    let query = "SELECT id FROM public.questions WHERE 1=1";
    const params = [];
    let paramIdx = 1;

    if (subject) {
      query += ` AND subject = $${paramIdx++}`;
      params.push(subject);
    }
    if (chapter) {
      query += ` AND chapter = $${paramIdx++}`;
      params.push(chapter);
    }
    if (topic) {
      query += ` AND topic = $${paramIdx++}`;
      params.push(topic);
    }
    if (difficulty) {
      query += ` AND difficulty = $${paramIdx++}`;
      params.push(difficulty);
    }

    query += " LIMIT 200";

    const { rows: questions } = await db.query(query, params);
    
    let count = 0;
    for (const q of questions) {
      await db.query(`
        INSERT INTO public.content_access (content_type, content_id, visibility_level)
        VALUES ('Question', $1, $2)
        ON CONFLICT (content_type, content_id, resource_key) DO UPDATE
        SET visibility_level = $2, updated_at = now()
      `, [q.id, visibilityLevel]);
      count++;
    }

    // Trigger update stats in analytics
    await db.query(`
      INSERT INTO public.content_access_analytics (recorded_date, premium_content_count)
      VALUES (CURRENT_DATE, $1)
      ON CONFLICT (recorded_date) DO UPDATE
      SET premium_content_count = public.content_access_analytics.premium_content_count + $1
    `, [count]).catch(() => {});

    return { processedCount: count, filters, visibilityLevel };
  }

  /**
   * Logs premium content locked screen click events
   */
  async logLockClick(db, userId, contentType, contentId, resourceKey, upgradeClicked) {
    const { rows } = await db.query(`
      INSERT INTO public.content_lock_logs (user_id, content_type, content_id, resource_key, upgrade_clicked)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, contentType, contentId || null, resourceKey || null, upgradeClicked || false]);

    // Increment locked clicks count in analytics
    await db.query(`
      INSERT INTO public.content_access_analytics (recorded_date, locked_clicks_count, conversion_count)
      VALUES (CURRENT_DATE, 1, $1)
      ON CONFLICT (recorded_date) DO UPDATE
      SET locked_clicks_count = public.content_access_analytics.locked_clicks_count + 1,
          conversion_count = public.content_access_analytics.conversion_count + $1
    `, [upgradeClicked ? 1 : 0]).catch(() => {});

    return rows[0];
  }

  /**
   * Rolls back a content policy to a previous configuration version
   */
  async rollbackPolicy(db, policyId, versionNumber, editorId) {
    const { rows: versionRows } = await db.query(`
      SELECT policy_data_json FROM public.policy_versions
      WHERE policy_id = $1 AND version_number = $2
      LIMIT 1
    `, [policyId, versionNumber]);

    if (versionRows.length === 0) {
      throw new Error(`Policy version ${versionNumber} not found.`);
    }

    const config = versionRows[0].policy_data_json;

    await db.query(`
      UPDATE public.content_policies
      SET visibility_level = $2, allowed_plans_json = $3, allowed_leagues_json = $4, required_xp = $5, is_enabled = $6
      WHERE id = $1
    `, [
      policyId,
      config.visibility_level,
      JSON.stringify(config.allowed_plans_json || []),
      JSON.stringify(config.allowed_leagues_json || []),
      config.required_xp || 0,
      config.is_enabled !== false
    ]);

    // Record new version log
    const { rows: maxVer } = await db.query(
      "SELECT COALESCE(MAX(version_number), 0) + 1 as next_ver FROM public.policy_versions WHERE policy_id = $1",
      [policyId]
    );

    const nextVer = maxVer[0].next_ver;

    await db.query(`
      INSERT INTO public.policy_versions (policy_id, version_number, editor_id, policy_data_json, change_reason)
      VALUES ($1, $2, $3, $4, $5)
    `, [policyId, nextVer, editorId, JSON.stringify(config), `Rollback to version ${versionNumber}`]);

    return { policyId, restoredVersion: versionNumber, currentVersion: nextVer };
  }

  /**
   * Compiles free content, premium content count and conversion analytics
   */
  async getContentAnalytics(db) {
    const { rows: counts } = await db.query(`
      SELECT 
        SUM(CASE WHEN visibility_level = 'Free' THEN 1 ELSE 0 END) as free_count,
        SUM(CASE WHEN visibility_level = 'Premium' THEN 1 ELSE 0 END) as premium_count,
        SUM(CASE WHEN visibility_level = 'Institute Only' THEN 1 ELSE 0 END) as institute_count
      FROM public.content_access
    `);

    const { rows: analyticRows } = await db.query(`
      SELECT * FROM public.content_access_analytics
      ORDER BY recorded_date DESC LIMIT 7
    `);

    return {
      distribution: {
        freeCount: parseInt(counts[0]?.free_count || 0),
        premiumCount: parseInt(counts[0]?.premium_count || 0),
        instituteCount: parseInt(counts[0]?.institute_count || 0)
      },
      dailyAnalytics: analyticRows
    };
  }
}

module.exports = new ContentAccessManager();
