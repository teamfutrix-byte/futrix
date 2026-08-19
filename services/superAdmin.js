const crypto = require('crypto');

// Server-Sent Events (SSE) Client Connections Pool for Live Activity streaming
let sseClients = [];

function addSseClient(res) {
  sseClients.push(res);
}

function removeSseClient(res) {
  sseClients = sseClients.filter(c => c !== res);
}

function broadcastSseEvent(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(res => {
    try {
      res.write(payload);
    } catch (err) {
      console.error('[SSE] Failed to write event to client:', err.message);
    }
  });
}

/**
 * Evaluates combined RBAC and ABAC rules for a given user.
 */
async function evaluateAccess(db, userId, requiredScope, requiredAction, context = {}) {
  // 1. Fetch user role from profiles
  const { rows: userRows } = await db.query('SELECT role, email FROM public.profiles WHERE id = $1', [userId]);
  if (userRows.length === 0) return { allowed: false, reason: 'User profile not found.' };
  let userRoleName = userRows[0].role || 'student';

  // Normalize lowercase database constraint values to system role names
  if (userRoleName === 'teacher') userRoleName = 'Teacher';
  else if (userRoleName === 'student') userRoleName = 'Student';
  else if (userRoleName === 'admin') userRoleName = 'Platform Owner';

  // 2. Fetch the target role with inheritance lineage
  const { rows: roleRows } = await db.query('SELECT * FROM public.roles');
  const roleMap = {};
  roleRows.forEach(r => { roleMap[r.name] = r; });

  const activeRole = roleMap[userRoleName];
  if (!activeRole) return { allowed: false, reason: `Assigned role '${userRoleName}' does not exist.` };

  // Resolve inherited roles recursively to compile complete role scope list
  const rolesToScan = [userRoleName];
  const scanned = new Set();
  const allRolesLineage = [];

  while (rolesToScan.length > 0) {
    const currentRole = rolesToScan.shift();
    if (scanned.has(currentRole)) continue;
    scanned.add(currentRole);
    allRolesLineage.push(currentRole);

    const rObj = roleMap[currentRole];
    if (rObj && rObj.inherited_roles) {
      rObj.inherited_roles.forEach(inherited => {
        if (!scanned.has(inherited)) {
          rolesToScan.push(inherited);
        }
      });
    }
  }

  // 3. Retrieve all permissions matching any role in the lineage
  const { rows: perms } = await db.query(`
    SELECT p.* FROM public.permissions p
    JOIN public.roles r ON p.role_id = r.id
    WHERE r.name = ANY($1::text[])
  `, [allRolesLineage]);

  // Filter permission records matching required scope and action
  const matchedPerms = perms.filter(p => {
    const isScopeMatch = p.scope === requiredScope || p.scope === '*';
    const isActionMatch = p.actions.includes(requiredAction) || p.actions.includes('*');
    return isScopeMatch && isActionMatch;
  });

  if (matchedPerms.length === 0) {
    return { allowed: false, reason: `Role lineage does not possess '${requiredAction}' permission on scope '${requiredScope}'.` };
  }

  // 4. Perform Attribute-Based Access Control (ABAC) evaluation on matched permissions
  for (const perm of matchedPerms) {
    const cond = perm.conditions || {};
    let isAbacPassed = true;

    // Check Time constraints (e.g., allowed only between 08:00 and 20:00)
    if (cond.allowed_hours) {
      const currentHour = new Date().getUTCHours() + 5.5; // Simple IST conversion for testing
      const [start, end] = cond.allowed_hours;
      if (currentHour < start || currentHour > end) {
        isAbacPassed = false;
        continue;
      }
    }

    // Check Network IP constraints
    if (cond.allowed_ips && cond.allowed_ips.length > 0) {
      if (!context.ip || !cond.allowed_ips.includes(context.ip)) {
        isAbacPassed = false;
        continue;
      }
    }

    // Check Device restrictions
    if (cond.allowed_devices && cond.allowed_devices.length > 0) {
      if (!context.device || !cond.allowed_devices.includes(context.device)) {
        isAbacPassed = false;
        continue;
      }
    }

    // Check Risk Score bounds (security levels)
    if (cond.max_risk_score !== undefined) {
      const risk = context.riskScore || 0;
      if (risk > cond.max_risk_score) {
        isAbacPassed = false;
        continue;
      }
    }

    // Check Tenant isolation matches (Multi-Tenant boundary check)
    if (cond.restrict_to_tenant) {
      if (context.tenantId !== cond.restrict_to_tenant) {
        isAbacPassed = false;
        continue;
      }
    }

    // If any matched permission satisfies all ABAC conditions, access is granted!
    if (isAbacPassed) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'ABAC constraint validation check failed.' };
}

/**
 * Proposes or saves a platform configuration update with version lineage
 */
