const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("=== RUNNING SYSTEM HEALTH SCHEMA MIGRATION ===");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create system_services registry table
    console.log("Creating public.system_services table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.system_services (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Healthy',
        cpu_usage NUMERIC DEFAULT 0.0,
        memory_usage_mb NUMERIC DEFAULT 0.0,
        request_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        restart_count INTEGER DEFAULT 0,
        last_heartbeat TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 2. Create incidents table
    console.log("Creating public.incidents table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Detected',
        affected_services TEXT[] NOT NULL DEFAULT '{}',
        root_cause TEXT,
        current_owner VARCHAR DEFAULT 'SRE On-Call',
        estimated_resolution_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 3. Create alerts table
    console.log("Creating public.alerts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id VARCHAR REFERENCES public.system_services(id) ON DELETE CASCADE,
        level VARCHAR NOT NULL,
        message TEXT NOT NULL,
        threshold_violated VARCHAR,
        suppressed BOOLEAN DEFAULT false,
        silenced_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 4. Create sla_metrics table
    console.log("Creating public.sla_metrics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sla_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recorded_date DATE NOT NULL UNIQUE,
        uptime_percentage NUMERIC NOT NULL DEFAULT 100.0,
        avg_latency_ms INTEGER DEFAULT 0,
        requests_total INTEGER DEFAULT 0,
        errors_total INTEGER DEFAULT 0,
        sla_compliance BOOLEAN DEFAULT true
      )
    `);

    // 5. Create maintenance_schedule table
    console.log("Creating public.maintenance_schedule table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        target_services TEXT[] NOT NULL DEFAULT '{}',
        status VARCHAR NOT NULL DEFAULT 'Scheduled',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        banner_message TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // 6. Create recovery_logs table
    console.log("Creating public.recovery_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.recovery_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id VARCHAR REFERENCES public.system_services(id) ON DELETE CASCADE,
        action_taken VARCHAR NOT NULL,
        success BOOLEAN NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Seed default microservices registry
    console.log("Seeding default microservices registry...");
    const services = [
      { id: 'auth_service', name: 'Authentication Service' },
      { id: 'user_service', name: 'User Management Service' },
      { id: 'student_service', name: 'Student Portal Engine' },
      { id: 'teacher_service', name: 'Teacher Control Panel' },
      { id: 'institute_service', name: 'Institute Operations Service' },
      { id: 'question_service', name: 'Mock Question Database' },
      { id: 'mock_test_service', name: 'Mock Test Simulator' },
      { id: 'leaderboard_service', name: 'Leaderboard & Analytics' },
      { id: 'gamification_service', name: 'Gamification Engine' },
      { id: 'xp_engine', name: 'XP & Rewards Engine' },
      { id: 'payment_service', name: 'Payment & Invoice Gateway' },
      { id: 'notification_service', name: 'Multi-Channel Notification Dispatcher' },
      { id: 'ai_gateway', name: 'FUTRIX Enterprise AI Gateway' },
      { id: 'prompt_engine', name: 'Prompt Version Controller' },
      { id: 'search_engine', name: 'UCSC Search & Discovery' },
      { id: 'reporting_service', name: 'Daily Reports Generator' }
    ];

    for (const s of services) {
      await client.query(`
        INSERT INTO public.system_services (id, name, status, cpu_usage, memory_usage_mb, request_count, error_count, latency_ms, restart_count)
        VALUES ($1, $2, 'Healthy', 1.2, 45.5, 0, 0, 8, 0)
        ON CONFLICT (id) DO NOTHING
      `, [s.id, s.name]);
    }

    console.log("=== SCHEMA MIGRATION COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
