const crypto = require('crypto');

/**
 * Retrieves overall environments list and telemetry metrics
 */
async function getEnvironments(db) {
  const { rows } = await db.query("SELECT * FROM public.infra_environments ORDER BY id ASC");
  return rows;
}

/**
 * Retrieves list of Kubernetes pods for an environment
 */
async function getPods(db, envId) {
  const { rows } = await db.query("SELECT * FROM public.infra_pods WHERE environment_id = $1 ORDER BY id ASC", [envId]);
  return rows;
}

/**
 * Triggers a pod delete action. Pod transitions:
 * 'Running' -> 'Terminating' -> Rescheduled as new pod -> 'Pending' -> 'Running'
 */
async function deletePod(db, podId) {
  // 1. Fetch current pod details
  const { rows } = await db.query("SELECT * FROM public.infra_pods WHERE id = $1", [podId]);
  if (rows.length === 0) throw new Error("Pod not found: " + podId);
  const pod = rows[0];

  // 2. Set status to Terminating
  await db.query("UPDATE public.infra_pods SET status = 'Terminating' WHERE id = $1", [podId]);

  // Log audit
  await db.query(`
    INSERT INTO public.infra_logs (action, details) VALUES ($1, $2)
  `, ['PodDeletionTriggered', `Pod ${podId} in environment ${pod.environment_id} set to Terminating.`]).catch(() => {
    // Try public.infra_audit_logs if public.infra_logs does not exist
    db.query(`
      INSERT INTO public.infra_audit_logs (action, details) VALUES ($1, $2)
    `, ['PodDeletionTriggered', `Pod ${podId} in environment ${pod.environment_id} set to Terminating.`]).catch(e => console.error("Audit log write failed:", e.message));
  });

  // 3. Asynchronously trigger pod replacement schedule (self-healing)
  setTimeout(async () => {
    const backgroundDb = new (db.constructor)(db.connectionParameters);
    try {
      await backgroundDb.connect();
      // Delete old pod
      await backgroundDb.query("DELETE FROM public.infra_pods WHERE id = $1", [podId]);

      // Spawn replacement pod in Pending status
      const newPodId = `pod-${pod.deployment_name}-${pod.environment_id}-${Math.random().toString(36).substring(2, 7)}`;
      await backgroundDb.query(`
        INSERT INTO public.infra_pods (id, environment_id, namespace, deployment_name, status, cpu_usage, memory_usage_mb, restart_count)
        VALUES ($1, $2, $3, $4, 'Pending', 0.1, 10.0, 0)
      `, [newPodId, pod.environment_id, pod.namespace, pod.deployment_name]);

      console.log(`[K8S RESCHEDULER] Spawned replacement pod ${newPodId} in Pending status.`);

      // After another 1.5 seconds, promote replacement pod to Running status
      setTimeout(async () => {
        const promoDb = new (db.constructor)(db.connectionParameters);
        try {
          await promoDb.connect();
          await promoDb.query(`
            UPDATE public.infra_pods
            SET status = 'Running', cpu_usage = 1.2, memory_usage_mb = 64.0
            WHERE id = $1
          `, [newPodId]);
          console.log(`[K8S RESCHEDULER] Replacement pod ${newPodId} successfully promoted to Running.`);
        } catch (err) {
          console.error("[K8S RESCHEDULER] Failed to promote pod:", err.message);
        } finally {
          await promoDb.end().catch(() => {});
        }
      }, 1500);

    } catch (err) {
      console.error("[K8S RESCHEDULER] Failed to reschedule replacement pod:", err.message);
    } finally {
      await backgroundDb.end().catch(() => {});
    }
  }, 1000);

  return { success: true, message: `Pod ${podId} is terminating. Replacement pod has been scheduled.` };
}

/**
 * Scales a Kubernetes deployment replica target up or down in the DB
 */
