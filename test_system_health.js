const { Client } = require('pg');
const healthMonitor = require('./services/healthMonitor');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING SRE SYSTEM HEALTH & INCIDENT MANAGEMENT E2E TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 0. Cleanup prior test states in SRE tables
    console.log("0. Cleaning up prior test alerts, incidents, and recovery logs...");
    await db.query("DELETE FROM public.alerts WHERE service_id = 'test_service' OR service_id = 'payment_service'");
    await db.query("DELETE FROM public.incidents WHERE title LIKE '%payment_service%' OR title LIKE '%test_service%'");
    await db.query("DELETE FROM public.recovery_logs WHERE service_id = 'payment_service' OR service_id = 'test_service'");
    await db.query("DELETE FROM public.sla_metrics WHERE recorded_date = CURRENT_DATE");

    // Make sure 'payment_service' exists in system_services and reset it to Healthy
    await db.query(`
      INSERT INTO public.system_services (id, name, status, cpu_usage, memory_usage_mb, latency_ms, error_count, request_count, restart_count)
      VALUES ('payment_service', 'payment_service', 'Healthy', 10.0, 50.0, 15, 0, 100, 0)
      ON CONFLICT (id) DO UPDATE SET status = 'Healthy', latency_ms = 15, cpu_usage = 10.0, restart_count = 0
    `);

    // 1. collectMetrics Telemetry Test
    console.log("\n1. Testing dynamic Host OS and Postgres pool metrics collection...");
    const metrics = await healthMonitor.collectMetrics(db);
    
    console.log(`- CPU Usage: ${metrics.os.cpuUsage}%`);
    console.log(`- RAM Allocation: ${metrics.os.memoryUsedMb} MB / ${metrics.os.memoryTotalMb} MB`);
    console.log(`- DB Active Connections: ${metrics.db.activeConnections}`);
    console.log(`- AI Gateway P50 Latency: ${metrics.aiGateway.p50} ms`);
    console.log(`- AI Gateway Cache Hit Rate: ${metrics.aiGateway.cacheHitRate}%`);

    if (typeof metrics.os.cpuUsage !== 'number' || isNaN(metrics.os.cpuUsage)) {
      throw new Error("Invalid CPU usage collected.");
    }
    if (typeof metrics.db.activeConnections !== 'number') {
      throw new Error("Invalid DB connection count collected.");
    }
    console.log("✓ Dynamic metric collection assertions passed.");

    // 2. Threshold Violation Alerting and Incident creation Test
    console.log("\n2. Testing threshold violation triggering alert, incident Kanban entry, and SRE auto-recovery execution...");
    
    // Simulate a service failure (Critical status + high latency)
    await db.query(`
      UPDATE public.system_services
      SET status = 'Critical', latency_ms = 2800, cpu_usage = 95.0
      WHERE id = 'payment_service'
    `);

    console.log("- Triggering service scan...");
    await healthMonitor.scanAndEvaluateServices(db);

    // Verify Alert was created
    const { rows: alerts } = await db.query("SELECT * FROM public.alerts WHERE service_id = 'payment_service'");
    if (alerts.length === 0) {
      throw new Error("Expected threshold alert for payment_service was not filed.");
    }
    console.log(`✓ Active Alert detected: "${alerts[0].message}"`);

    // Verify Incident was filed and set to Resolved by SRE auto-recovery
    const { rows: incidents } = await db.query("SELECT * FROM public.incidents WHERE title LIKE '%payment_service%'");
    if (incidents.length === 0) {
      throw new Error("Expected incident ticket for payment_service was not filed.");
    }
    console.log(`✓ Incident ticket filed. Status: ${incidents[0].status} (Title: ${incidents[0].title})`);

    // Verify Auto-Recovery log was written
    const { rows: recoveryLogs } = await db.query("SELECT * FROM public.recovery_logs WHERE service_id = 'payment_service'");
    if (recoveryLogs.length === 0) {
      throw new Error("Expected SRE auto-recovery log record not found.");
    }
    console.log(`✓ Auto-recovery run logged: "${recoveryLogs[0].action_taken}" (Success: ${recoveryLogs[0].success})`);

    // Verify service restored to Healthy
    const { rows: serviceState } = await db.query("SELECT status, restart_count FROM public.system_services WHERE id = 'payment_service'");
    if (serviceState[0].status !== 'Healthy' || serviceState[0].restart_count !== 1) {
      throw new Error(`Expected payment_service status to be 'Healthy' and restart_count = 1. Got status=${serviceState[0].status}, restarts=${serviceState[0].restart_count}`);
    }
    console.log(`✓ Service auto-healed. New status: ${serviceState[0].status}, restart_count: ${serviceState[0].restart_count}`);

    // 3. Manual Administrator Recovery Action Test
    console.log("\n3. Testing manual admin recovery restart trigger...");
    
    // Simulate manual recovery invocation
    const manualResult = await healthMonitor.triggerManualRecovery(db, 'payment_service');
    if (!manualResult.success) {
      throw new Error("Manual SRE recovery action failed.");
    }
    
    const { rows: manualServiceState } = await db.query("SELECT status, restart_count FROM public.system_services WHERE id = 'payment_service'");
    if (manualServiceState[0].restart_count !== 2) {
      throw new Error(`Expected service restarts incremented to 2. Got: ${manualServiceState[0].restart_count}`);
    }
    console.log(`✓ Manual restart triggered restart increment. Restarts: ${manualServiceState[0].restart_count}`);

    // 4. SLA availability compliance aggregation Test
    console.log("\n4. Testing SLA daily availability compliance calculation...");
    await healthMonitor.updateSlaMetrics(db);

    const { rows: slaRecords } = await db.query("SELECT * FROM public.sla_metrics WHERE recorded_date = CURRENT_DATE");
    if (slaRecords.length === 0) {
      throw new Error("Expected SLA metrics compliance log entry for today was not created.");
    }
    console.log(`✓ SLA Log Entry Created. Uptime percentage: ${slaRecords[0].uptime_percentage}%, Compliant: ${slaRecords[0].sla_compliance}`);

    console.log("\n=== ALL SRE SYSTEM HEALTH & OBSERVABILITY INTEGRATION TESTS PASSED! ===");

  } catch (err) {
    console.error("\n❌ Test suite failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runTests();
