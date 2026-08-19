const crypto = require('crypto');

async function getModules(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_modules ORDER BY id ASC");
  return rows;
}

async function getServices(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_services ORDER BY id ASC");
  return rows;
}

async function getApiPolicies(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_api_policies ORDER BY endpoint ASC");
  return rows;
}

async function getDataObjects(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_data_objects ORDER BY table_name ASC");
  return rows;
}

async function getChanges(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_change_management ORDER BY created_at DESC");
  return rows;
}

async function proposeChange(db, { moduleId, proposedChange, draftBy, testingEvidence, deploymentPlan }) {
  const { rows } = await db.query(`
    INSERT INTO public.gov_change_management (module_id, proposed_change, draft_by, testing_evidence, deployment_plan, review_status, status)
    VALUES ($1, $2, $3, $4, $5, 'Review', 'Pending')
    RETURNING *
  `, [moduleId, proposedChange, draftBy, testingEvidence, deploymentPlan]);

  return rows[0];
}

async function approveChange(db, changeId, approvedBy) {
  const { rows } = await db.query(`
    UPDATE public.gov_change_management
    SET review_status = 'Approved', approved_by = $1, status = 'Completed'
    WHERE id = $2
    RETURNING *
  `, [approvedBy, changeId]);

  if (rows.length === 0) {
    throw new Error(`Change ticket with ID '${changeId}' not found.`);
  }

  return rows[0];
}

async function getReleases(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_releases ORDER BY created_at DESC");
  return rows;
}

async function createRelease(db, { version, releaseNotes, approvals, deploymentPlan, rollbackPlan, riskScore, knownIssues, owner }) {
  const { rows } = await db.query(`
    INSERT INTO public.gov_releases (version, release_notes, approvals, deployment_plan, rollback_plan, risk_score, known_issues, owner)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [version, releaseNotes, approvals, deploymentPlan, rollbackPlan, riskScore, knownIssues, owner]);

  return rows[0];
}

async function getDisasterRecovery(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_disaster_recovery ORDER BY system_key ASC");
  return rows;
}

async function triggerFailover(db, systemKey, targetCloud) {
  // Determine target region based on cloud
  const targetRegion = targetCloud === 'AWS' ? 'eu-west-1' : 'us-central1';
  
  // Calculate simulated RTO / RPO speeds under SLA limits
  const rto = (0.2 + Math.random() * 0.5).toFixed(3); // SLA: <1.0s
  const rpo = (1.5 + Math.random() * 2.0).toFixed(2); // SLA: <5.0s

  const { rows } = await db.query(`
    UPDATE public.gov_disaster_recovery
    SET active_cloud = $1, active_region = $2, rto_seconds = $3, rpo_seconds = $4, last_failover_test = NOW(), db_replica_status = 'Healthy Sync'
    WHERE system_key = $5
    RETURNING *
  `, [targetCloud, targetRegion, rto, rpo, systemKey]);

  if (rows.length === 0) {
    throw new Error(`System key '${systemKey}' not found in DR registry.`);
  }

  return rows[0];
}

async function rotateRootKeys(db, actor, ip, device) {
  // Increment version of a core secret in DB
  const { rows: secretCheck } = await db.query(`
    SELECT version FROM public.infra_secrets 
    WHERE environment_id = 'production' AND key_name = 'GEMINI_PRIMARY_API_KEY'
  `);
  
  let newVersion = 2;
  if (secretCheck.length > 0) {
    newVersion = secretCheck[0].version + 1;
  }

  // Update secrets vault
  await db.query(`
    UPDATE public.infra_secrets
    SET version = $1, last_rotated = NOW()
    WHERE environment_id = 'production' AND key_name = 'GEMINI_PRIMARY_API_KEY'
  `, [newVersion]);

  // Log strict governance security audit entry
  const audit = await logAudit(db, {
    actor,
    action: 'ROTATE_ROOT_KEYS',
    target: 'GEMINI_PRIMARY_API_KEY',
    ipAddress: ip,
    device: device,
    environment: 'production',
    result: 'SUCCESS',
    correlationId: crypto.randomUUID()
  });

  return {
    success: true,
    newVersion,
    auditEntry: audit
  };
}

async function logAudit(db, { actor, action, target, ipAddress, device, environment, result, correlationId }) {
  const { rows } = await db.query(`
    INSERT INTO public.gov_audit_logs (actor, action, target, ip_address, device, environment, result, correlation_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [actor, action, target, ipAddress || '127.0.0.1', device || 'System', environment || 'production', result || 'SUCCESS', correlationId || crypto.randomUUID()]);

  return rows[0];
}

async function getAuditLogs(db) {
  const { rows } = await db.query("SELECT * FROM public.gov_audit_logs ORDER BY timestamp DESC LIMIT 50");
  return rows;
}

module.exports = {
  getModules,
  getServices,
  getApiPolicies,
  getDataObjects,
  getChanges,
  proposeChange,
  approveChange,
  getReleases,
  createRelease,
  getDisasterRecovery,
  triggerFailover,
  rotateRootKeys,
  logAudit,
  getAuditLogs
};