async function scaleDeployment(db, envId, deploymentName, targetReplicas) {
  // Get current pods count
  const { rows: currentPods } = await db.query(`
    SELECT * FROM public.infra_pods 
    WHERE environment_id = $1 AND deployment_name = $2
  `, [envId, deploymentName]);

  const diff = targetReplicas - currentPods.length;

  if (diff > 0) {
    // Scale Up
    for (let i = 0; i < diff; i++) {
      const podId = `pod-${deploymentName}-${envId}-${Math.random().toString(36).substring(2, 7)}`;
      await db.query(`
        INSERT INTO public.infra_pods (id, environment_id, namespace, deployment_name, status, cpu_usage, memory_usage_mb, restart_count)
        VALUES ($1, $2, 'default', $3, 'Running', 1.0, 55.0, 0)
      `, [podId, envId, deploymentName]);
    }
  } else if (diff < 0) {
    // Scale Down (remove trailing pods)
    const removeCount = Math.abs(diff);
    for (let i = 0; i < removeCount; i++) {
      const podId = currentPods[i].id;
      await db.query("DELETE FROM public.infra_pods WHERE id = $1", [podId]);
    }
  }

  // Update environments table stats
  const { rows: updatedPods } = await db.query("SELECT count(*)::int as total_pods FROM public.infra_pods WHERE environment_id = $1", [envId]);
  const newCount = updatedPods[0].total_pods;

  await db.query(`
    UPDATE public.infra_environments
    SET pods_target = $1, pods_running = $2, updated_at = now()
    WHERE id = $3
  `, [newCount, newCount, envId]);

  // Log audit
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['DeploymentScaled', `Scaled deployment '${deploymentName}' to ${targetReplicas} replicas in environment '${envId}'.`]).catch(() => {});

  return { success: true, newPodCount: newCount };
}

/**
 * Triggers a simulated rolling / canary deployment rollout
 */
async function triggerDeployment(db, envId, version, strategy) {
  // 1. Insert In Progress deployment record
  const commitRef = `commit-${crypto.randomBytes(3).toString('hex')}`;
  const { rows } = await db.query(`
    INSERT INTO public.infra_deployments (environment_id, version, strategy, status, progress, commit_ref)
    VALUES ($1, $2, $3, 'In Progress', 0, $4)
    RETURNING *
  `, [envId, version, strategy, commitRef]);

  const deployment = rows[0];

  // 2. Perform rolling updates asynchronously in the background
  let currentProgress = 0;
  const intervalId = setInterval(async () => {
    currentProgress += 20;
    const backgroundDb = new (db.constructor)(db.connectionParameters);
    try {
      await backgroundDb.connect();
      if (currentProgress >= 100) {
        clearInterval(intervalId);
        // Mark Completed and update active version of environment
        await backgroundDb.query(`
          UPDATE public.infra_deployments
          SET status = 'Completed', progress = 100, completed_at = now()
          WHERE id = $1
        `, [deployment.id]);

        await backgroundDb.query(`
          UPDATE public.infra_environments
          SET active_version = $1, updated_at = now()
          WHERE id = $2
        `, [version, envId]);

        // Audit Log
        await backgroundDb.query(`
          INSERT INTO public.infra_audit_logs (action, details)
          VALUES ($1, $2)
        `, ['DeploymentCompleted', `Rollout version ${version} via strategy ${strategy} completed for ${envId}.`]).catch(() => {});

        console.log(`[DEVOPS ROLLOUT] Version ${version} fully deployed to environment ${envId}.`);
      } else {
        // Increment progress
        await backgroundDb.query(`
          UPDATE public.infra_deployments
          SET progress = $1
          WHERE id = $2
        `, [currentProgress, deployment.id]);
        console.log(`[DEVOPS ROLLOUT] Version ${version} rollout progress in environment ${envId}: ${currentProgress}%`);
      }
    } catch (err) {
      clearInterval(intervalId);
      console.error("[DEVOPS ROLLOUT] Error updating progressive rollout:", err.message);
    } finally {
      await backgroundDb.end().catch(() => {});
    }
  }, 800); // Rollout finishes in 4.0 seconds total

  return deployment;
}

/**
 * Rotates a credentials secret, incrementing its version
 */
