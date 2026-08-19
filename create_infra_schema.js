const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("=== RUNNING ENTERPRISE INFRASTRUCTURE SCHEMA MIGRATION ===");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create environments table
    console.log("Creating public.infra_environments table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_environments (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        cloud_provider VARCHAR NOT NULL,
        region VARCHAR NOT NULL,
        active_version VARCHAR NOT NULL,
        pods_target INTEGER DEFAULT 10,
        pods_running INTEGER DEFAULT 10,
        cpu_utilization NUMERIC DEFAULT 15.2,
        memory_utilization_mb NUMERIC DEFAULT 512.0,
        network_traffic_gb NUMERIC DEFAULT 4.2,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 2. Create pods table
    console.log("Creating public.infra_pods table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_pods (
        id VARCHAR PRIMARY KEY,
        environment_id VARCHAR REFERENCES public.infra_environments(id) ON DELETE CASCADE,
        namespace VARCHAR NOT NULL,
        deployment_name VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Running',
        cpu_usage NUMERIC DEFAULT 1.0,
        memory_usage_mb NUMERIC DEFAULT 45.0,
        restart_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 3. Create deployments table
    console.log("Creating public.infra_deployments table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_deployments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        environment_id VARCHAR REFERENCES public.infra_environments(id) ON DELETE CASCADE,
        version VARCHAR NOT NULL,
        strategy VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'In Progress',
        progress INTEGER DEFAULT 0,
        commit_ref VARCHAR,
        created_at TIMESTAMPTZ DEFAULT now(),
        completed_at TIMESTAMPTZ
      )
    `);

    // 4. Create secrets table
    console.log("Creating public.infra_secrets table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_secrets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        environment_id VARCHAR REFERENCES public.infra_environments(id) ON DELETE CASCADE,
        key_name VARCHAR NOT NULL,
        description TEXT,
        last_rotated TIMESTAMPTZ DEFAULT now(),
        version INTEGER DEFAULT 1,
        CONSTRAINT unique_env_secret UNIQUE(environment_id, key_name)
      )
    `);

    // 5. Create env_vars table
    console.log("Creating public.infra_env_vars table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_env_vars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        environment_id VARCHAR REFERENCES public.infra_environments(id) ON DELETE CASCADE,
        var_key VARCHAR NOT NULL,
        var_value_encrypted TEXT NOT NULL,
        is_secret BOOLEAN DEFAULT false,
        approval_status VARCHAR NOT NULL DEFAULT 'Approved',
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT unique_env_var UNIQUE(environment_id, var_key)
      )
    `);

    // 6. Create scheduler_jobs table
    console.log("Creating public.infra_scheduler_jobs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_scheduler_jobs (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        cron_expression VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Idle',
        last_run TIMESTAMPTZ,
        next_run TIMESTAMPTZ,
        failure_count INTEGER DEFAULT 0
      )
    `);

    // 7. Create workers table
    console.log("Creating public.infra_workers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_workers (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        queue_allocated VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Active',
        cpu_usage NUMERIC DEFAULT 0.5,
        memory_usage_mb NUMERIC DEFAULT 32.0,
        restart_count INTEGER DEFAULT 0
      )
    `);

    // 8. Create db_backups table
    console.log("Creating public.infra_db_backups table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_db_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        backup_name VARCHAR NOT NULL,
        size_mb NUMERIC DEFAULT 0.0,
        status VARCHAR NOT NULL DEFAULT 'Completed',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 9. Create audit_logs table
    console.log("Creating public.infra_audit_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action VARCHAR NOT NULL,
        details TEXT,
        timestamp TIMESTAMPTZ DEFAULT now()
      )
    `);

    // --- SEED SEED DATA ---
    console.log("Seeding environments...");
    const envs = [
      { id: 'dev', name: 'Development Sandbox', provider: 'AWS', region: 'us-east-1', version: 'v3.2.0-beta' },
      { id: 'staging', name: 'Staging Environment', provider: 'AWS', region: 'eu-west-1', version: 'v3.1.5' },
      { id: 'production', name: 'Production Grid', provider: 'GCP', region: 'us-central1', version: 'v3.1.2' },
      { id: 'sandbox', name: 'Candidate Testing Sandbox', provider: 'DigitalOcean', region: 'nyc3', version: 'v3.1.2' }
    ];

    for (const env of envs) {
      await client.query(`
        INSERT INTO public.infra_environments (id, name, cloud_provider, region, active_version, pods_target, pods_running, cpu_utilization, memory_utilization_mb, network_traffic_gb)
        VALUES ($1, $2, $3, $4, $5, 12, 12, 28.5, 2048.0, 18.4)
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, cloud_provider = EXCLUDED.cloud_provider, region = EXCLUDED.region, active_version = EXCLUDED.active_version
      `, [env.id, env.name, env.provider, env.region, env.version]);
    }

    console.log("Seeding Kubernetes pods...");
    const deployments = ['auth-service', 'user-service', 'student-service', 'teacher-service', 'ai-gateway', 'prompt-engine', 'payment-service', 'gamification-service'];
    
    // Seed pods for Dev, Staging, and Production
    for (const envId of ['dev', 'staging', 'production']) {
      for (const dep of deployments) {
        const podId = `pod-${dep}-${envId}-${Math.random().toString(36).substring(2, 7)}`;
        await client.query(`
          INSERT INTO public.infra_pods (id, environment_id, namespace, deployment_name, status, cpu_usage, memory_usage_mb, restart_count)
          VALUES ($1, $2, 'default', $3, 'Running', 1.8, 62.4, 0)
          ON CONFLICT (id) DO NOTHING
        `, [podId, envId, dep]);
      }
    }

    console.log("Seeding default Secrets...");
    const defaultSecrets = [
      { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase bypass role permissions credentials key' },
      { key: 'GEMINI_PRIMARY_API_KEY', desc: 'Main Google AI Platform access key token' },
      { key: 'JWT_ACCESS_SECRET_TOKEN', desc: 'JSON Web Token digital signing passphrase' },
      { key: 'STRIPE_LIVE_WEBHOOK_SECRET', desc: 'Secure payments gate event signing verification key' }
    ];

    for (const envId of ['dev', 'staging', 'production', 'sandbox']) {
      for (const sec of defaultSecrets) {
        await client.query(`
          INSERT INTO public.infra_secrets (environment_id, key_name, description, version, last_rotated)
          VALUES ($1, $2, $3, 1, now() - interval '5 days')
          ON CONFLICT (environment_id, key_name) DO NOTHING
        `, [envId, sec.key, sec.desc]);
      }
    }

    console.log("Seeding default Environment Variables...");
    const defaultEnvVars = [
      { key: 'PLATFORM_SSL_COMPLIANCE', val: 'true', is_sec: false },
      { key: 'AI_MAX_LATENCY_CAP_MS', val: '2000', is_sec: false },
      { key: 'GATEWAY_CACHE_COMPRESSION', val: 'gzip', is_sec: false }
    ];

    for (const envId of ['dev', 'staging', 'production', 'sandbox']) {
      for (const ev of defaultEnvVars) {
        await client.query(`
          INSERT INTO public.infra_env_vars (environment_id, var_key, var_value_encrypted, is_secret)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (environment_id, var_key) DO NOTHING
        `, [envId, ev.key, ev.val, ev.is_sec]);
      }
    }

    console.log("Seeding Scheduler jobs...");
    const cronJobs = [
      { id: 'db_nightly_backup', name: 'Platform Database Backup Snapshot', cron: '0 2 * * *' },
      { id: 'token_purger', name: 'Expired JWT Token Session Purger', cron: '*/30 * * * *' },
      { id: 'sla_aggregator', name: 'SRE SLA Availability Compliance Log', cron: '0 0 * * *' },
      { id: 'prompt_cache_purger', name: 'Expired AI Semantic Prompt Cache Purge', cron: '0 4 * * *' }
    ];

    for (const c of cronJobs) {
      await client.query(`
        INSERT INTO public.infra_scheduler_jobs (id, name, cron_expression, status, failure_count)
        VALUES ($1, $2, $3, 'Idle', 0)
        ON CONFLICT (id) DO NOTHING
      `, [c.id, c.name, c.cron]);
    }

    console.log("Seeding background Workers...");
    const workersList = [
      { id: 'worker-threads-01', name: 'Heavy Analytics Thread', q: 'heavy_tasks' },
      { id: 'worker-threads-02', name: 'Multi-Channel Email Dispatcher', q: 'email_queue' },
      { id: 'worker-threads-03', name: 'Stripe Payments Failure Retry', q: 'payments_retry' }
    ];

    for (const w of workersList) {
      await client.query(`
        INSERT INTO public.infra_workers (id, name, queue_allocated, status, cpu_usage, memory_usage_mb, restart_count)
        VALUES ($1, $2, $3, 'Active', 0.8, 48.0, 0)
        ON CONFLICT (id) DO NOTHING
      `, [w.id, w.name, w.q]);
    }

    console.log("=== ENTERPRISE INFRASTRUCTURE SCHEMA MIGRATION COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
