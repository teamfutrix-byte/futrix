const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Analytics DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log("- Dropping existing analytics tables...");
    await client.query(`
      DROP TABLE IF EXISTS public.analytics_saved_reports CASCADE;
      DROP TABLE IF EXISTS public.analytics_snapshots CASCADE;
      DROP TABLE IF EXISTS public.analytics_events CASCADE;
    `);

    // Create analytics_events
    console.log("- Creating public.analytics_events table...");
    await client.query(`
      CREATE TABLE public.analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(100) NOT NULL,
        tenant_id UUID,
        user_id VARCHAR(100),
        category VARCHAR(50) NOT NULL,
        value NUMERIC(15,4) DEFAULT 0.0000,
        metadata JSONB DEFAULT '{}'::jsonb,
        timestamp TIMESTAMP DEFAULT now()
      );
      CREATE INDEX idx_events_name ON public.analytics_events(event_name);
      CREATE INDEX idx_events_category ON public.analytics_events(category);
      CREATE INDEX idx_events_time ON public.analytics_events(timestamp);
      CREATE INDEX idx_events_tenant ON public.analytics_events(tenant_id);
    `);
    console.log("✓ analytics_events table created.");

    // Create analytics_snapshots
    console.log("- Creating public.analytics_snapshots table...");
    await client.query(`
      CREATE TABLE public.analytics_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(50) NOT NULL,
        value NUMERIC(15,4) NOT NULL,
        dimensions JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✓ analytics_snapshots table created.");

    // Create analytics_saved_reports
    console.log("- Creating public.analytics_saved_reports table...");
    await client.query(`
      CREATE TABLE public.analytics_saved_reports (
        id VARCHAR PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        is_scheduled BOOLEAN DEFAULT false,
        schedule_cron VARCHAR(50),
        recipients TEXT[] DEFAULT '{}'
      );
    `);
    console.log("✓ analytics_saved_reports table created.");

    // Seed historical events (120+ rows spread over the last 30 days)
    console.log("Seeding historical events...");
    
    // We will generate SQL inserts programmatically to cover the last 30 days
    const eventsToSeed = [];
    const now = new Date();
    
    // Generate payments with an upward linear trend: Day D (0 to 30) value = 100 + D * 10
    // Generate api_requests with random latency for P50/P95/P99 checks
    // Generate study_sessions
    // Generate logins
    for (let day = 30; day >= 1; day--) {
      const eventDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      const isoStr = eventDate.toISOString();

      // 1. Payment Event (Linear Upward Trend)
      const payVal = 100 + (30 - day) * 10; 
      eventsToSeed.push({
        name: 'payment_success',
        category: 'payment',
        value: payVal,
        metadata: JSON.stringify({ gateway: 'stripe', plan: 'Premium Monthly' }),
        time: isoStr
      });

      // 2. Study Session (Student hours)
      const studyVal = 40 + Math.floor(Math.random() * 80); // 40-120 mins
      eventsToSeed.push({
        name: 'study_session',
        category: 'student',
        value: studyVal,
        metadata: JSON.stringify({ subject: 'Physics', topic_id: 'top_newton' }),
        time: isoStr
      });

      // 3. User Login (DAU / MAU)
      eventsToSeed.push({
        name: 'user_login',
        category: 'business',
        value: 1,
        metadata: JSON.stringify({ browser: 'Chrome', platform: 'Windows' }),
        time: isoStr
      });

      // 4. API Request Latency (for P50/P95/P99 tests)
      // We push a mix of fast and slow latencies
      const apiLatencies = [50, 60, 75, 110, 480]; // P50 is around 75, P95 is 480
      apiLatencies.forEach(lat => {
        eventsToSeed.push({
          name: 'api_request',
          category: 'api',
          value: lat,
          metadata: JSON.stringify({ path: '/api/questions/solve', method: 'POST' }),
          time: isoStr
        });
      });

      // 5. AI Prompt Telemetry
      eventsToSeed.push({
        name: 'ai_query',
        category: 'ai',
        value: 1.25, // latency in secs
        metadata: JSON.stringify({ tokens: 450, cost: 0.0009, cache_hit: Math.random() > 0.4 }),
        time: isoStr
      });
    }

    console.log(`- Inserting ${eventsToSeed.length} generated historical records...`);
    
    // Batch inserts in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < eventsToSeed.length; i += chunkSize) {
      const chunk = eventsToSeed.slice(i, i + chunkSize);
      const valueStrings = chunk.map((e, idx) => {
        const offset = idx * 5;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::numeric, $${offset + 5}::timestamp)`;
      }).join(', ');

      const params = [];
      chunk.forEach(e => {
        params.push(e.name, e.category, e.metadata, e.value, e.time);
      });

      await client.query(`
        INSERT INTO public.analytics_events (event_name, category, metadata, value, timestamp)
        VALUES ${valueStrings}
      `, params);
    }

    // Seed default snapshots
    await client.query(`
      INSERT INTO public.analytics_snapshots (metric_name, category, value, dimensions)
      VALUES
        ('mau', 'business', 1540, '{"region": "all"}'::jsonb),
        ('dau', 'business', 412, '{"region": "all"}'::jsonb),
        ('retention_rate', 'business', 82.4, '{"cohort": "2026-06"}'::jsonb),
        ('api_safety_incidents', 'security', 0, '{"safety": "all"}'::jsonb)
    `);

    // Seed a saved report config
    await client.query(`
      INSERT INTO public.analytics_saved_reports (id, title, category, config, created_by)
      VALUES (
        'rep_monthly_rev',
        'Monthly Revenue & Subscriptions Pivot',
        'payment',
        '{"metrics": ["value"], "group_by": "timestamp", "filters": {"category": "payment"}}'::jsonb,
        'admin_test'
      )
    `);

    console.log("✓ Seeding complete. Analytics migrations finished.");

  } catch (err) {
    console.error("Analytics Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
