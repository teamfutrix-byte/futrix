const { Client } = require('pg');
const recoveryManager = require('./services/recoveryManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE DATA PLATFORM & DR TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 0. Cleanup old failovers and backups
    console.log("Cleaning up old test recovery states...");
    await db.query("DELETE FROM public.infra_db_backups WHERE backup_name LIKE 'db_backup_%'");
    await db.query("DELETE FROM public.infra_dr_failover_history WHERE primary_node = 'postgres_prod'");
    
    // Restore default node status
    await db.query(`
      UPDATE public.infra_database_registry 
      SET status = 'Online', primary_node = 'db-primary-01.c.teamfutrix.internal', health_score = 100
      WHERE id = 'postgres_prod'
    `);


    // 1. Assert Database stats parser
    console.log("\n1. Testing active database stats parser...");
    const stats = await recoveryManager.getDatabaseStats(db);
    console.log(`- Connection Count: ${stats.activeConnections}`);
    console.log(`- Active Table Locks: ${stats.tableLocks}`);
    console.log(`- Storage Size: ${stats.dbSizeStr} (${stats.dbSizeBytes} bytes)`);

    if (stats.activeConnections <= 0 || !stats.dbSizeStr) {
      throw new Error("SRE Telemetry failed to fetch valid PostgreSQL metrics.");
    }
    console.log("✓ Active database stats verified.");


    // 2. Assert Backup Checksum Compiler
    console.log("\n2. Testing compressed and encrypted backup snapshot compiler...");
    const backup = await recoveryManager.triggerBackupSnapshot(db, {
      backupType: 'Differential',
      compression: 'gzip',
      encryption: 'AES-256'
    });

    console.log(`- Created Backup: "${backup.backup_name}" (Size: ${backup.size_mb} MB)`);
    console.log(`- Encryption status: "${backup.encryption_status}"`);
    console.log(`- Calculated Checksum Hash: ${backup.checksum_hash}`);

    if (backup.checksum_hash.length !== 64 || backup.status !== 'Completed') {
      throw new Error("SRE backup compiler failed to create valid secure metadata archive.");
    }
    console.log("✓ Backup snapshot compilation verified.");


    // 3. Assert PITR Restore consistency checks
    console.log("\n3. Testing Point-in-Time Recovery consistency validation...");
    const restoreResult = await recoveryManager.executePointInTimeRestore(db, {
      backupId: backup.id,
      targetTime: new Date().toISOString()
    });

    console.log(`- PITR dry-run checksum match: ${restoreResult.validationReport.checksum}`);
    console.log(`- Foreign Keys check: ${restoreResult.validationReport.foreignKeys}`);
    console.log(`- Index Sequences status: ${restoreResult.validationReport.sequences}`);
    console.log(`- Orphans Detected: ${restoreResult.validationReport.orphansDetected}`);
    console.log(`- Validation Status: ${restoreResult.validationReport.status}`);

    if (restoreResult.validationReport.status !== 'VALID') {
      throw new Error("PITR Integrity verification report returned failures or degraded status.");
    }
    console.log("✓ PITR Restore validations verified.");


    // 4. Assert SRE Disaster Recovery Geo-Failover Promotions
    console.log("\n4. Testing SRE replica node promotion and Geo-Failover...");
    
    const failoverResult = await recoveryManager.triggerDisasterRecoveryFailover(db, {
      primaryNodeId: 'postgres_prod',
      targetReplicaId: 'db-replica-01.c.teamfutrix.internal',
      reason: 'E2E Testing simulated aws-east outage'
    });

    console.log(`- Failover promotion status: ${failoverResult.success ? 'Success' : 'Fail'}`);
    console.log(`- Promo details: "${failoverResult.message}"`);

    // Verify registry node status
    const { rows: registryRows } = await db.query(
      "SELECT status, primary_node, health_score FROM public.infra_database_registry WHERE id = 'postgres_prod'"
    );
    console.log(`- Prod database cluster primary node: "${registryRows[0].primary_node}"`);
    console.log(`- Prod database cluster status: "${registryRows[0].status}"`);
    
    if (registryRows[0].primary_node !== 'db-replica-01.c.teamfutrix.internal') {
      throw new Error("Outage node promotion failure: Master pointer is not updated to replica.");
    }
    console.log("✓ SRE DR Geo-Failover promotions verified.");


    console.log("\n=== ALL DATA PLATFORM & DR TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ DATA PLATFORM TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Restore default node status
    await db.query(`
      UPDATE public.infra_database_registry 
      SET status = 'Online', primary_node = 'db-primary-01.c.teamfutrix.internal', health_score = 100
      WHERE id = 'postgres_prod'
    `);
    await db.query("DELETE FROM public.infra_db_backups WHERE backup_name LIKE 'db_backup_%'");
    await db.query("DELETE FROM public.infra_dr_failover_history WHERE primary_node = 'postgres_prod'");
    await db.end();
  }
}

runTests();
