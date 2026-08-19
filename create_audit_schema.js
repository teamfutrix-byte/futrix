const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Audit & Compliance DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Extend public.gov_audit_logs with additional compliance audit columns
    console.log("- Extending public.gov_audit_logs table schema...");
    await client.query(`
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'Informational';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(100) DEFAULT 'governance';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS submodule VARCHAR(100) DEFAULT 'core';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS role VARCHAR(50);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS location VARCHAR(150);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(150);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS operating_system VARCHAR(150);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(255);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(10);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(150);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS status_code INT DEFAULT 200;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0;
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS source_service VARCHAR(100) DEFAULT 'governance';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS digital_signature VARCHAR(255);
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(50) DEFAULT 'Permanent';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS archive_status VARCHAR(50) DEFAULT 'Active';
      ALTER TABLE public.gov_audit_logs ADD COLUMN IF NOT EXISTS immutable_hash VARCHAR(255);
    `);
    console.log("✓ gov_audit_logs columns extended.");

    // 2. Create compliance_checks table
    console.log("- Creating public.compliance_checks table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.compliance_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        policy_name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Compliant',
        last_checked_at TIMESTAMP DEFAULT now(),
        score_impact INT NOT NULL DEFAULT 10,
        description TEXT,
        remediation_steps TEXT
      );
    `);
    console.log("✓ compliance_checks table created.");

    // 3. Create legal_holds table
    console.log("- Creating public.legal_holds table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.legal_holds (
        id VARCHAR PRIMARY KEY,
        case_id VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        approved_by VARCHAR(100) NOT NULL,
        expiry_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✓ legal_holds table created.");

    // 4. Re-enforce Immutability Trigger on gov_audit_logs
    console.log("- Re-enforcing security trigger on gov_audit_logs...");
    await client.query("DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON public.gov_audit_logs");
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
    console.log("✓ Immutability trigger re-bound.");

    // 5. Seed Compliance validation checks
    console.log("Seeding default compliance checkers...");
    await client.query(`
      INSERT INTO public.compliance_checks (policy_name, category, score_impact, description, remediation_steps, status)
      VALUES
        ('Password Complexity Rule Check', 'authentication', 15, 'Requires minimum 10 characters, capital letter, digit, and symbol.', 'Verify user registration logic has regex validators.', 'Compliant'),
        ('Database Encryption-at-Rest Check', 'data_protection', 20, 'Asserts that pg_crypto or Supabase TDE keys are active.', 'Verify Supabase dashboard storage encryption policy flags.', 'Compliant'),
        ('MFA Governance Check', 'authentication', 15, 'Tracks percentage of administrative accounts with MFA active.', 'Require admin dashboard roles to bind TOTP key triggers.', 'Compliant'),
        ('Telemetry Audit Cover Check', 'data_protection', 15, 'Ensures critical events trigger immutable hash logs.', 'Assert auditManager.logAuditEvent is invoked in all critical workflows.', 'Compliant'),
        ('Secrets Rotation Interval Check', 'infrastructure', 10, 'Requires AWS / Supabase environment keys rotation every 90 days.', 'Configure DevOps rotation trigger cron inside key vault.', 'Compliant'),
        ('AI Prompt Moderation Scan Check', 'ai', 15, 'Ensures safety models scan inputs before completions rendering.', 'Verify aiOrchestrator wraps calls with toxicity filters.', 'Compliant'),
        ('PCI-DSS Gateway Compliance Check', 'payment', 10, 'Asserts that checkout forms do not store raw card numbers.', 'Confirm Stripe/Razorpay elements render card details outside local servers.', 'Compliant')
      ON CONFLICT (policy_name) DO UPDATE SET score_impact = EXCLUDED.score_impact;
    `);

    console.log("Seeding completed. Audit schema migrations finished.");

  } catch (err) {
    console.error("Audit Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