async function rotateSecret(db, envId, keyName) {
  const { rows } = await db.query(`
    UPDATE public.infra_secrets
    SET version = version + 1, last_rotated = now()
    WHERE environment_id = $1 AND key_name = $2
    RETURNING *
  `, [envId, keyName]);

  if (rows.length === 0) throw new Error(`Secret key '${keyName}' not found in environment '${envId}'.`);

  // Log to audit
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['SecretRotated', `Rotated secret credentials key: '${keyName}' (New Version: v${rows[0].version}) in environment '${envId}'.`]).catch(() => {});

  return rows[0];
}

/**
 * Proposes a new environment variable or updates an existing one
 */
async function proposeEnvVar(db, envId, key, value, isSecret) {
  const { rows } = await db.query(`
    INSERT INTO public.infra_env_vars (environment_id, var_key, var_value_encrypted, is_secret, approval_status, updated_at)
    VALUES ($1, $2, $3, $4, 'Approved', now())
    ON CONFLICT (environment_id, var_key) DO UPDATE
    SET var_value_encrypted = EXCLUDED.var_value_encrypted, is_secret = EXCLUDED.is_secret, updated_at = now()
    RETURNING *
  `, [envId, key, value, isSecret]);

  // Log audit
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['EnvVarUpdated', `Configured environment variable: '${key}' in environment '${envId}'.`]).catch(() => {});

  return rows[0];
}

/**
 * Triggers a manual database backup snapshot
 */
async function triggerBackup(db) {
  const backupName = `db_backup_${Date.now()}_snapshot.sql`;
  const sizeMb = parseFloat((12.5 + Math.random() * 8.0).toFixed(2));

  const { rows } = await db.query(`
    INSERT INTO public.infra_db_backups (backup_name, size_mb, status, created_at)
    VALUES ($1, $2, 'Completed', now())
    RETURNING *
  `, [backupName, sizeMb]);

  // Audit
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['DatabaseBackupCreated', `Created manual database backup snapshot: '${backupName}' (Size: ${sizeMb} MB).`]).catch(() => {});

  return rows[0];
}

/**
 * Runs a cron/scheduler job on-demand
 */
async function runSchedulerJobNow(db, jobId) {
  const { rows } = await db.query("SELECT * FROM public.infra_scheduler_jobs WHERE id = $1", [jobId]);
  if (rows.length === 0) throw new Error("Scheduler job not found: " + jobId);

  await db.query(`
    UPDATE public.infra_scheduler_jobs
    SET last_run = now(), status = 'Idle', failure_count = 0
    WHERE id = $1
  `, [jobId]);

  // Log audit
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['SchedulerJobExecuted', `Triggered manual execution of cron task: '${jobId}'.`]).catch(() => {});

  return { success: true, lastRun: new Date() };
}

/**
 * Invalidates and flushes the specified cache registry
 */
async function flushCachePool(db, cacheType) {
  // Purge AI prompt cache from public.ai_caches if cacheType is 'prompt'
  if (cacheType === 'prompt' || cacheType === 'all') {
    await db.query("DELETE FROM public.ai_caches").catch(() => {});
  }

  // Audit log
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['CacheFlushed', `Flushed and invalidated cache pool: '${cacheType}'.`]).catch(() => {});

  return { success: true, message: `Cache pool '${cacheType}' invalidated.` };
}

/**
 * Triggers simulated DB vacuum and reindexing optimization
 */
async function optimizeDatabase(db) {
  // Audit log
  await db.query(`
    INSERT INTO public.infra_audit_logs (action, details)
    VALUES ($1, $2)
  `, ['DatabaseOptimized', `Executed VACUUM ANALYZE and REINDEX DATABASE operations for postgres performance optimization.`]).catch(() => {});

  return { success: true, message: "Database vacuum & reindexing completed." };
}

module.exports = {
  getEnvironments,
  getPods,
  deletePod,
  scaleDeployment,
  triggerDeployment,
  rotateSecret,
  proposeEnvVar,
  triggerBackup,
  runSchedulerJobNow,
  flushCachePool,
  optimizeDatabase
};
