const crypto = require('crypto');

/**
 * Enterprise Security Operations Center (SOC) & Threat Intelligence manager
 */
class SecurityManager {

  /**
   * Aggregates cyber security statistics and health indicators
   */
  async getSecurityKPIs(db) {
    try {
      const { rows: blockedIps } = await db.query("SELECT COUNT(*) as count FROM public.security_blocked_ips");
      const { rows: vulns } = await db.query("SELECT COUNT(*) as count FROM public.security_vulnerabilities WHERE status = 'Open'");
      const { rows: patches } = await db.query("SELECT COUNT(*) as count FROM public.security_patches WHERE status = 'Pending'");
      
      // Calculate safety events from logged WAF blocks & failed logins
      const { rows: securityIncidents } = await db.query(
        "SELECT COUNT(*) as count FROM public.incidents WHERE title LIKE 'Web Application Firewall%'"
      );
      const { rows: failedLogins } = await db.query(
        "SELECT COALESCE(SUM(failed_logins), 0) as count FROM public.iam_verification_states"
      );

      const blockCount = parseInt(blockedIps[0].count || 0);
      const vulnCount = parseInt(vulns[0].count || 0);
      const patchCount = parseInt(patches[0].count || 0);
      const incidentsCount = parseInt(securityIncidents[0].count || 0);
      const loginFailures = parseInt(failedLogins[0].count || 0);

      // Threat Level Heuristics
      let threatLevel = 'Low';
      if (blockCount > 0 || incidentsCount > 0) threatLevel = 'Elevated';
      if (incidentsCount > 3 || loginFailures > 10) threatLevel = 'Critical';

      // Security Health Score out of 100
      let score = 100 - (vulnCount * 5) - (patchCount * 3) - (incidentsCount * 10);
      score = Math.max(20, Math.min(100, score));

      return {
        threatLevel,
        blockedIpsCount: blockCount,
        securityEventsCount: incidentsCount + loginFailures,
        openVulnerabilities: vulnCount,
        pendingPatches: patchCount,
        securityScore: score,
        failedLoginsCount: loginFailures,
        ddosAttempts: 0,
        botTrafficPct: 1.2
      };
    } catch (err) {
      console.error("[SOC Security Manager] Failed to load security KPIs:", err);
      return {
        threatLevel: 'Low',
        blockedIpsCount: 0,
        securityEventsCount: 0,
        openVulnerabilities: 0,
        pendingPatches: 0,
        securityScore: 100,
        failedLoginsCount: 0,
        ddosAttempts: 0,
        botTrafficPct: 0
      };
    }
  }

  /**
   * Manually blocks an IP address in the firewall
   */
  async blockIpAddress(db, { ipAddress, reason, durationMinutes = 60 }) {
    console.log(`[WAF Firewall] Blocking IP Address: ${ipAddress} (Reason: ${reason}, Duration: ${durationMinutes} mins)`);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const { rows } = await db.query(`
      INSERT INTO public.security_blocked_ips (ip_address, blocked_reason, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (ip_address) DO UPDATE SET 
        blocked_reason = EXCLUDED.blocked_reason,
        expires_at = EXCLUDED.expires_at,
        blocked_at = now()
      RETURNING *
    `, [ipAddress, reason, expiresAt]);

    return rows[0];
  }

  /**
   * Unblocks an IP address
   */
  async unblockIpAddress(db, ipAddress) {
    console.log(`[WAF Firewall] Unblocking IP Address: ${ipAddress}`);
    await db.query("DELETE FROM public.security_blocked_ips WHERE ip_address = $1", [ipAddress]);
    return { success: true };
  }

  /**
   * Registers a vulnerability CVE entry
   */
  async registerVulnerability(db, { componentName, cveId, severity, description }) {
    const { rows } = await db.query(`
      INSERT INTO public.security_vulnerabilities (component_name, cve_id, severity, description, status)
      VALUES ($1, $2, $3, $4, 'Open')
      RETURNING *
    `, [componentName, cveId, severity, description]);
    return rows[0];
  }

  /**
   * Applies a security hotfix patch
   */
  async applyPatch(db, { patchId, appliedBy }) {
    console.log(`[SOC Patches] Applying hotfix Patch ID: ${patchId} (By: ${appliedBy})`);

    const { rows } = await db.query(`
      UPDATE public.security_patches 
      SET status = 'Applied', applied_at = now(), applied_by = $1
      WHERE id = $2
      RETURNING *
    `, [appliedBy || 'SRE On-Call', patchId]);

    // Log SRE Audit
    await db.query(`
      INSERT INTO public.infra_audit_logs (action, details)
      VALUES ($1, $2)
    `, ['SecurityPatchApplied', `SRE hotfix patch successfully applied: '${rows[0]?.patch_name || patchId}'.`]).catch(() => {});

    return rows[0];
  }

  /**
   * WAF Middleware: Inspects request metadata and payload parameters for threat signatures
   */
  async inspectIncomingRequest(db, { ipAddress, userId, endpoint, userAgent, payload }) {
    // 1. Check if IP is currently blocked
    const { rows: blockCheck } = await db.query(
      `SELECT expires_at FROM public.security_blocked_ips 
       WHERE ip_address = $1 AND (expires_at IS NULL OR expires_at > now())`,
      [ipAddress]
    );

    if (blockCheck.length > 0) {
      console.warn(`[WAF Firewall] Blocked incoming request from firewall IP: ${ipAddress}`);
      return { blocked: true, reason: 'IP Address is blocked by WAF policy rules.' };
    }

    // 2. Perform OWASP signature scanner checks
    const targetString = `${endpoint} ${userAgent} ${JSON.stringify(payload || {})}`;
    
    // OWASP Threats Signatures
    const sqlInjectionSig = /(\%27)|(\')|(\-\-)|(\#)|(UNION|SELECT|INSERT|DELETE|UPDATE|DROP\s)/i;
    const xssScriptSig = /(<script)|(javascript:)|(onload=)|(onerror=)/i;
    const pathTraversalSig = /(\.\.\/)|(\.\.\\)/i;

    let matchedSignature = null;
    if (sqlInjectionSig.test(targetString)) matchedSignature = 'SQL Injection Attempt';
    else if (xssScriptSig.test(targetString)) matchedSignature = 'Cross-Site Scripting (XSS)';
    else if (pathTraversalSig.test(targetString)) matchedSignature = 'Path Traversal Vulnerability';

    if (matchedSignature) {
      console.error(`[WAF Alert] Threat signature matched! Event Type: ${matchedSignature} from IP: ${ipAddress}`);
      
      // Auto-block the attacker IP for 60 minutes
      await this.blockIpAddress(db, {
        ipAddress,
        reason: `Automated WAF block: matched threat signature "${matchedSignature}"`,
        durationMinutes: 60
      });

      // Log Security Incident Ticket
      const affectedServices = ['api_gateway', 'security_soc'];
      const rootCause = `Incoming threat signature matched: '${matchedSignature}'. Attacking parameters payload: ${JSON.stringify(payload)}`;
      
      await db.query(`
        INSERT INTO public.incidents (title, severity, status, affected_services, root_cause, current_owner)
        VALUES ($1, $2, 'Detected', $3, $4, 'SOC Analyst')
      `, [`Web Application Firewall: Blocked ${matchedSignature}`, 'Critical', affectedServices, rootCause]);

      return { blocked: true, reason: `Request blocked: WAF threat signature matched (${matchedSignature}).` };
    }

    return { blocked: false };
  }
}

module.exports = new SecurityManager();
