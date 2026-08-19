const { Client } = require('pg');
const infraManager = require('./services/infraManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE DEVOPS INFRASTRUCTURE & PLATFORM TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 1. Get environments and metrics
    console.log("\n1. Testing environments list and load telemetry retrieval...");
    const envs = await infraManager.getEnvironments(db);
    console.log(`- Retrieved ${envs.length} environments.`);
    if (envs.length === 0) throw new Error("No active environments returned from database.");
    console.log("✓ Environments telemetry verification passed.");

    // 2. Fetch pods for active environment
    console.log("\n2. Testing Kubernetes pods map retrieval for environment 'production'...");
    const pods = await infraManager.getPods(db, 'production');
    console.log(`- Retrieved ${pods.length} containers in default namespace.`);
    if (pods.length === 0) throw new Error("No pods returned for production environment.");
    console.log("✓ Kubernetes pods mapping verification passed.");

    // 3. Test replica set scaling
    console.log("\n3. Testing deployment target replica scaling (auth-service scale up to 4 replicas)...");
    const scaleUpResult = await infraManager.scaleDeployment(db, 'production', 'auth-service', 4);
    console.log(`- Scaling operation resolved. Active target pods count: ${scaleUpResult.newPodCount}`);
    
    // Assert 4 auth-service pods now exist in production env
    const { rows: scaledAuthPods } = await db.query(`
      SELECT count(*)::int as count FROM public.infra_pods
      WHERE environment_id = 'production' AND deployment_name = 'auth-service'
    `);
    console.log(`- Verified auth-service active pods: ${scaledAuthPods[0].count}`);
    if (scaledAuthPods[0].count !== 4) throw new Error(`Expected 4 replicas of auth-service, got ${scaledAuthPods[0].count}`);
    console.log("✓ Replica set scaling verification passed.");

    // 4. Test pod self-healing
    console.log("\n4. Testing Kubernetes pod self-healing reschedule simulation...");
    const targetPod = pods.find(p => p.deployment_name === 'user-service');
    if (!targetPod) throw new Error("No user-service pod found to test deletion.");

    console.log(`- Deleting pod container: ${targetPod.id}`);
    const deleteResult = await infraManager.deletePod(db, targetPod.id);
    console.log(`- Deletion result: ${deleteResult.message}`);

    // Verify status set to Terminating
    const { rows: termCheck } = await db.query("SELECT status FROM public.infra_pods WHERE id = $1", [targetPod.id]);
    console.log(`- Pod status in DB: ${termCheck[0] ? termCheck[0].status : 'Deleted'}`);
    if (termCheck.length > 0 && termCheck[0].status !== 'Terminating') {
      throw new Error(`Expected pod status to be Terminating, got ${termCheck[0].status}`);
    }

    // Wait 1.2 seconds for reschedule hook to clear old pod and spawn replacement in Pending status
    console.log("- Waiting 1.2s for K8s container rescheduling hook...");
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Verify replacement pod exists
    const { rows: replacementCheck } = await db.query(`
      SELECT id, status FROM public.infra_pods
      WHERE environment_id = 'production' AND deployment_name = 'user-service'
    `);
    console.log(`- Active replacement pods found: ${replacementCheck.map(p => `${p.id} (${p.status})`).join(', ')}`);
    const pendingReplacement = replacementCheck.find(p => p.status === 'Pending');
    if (!pendingReplacement) throw new Error("Expected replacement pod to be spawned in Pending status.");
    console.log("✓ Kubernetes pod self-healing reschedule verification passed.");

    // 5. Test progressive deployment rollouts
    console.log("\n5. Testing progressive canary rollout deployment (deploying v3.2.0 via Canary strategy)...");
    const rollout = await infraManager.triggerDeployment(db, 'production', 'v3.2.0', 'Canary');
    console.log(`- Deployment pipeline launched. ID: ${rollout.id} | Commit Ref: ${rollout.commit_ref}`);

    // Wait 1.6s to let background progress tick twice (should be around 40% progress)
    console.log("- Waiting 1.6s for progressive rollout ticks...");
    await new Promise(resolve => setTimeout(resolve, 1600));

    const { rows: progressCheck } = await db.query("SELECT progress, status FROM public.infra_deployments WHERE id = $1", [rollout.id]);
    console.log(`- Rollout status in DB: ${progressCheck[0].status} | Progress: ${progressCheck[0].progress}%`);
    if (progressCheck[0].progress === 0 || progressCheck[0].progress === 100) {
      throw new Error(`Expected progress to be running in-progress, got ${progressCheck[0].progress}%`);
    }

    // Wait 3.0s more to let deployment fully complete (100%)
    console.log("- Waiting 3.0s for rollout completion...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const { rows: completeCheck } = await db.query("SELECT progress, status FROM public.infra_deployments WHERE id = $1", [rollout.id]);
    console.log(`- Final rollout status: ${completeCheck[0].status} | Progress: ${completeCheck[0].progress}%`);
    if (completeCheck[0].status !== 'Completed' || completeCheck[0].progress !== 100) {
      throw new Error(`Expected deployment completed, got status: ${completeCheck[0].status}`);
    }

    // Verify active version in environments table has been updated
    const { rows: versionCheck } = await db.query("SELECT active_version FROM public.infra_environments WHERE id = 'production'");
    console.log(`- Environment active version: ${versionCheck[0].active_version}`);
    if (versionCheck[0].active_version !== 'v3.2.0') {
      throw new Error(`Expected active version to be updated to v3.2.0, got ${versionCheck[0].active_version}`);
    }
    console.log("✓ Progressive deployment rollout verification passed.");

    // 6. Test secrets vault rotation
    console.log("\n6. Testing credentials secrets rotation (GEMINI_PRIMARY_API_KEY)...");
    const { rows: origSecret } = await db.query("SELECT version FROM public.infra_secrets WHERE environment_id = 'production' AND key_name = 'GEMINI_PRIMARY_API_KEY'");
    const origVersion = origCheck = origSecret[0].version;

    const rotatedSecret = await infraManager.rotateSecret(db, 'production', 'GEMINI_PRIMARY_API_KEY');
    console.log(`- Rotated secret. New version: v${rotatedSecret.version} | Last Rotated: ${rotatedSecret.last_rotated}`);
    if (rotatedSecret.version !== origVersion + 1) {
      throw new Error(`Expected version to increment from ${origVersion} to ${origVersion + 1}, got ${rotatedSecret.version}`);
    }
    console.log("✓ Credentials secrets vault rotation verification passed.");

    // 7. Test environment variables configuration
    console.log("\n7. Testing environment variables proposal and write-back (setting TEMP_TEST_CONFIG = 'enabled')...");
    const envVar = await infraManager.proposeEnvVar(db, 'production', 'TEMP_TEST_CONFIG', 'enabled', false);
    console.log(`- Proposed config result. Key: ${envVar.var_key} | Value: ${envVar.var_value_encrypted}`);
    if (envVar.var_key !== 'TEMP_TEST_CONFIG' || envVar.var_value_encrypted !== 'enabled') {
      throw new Error("Failed to write proposed configuration variables.");
    }
    console.log("✓ Environment variables configuration verification passed.");

    // 8. Test manual cron scheduler trigger
    console.log("\n8. Testing scheduler manual execution trigger (token_purger)...");
    const jobResult = await infraManager.runSchedulerJobNow(db, 'token_purger');
    console.log(`- Scheduler trigger resolved. Last Run: ${jobResult.lastRun}`);
    
    const { rows: jobCheck } = await db.query("SELECT last_run FROM public.infra_scheduler_jobs WHERE id = 'token_purger'");
    if (!jobCheck[0].last_run) throw new Error("Expected last_run timestamp to be updated on job.");
    console.log("✓ Scheduler manual job execution verification passed.");

    // 9. Test DB vacuum, backup generation, and cache flush
    console.log("\n9. Testing administrative vacuum database and system cache flushes...");
    const vacuumResult = await infraManager.optimizeDatabase(db);
    console.log(`- Vacuum operation logs: ${vacuumResult.message}`);
    
    const cacheResult = await infraManager.flushCachePool(db, 'prompt');
    console.log(`- Cache flush logs: ${cacheResult.message}`);

    const backupResult = await infraManager.triggerBackup(db);
    console.log(`- Backup snapshot generated: ${backupResult.backup_name} (Size: ${backupResult.size_mb} MB)`);

    const { rows: backupDbCheck } = await db.query("SELECT count(*)::int as count FROM public.infra_db_backups");
    console.log(`- Total backups entries recorded: ${backupDbCheck[0].count}`);
    if (backupDbCheck[0].count === 0) throw new Error("Database backup entry was not saved.");
    console.log("✓ Administrative tools verification passed.");

    console.log("\n=== ALL ENTERPRISE DEVOPS INFRASTRUCTURE & PLATFORM TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runTests();
