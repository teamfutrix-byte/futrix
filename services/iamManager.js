const crypto = require('crypto');

/**
 * Enterprise Identity & Access Management (IAM) service
 */
class IamManager {

  /**
   * Verifies if a user holds a specific granular permission (RBAC)
   */
  async verifyPermission(db, userId, permissionId) {
    // 1. Resolve user's role
    const { rows: profile } = await db.query(
      `SELECT role FROM public.profiles WHERE id = $1`,
      [userId]
    );

    if (profile.length === 0) return false;
    const role = profile[0].role;

    // Super Admin bypass
    if (role === 'admin') return true;

    // 2. Query permission mapping
    const { rows: perm } = await db.query(
      `SELECT 1 FROM public.iam_role_permissions 
       WHERE role = $1 AND permission_id = $2`,
      [role, permissionId]
    );

    return perm.length > 0;
  }

  /**
   * Creates an active session enforcing 5-session concurrent limits
   */
  async createSession(db, { userId, deviceId, browser, os, ip, location }) {
    console.log(`[IAM Session Manager] Generating active session for User: ${userId} on ${browser}`);

    // 1. Enforce concurrent session limit policy (Max 5 active sessions)
    const { rows: activeSessions } = await db.query(
      `SELECT session_id FROM public.iam_sessions 
       WHERE user_id = $1 AND status = 'Active' 
       ORDER BY login_time ASC`,
      [userId]
    );

    if (activeSessions.length >= 5) {
      const oldestSessionId = activeSessions[0].session_id;
      console.log(`[IAM Session Manager] Concurrent limit reached (5). Revoking oldest session ID: ${oldestSessionId}`);
      await db.query(
        `UPDATE public.iam_sessions SET status = 'Revoked' WHERE session_id = $1`,
        [oldestSessionId]
      );
    }

    // 2. Insert new session
    const { rows } = await db.query(
      `INSERT INTO public.iam_sessions (
        user_id, device_id, browser, operating_system, ip_address, location, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Active')
       RETURNING *`,
      [userId, deviceId, browser, os, ip, location]
    );

    return rows[0];
  }

  /**
   * Revokes an active session
   */
  async revokeSession(db, sessionId) {
    console.log(`[IAM Session Manager] Revoking session: ${sessionId}`);
    await db.query(
      `UPDATE public.iam_sessions SET status = 'Revoked' WHERE session_id = $1`,
      [sessionId]
    );
    return { success: true };
  }

  /**
   * Tracks failed login attempts and triggers automated lockouts
   */
  async trackFailedLogin(db, userId) {
    // Check if verification record exists
    const { rows: checkRow } = await db.query(
      `SELECT failed_logins, account_status FROM public.iam_verification_states WHERE user_id = $1`,
      [userId]
    );

    if (checkRow.length === 0) {
      await db.query(
        `INSERT INTO public.iam_verification_states (user_id, failed_logins, account_status)
         VALUES ($1, 1, 'Active')`,
        [userId]
      );
      return { attempts: 1, locked: false };
    }

    const nextFailed = checkRow[0].failed_logins + 1;
    let status = checkRow[0].account_status;
    let expiresAt = null;

    if (nextFailed >= 5) {
      status = 'Locked';
      // Lock account for 15 minutes
      expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      console.warn(`[IAM Lockout] User ${userId} exceeded 5 failed logins. Account LOCKED.`);
    }

    await db.query(
      `UPDATE public.iam_verification_states 
       SET failed_logins = $1, account_status = $2, lock_expires_at = $3
       WHERE user_id = $4`,
      [nextFailed, status, expiresAt, userId]
    );

    return { attempts: nextFailed, locked: status === 'Locked', lockExpiresAt: expiresAt };
  }

  /**
   * Resets login failed counters and unlocks account
   */
  async resetFailedLogins(db, userId) {
    await db.query(
      `UPDATE public.iam_verification_states 
       SET failed_logins = 0, account_status = 'Active', lock_expires_at = NULL
       WHERE user_id = $1`,
      [userId]
    );
    return { success: true };
  }

  /**
   * Creates a workflow access upgrade request
   */
  async processAccessRequest(db, { userId, requestedRole, reason }) {
    const { rows } = await db.query(
      `INSERT INTO public.iam_access_requests (user_id, requested_role, reason, status)
       VALUES ($1, $2, $3, 'Pending')
       RETURNING *`,
      [userId, requestedRole, reason]
    );
    return rows[0];
  }

  /**
   * Aggregates live KPI indicators for the identity dashboard
   */
  async getDashboardKPIs(db) {
    const { rows: users } = await db.query(`SELECT COUNT(*) as count FROM public.profiles`);
    const { rows: locked } = await db.query(`SELECT COUNT(*) as count FROM public.iam_verification_states WHERE account_status = 'Locked'`);
    const { rows: sessions } = await db.query(`SELECT COUNT(*) as count FROM public.iam_sessions WHERE status = 'Active'`);
    const { rows: mfa } = await db.query(`SELECT COUNT(*) as count FROM public.iam_verification_states WHERE mfa_enabled = true`);

    const totalUsers = parseInt(users[0].count || 0);
    const mfaUsers = parseInt(mfa[0].count || 0);
    const mfaRate = totalUsers > 0 ? ((mfaUsers / totalUsers) * 100).toFixed(1) : 0;

    return {
      registeredUsers: totalUsers,
      lockedAccounts: parseInt(locked[0].count || 0),
      activeSessions: parseInt(sessions[0].count || 0),
      mfaAdoptionRate: parseFloat(mfaRate)
    };
  }
}

module.exports = new IamManager();