async function proposeConfigChange(db, key, value, category, reason, proposedBy) {
  // Check validation rules first to verify input compatibility
  if (!key || value === undefined) throw new Error('Config key and value must be supplied.');

  // Validate limits (e.g. free daily limit must be less than 50)
  if (key === 'ai_daily_limit_free') {
    const val = typeof value === 'string' ? JSON.parse(value) : value;
    if (val.limit && val.limit > 50) {
      throw new Error('AI daily free limit cannot exceed 50 requests.');
    }
  }

  // 1. Fetch current config row
  const { rows: currentRows } = await db.query('SELECT * FROM public.platform_configs WHERE key = $1', [key]);
  
  if (currentRows.length === 0) {
    // Insert new config record
    const { rows: insertRows } = await db.query(`
      INSERT INTO public.platform_configs (category, key, value, version, status, updated_by, updated_at)
      VALUES ($1, $2, $3, 1, 'Approved', $4, now())
      RETURNING *;
    `, [category || 'general', key, JSON.stringify(value), proposedBy]);

    // Audit Log Creation
    await db.query(`
      INSERT INTO public.validation_audit_logs (user_id, action, details)
      VALUES ($1, 'create_config', $2)
    `, [proposedBy, `Created new configuration '${key}'`]);

    return { success: true, status: 'Approved', config: insertRows[0] };
  }

  const current = currentRows[0];

  // 2. Propose draft (requires approval if config is marked as critical)
  const isCritical = ['password_policy', 'api_security_keys', 'ai_daily_limit_pro'].includes(key);

  if (isCritical) {
    // Insert to approval requests
    const { rows: appRows } = await db.query(`
      INSERT INTO public.approval_requests (request_type, payload, status, requested_by, comments)
      VALUES ($1, $2, 'Pending', $3, $4)
      RETURNING *;
    `, ['config_change', JSON.stringify({ configId: current.id, key, value, category }), proposedBy, reason || 'Proposing critical update.']);

    // Log to SSE stream
    broadcastSseEvent({
      event: 'approval_requested',
      summary: `Critical configuration change requested for key: ${key}`,
      timestamp: new Date().toISOString()
    });

    return { success: true, status: 'Pending Approval', request: appRows[0] };
  }

  // Non-critical config commits directly, incrementing version and saving old version in history config_versions
  const parentVersion = current.version;
  
  // Save current values to version backup
  await db.query(`
    INSERT INTO public.config_versions (config_id, version, value, change_summary, changed_by, created_at)
    VALUES ($1, $2, $3, $4, $5, now())
  `, [current.id, parentVersion, JSON.stringify(current.value), reason || 'Config update backup', proposedBy]);

  // Update active record value
  const { rows: updatedRows } = await db.query(`
    UPDATE public.platform_configs
    SET value = $1, version = version + 1, updated_by = $2, updated_at = now()
    WHERE id = $3 RETURNING *;
  `, [JSON.stringify(value), proposedBy, current.id]);

  // Log to audit log
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'update_config', $2)
  `, [proposedBy, `Updated configuration key '${key}' to version ${updatedRows[0].version}`]);

  return { success: true, status: 'Approved', config: updatedRows[0] };
}

/**
 * Rolls back configuration to a target historical version
 */
async function rollbackConfig(db, configId, targetVersionNum, editorId) {
  // Fetch historical backup config value
  const { rows: histRows } = await db.query(`
    SELECT * FROM public.config_versions 
    WHERE config_id = $1 AND version = $2
  `, [configId, targetVersionNum]);

  if (histRows.length === 0) throw new Error(`Historical version ${targetVersionNum} not found in history backups.`);
  const targetHist = histRows[0];

  // Fetch active configuration key name
  const { rows: activeRows } = await db.query('SELECT * FROM public.platform_configs WHERE id = $1', [configId]);
  if (activeRows.length === 0) throw new Error('Active configuration record not found.');
  const active = activeRows[0];

  // Save current active config to versions history before overwriting
  const currentVer = active.version;
  await db.query(`
    INSERT INTO public.config_versions (config_id, version, value, change_summary, changed_by, created_at)
    VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT (config_id, version) DO NOTHING;
  `, [active.id, currentVer, JSON.stringify(active.value), `Backup before rolling back to version ${targetVersionNum}`, editorId]);

  // Overwrite active configuration value
  const { rows: updatedRows } = await db.query(`
    UPDATE public.platform_configs
    SET value = $1, version = version + 1, updated_by = $2, updated_at = now()
    WHERE id = $3 RETURNING *;
  `, [JSON.stringify(targetHist.value), editorId, configId]);

  // Audit event log
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'rollback_config', $2)
  `, [editorId, `Rolled back configuration key '${active.key}' to values from version ${targetVersionNum}`]);

  return updatedRows[0];
}

/**
 * Activates or deactivates emergency lockdown state parameters
 */
async function activateEmergencyState(db, stateName, isActive, editorId, reason) {
  const query = `
    UPDATE public.emergency_states
    SET is_active = $1, updated_by = $2, updated_at = now(), reason = $3
    WHERE state_name = $4 RETURNING *;
  `;
  const { rows } = await db.query(query, [isActive, editorId, reason || 'Emergency override command triggered.', stateName]);
  if (rows.length === 0) throw new Error(`Emergency state '${stateName}' does not exist.`);

  // Audit log event
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'emergency_toggle', $2)
  `, [editorId, `Emergency state '${stateName}' toggled to: ${isActive}. Reason: ${reason}`]);

  // Broadcast event to active admin clients via SSE
  broadcastSseEvent({
    event: 'emergency_toggled',
    state: stateName,
    active: isActive,
    summary: `Emergency status '${stateName}' modified to ${isActive.toString().toUpperCase()}`,
    timestamp: new Date().toISOString()
  });

  return rows[0];
}

module.exports = {
  addSseClient,
  removeSseClient,
  broadcastSseEvent,
  evaluateAccess,
  proposeConfigChange,
  rollbackConfig,
  activateEmergencyState
};
