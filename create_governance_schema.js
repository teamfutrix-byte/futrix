const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Governance Engine DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create gov_modules
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_modules (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        owner VARCHAR NOT NULL,
        maintainer VARCHAR NOT NULL,
        version VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        dependencies TEXT,
        criticality VARCHAR NOT NULL,
        risk_level VARCHAR NOT NULL,
        documentation_link VARCHAR,
        health_endpoint VARCHAR,
        api_version VARCHAR,
        compliance_status VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'gov_modules' created.");

    // 2. Create gov_services
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_services (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        health_endpoint VARCHAR,
        metrics_endpoint VARCHAR,
        active_version VARCHAR NOT NULL,
        owner VARCHAR NOT NULL,
        dependencies TEXT,
        recovery_runbook TEXT
      )
    `);
    console.log("- Table 'gov_services' created.");

    // 3. Create gov_api_policies
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_api_policies (
        endpoint VARCHAR PRIMARY KEY,
        rate_limit_rpm INT NOT NULL,
        auth_required BOOLEAN NOT NULL DEFAULT TRUE,
        val_request_schema TEXT,
        val_response_schema TEXT,
        req_signing_required BOOLEAN NOT NULL DEFAULT FALSE,
        log_level VARCHAR NOT NULL DEFAULT 'INFO'
      )
    `);
    console.log("- Table 'gov_api_policies' created.");

    // 4. Create gov_data_objects
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_data_objects (
        table_name VARCHAR PRIMARY KEY,
        owner VARCHAR NOT NULL,
        purpose VARCHAR NOT NULL,
        retention_policy_days INT NOT NULL,
        encryption_policy VARCHAR NOT NULL,
        access_policy VARCHAR NOT NULL,
        classification_level VARCHAR NOT NULL,
        sensitivity VARCHAR NOT NULL,
        compliance_tags VARCHAR
      )
    `);
    console.log("- Table 'gov_data_objects' created.");

    // 5. Create gov_change_management
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_change_management (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id VARCHAR NOT NULL,
        proposed_change TEXT NOT NULL,
        draft_by VARCHAR NOT NULL,
        review_status VARCHAR NOT NULL DEFAULT 'Draft',
        approved_by VARCHAR,
        testing_evidence TEXT,
        deployment_plan TEXT,
        status VARCHAR NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'gov_change_management' created.");

    // 6. Create gov_releases
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_releases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version VARCHAR NOT NULL,
        release_notes TEXT,
        approvals TEXT,
        deployment_plan TEXT,
        rollback_plan TEXT,
        risk_score INT,
        known_issues TEXT,
        owner VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'gov_releases' created.");

    // 7. Create gov_disaster_recovery
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_disaster_recovery (
        system_key VARCHAR PRIMARY KEY,
        active_cloud VARCHAR NOT NULL,
        active_region VARCHAR NOT NULL,
        db_replica_status VARCHAR NOT NULL,
        rto_seconds NUMERIC NOT NULL,
        rpo_seconds NUMERIC NOT NULL,
        last_failover_test TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'gov_disaster_recovery' created.");

    // 8. Create gov_audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gov_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        target VARCHAR NOT NULL,
        ip_address VARCHAR NOT NULL,
        device VARCHAR NOT NULL,
        environment VARCHAR NOT NULL,
        result VARCHAR NOT NULL,
        correlation_id VARCHAR,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'gov_audit_logs' created.");

    // 9. Drop and recreate triggers/functions
    await client.query("DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON public.gov_audit_logs");
    await client.query("DROP FUNCTION IF EXISTS prevent_audit_log_modification");

    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'FUTRIX SECURITY PROTOCOL: Deletion or modification of governance audit logs is strictly prohibited.';
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      CREATE TRIGGER trg_prevent_audit_log_modification
      BEFORE UPDATE OR DELETE ON public.gov_audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification()
    `);
    console.log("- Attached immutability security trigger to 'gov_audit_logs'.");

    // 10. Seed Default Governance Parameters
    console.log("Seeding default governance metrics and policies...");

    // Seed Modules
    await client.query(`
      INSERT INTO public.gov_modules (id, name, owner, maintainer, version, status, dependencies, criticality, risk_level, documentation_link, health_endpoint, api_version, compliance_status)
      VALUES 
        ('auth', 'Central Authentication', 'Security CISO', 'Auth Team', 'v1.4.2', 'Active', 'None', 'Critical', 'Low', 'https://docs.futrix.app/auth', '/api/auth/health', 'v1', 'Compliant'),
        ('ai-gateway', 'AI Control Center Gateway', 'Chief AI Architect', 'AI Team', 'v2.1.0', 'Active', 'auth', 'Critical', 'Medium', 'https://docs.futrix.app/ai-gateway', '/api/ai/health', 'v2', 'Compliant'),
        ('sre-health', 'System Health & Observability', 'Principal SRE', 'Ops Team', 'v3.0.1', 'Active', 'None', 'High', 'Low', 'https://docs.futrix.app/sre-health', '/api/health/status', 'v1', 'Compliant'),
        ('devops', 'Infrastructure Management', 'DevOps Architect', 'Ops Team', 'v3.1.2', 'Active', 'None', 'Critical', 'High', 'https://docs.futrix.app/devops', '/api/infra/environments', 'v1', 'Compliant')
      ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, status = EXCLUDED.status;
    `);

    // Seed Services
    await client.query(`
      INSERT INTO public.gov_services (id, name, type, health_endpoint, metrics_endpoint, active_version, owner, dependencies, recovery_runbook)
      VALUES 
        ('k8s-api', 'Kubernetes Cluster Core', 'Microservice', '/api/infra/environments', '/api/infra/metrics', 'v3.1.2', 'DevOps Lead', 'None', 'Scale pod replicas and trigger automated rollouts.'),
        ('ai-router', 'AI Completions Router', 'Microservice', '/api/ai/health', '/api/ai/metrics', 'v2.1.0', 'AI Systems Lead', 'auth', 'Rotate primary keys and fall back to low latency providers.')
      ON CONFLICT (id) DO UPDATE SET active_version = EXCLUDED.active_version;
    `);

    // Seed API Policies
    await client.query(`
      INSERT INTO public.gov_api_policies (endpoint, rate_limit_rpm, auth_required, val_request_schema, val_response_schema, req_signing_required, log_level)
      VALUES
        ('/api/ai/complete-v2', 100, TRUE, '{"type":"object","properties":{"prompt":{"type":"string"}},"required":["prompt"]}', '{"type":"object"}', FALSE, 'INFO'),
        ('/api/infra/pods/delete', 10, TRUE, '{"type":"object","properties":{"podId":{"type":"string"}},"required":["podId"]}', '{"type":"object"}', TRUE, 'WARN')
      ON CONFLICT (endpoint) DO UPDATE SET rate_limit_rpm = EXCLUDED.rate_limit_rpm;
    `);

    // Seed Data Governance
    await client.query(`
      INSERT INTO public.gov_data_objects (table_name, owner, purpose, retention_policy_days, encryption_policy, access_policy, classification_level, sensitivity, compliance_tags)
      VALUES
        ('users', 'Security Team', 'User logins and profiles credentials', 3650, 'AES-256 at Rest', 'Strict RBAC / Super Admin Override', 'Confidential', 'Highly Sensitive', 'GDPR, DPDP'),
        ('ai_logs', 'AI Ops Lead', 'Records queries, tokens cost, and provider response text', 90, 'Encrypted Columns', 'Internal Only', 'Internal', 'Medium Sensitivity', 'SOC2')
      ON CONFLICT (table_name) DO UPDATE SET retention_policy_days = EXCLUDED.retention_policy_days;
    `);

    // Seed DR
    await client.query(`
      INSERT INTO public.gov_disaster_recovery (system_key, active_cloud, active_region, db_replica_status, rto_seconds, rpo_seconds)
      VALUES
        ('main-cluster', 'GCP', 'us-central1', 'Healthy Sync', 0.85, 4.20)
      ON CONFLICT (system_key) DO UPDATE SET active_cloud = EXCLUDED.active_cloud;
    `);

    console.log("Governance database tables created and seeded successfully.");

  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
