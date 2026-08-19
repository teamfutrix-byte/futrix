const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Notification Center DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Drop existing tables to ensure clean types (e.g. user_id VARCHAR)
    console.log("- Dropping existing tables if any...");
    await client.query(`
      DROP TABLE IF EXISTS public.notification_audit_logs CASCADE;
      DROP TABLE IF EXISTS public.notification_queues CASCADE;
      DROP TABLE IF EXISTS public.notification_campaigns CASCADE;
      DROP TABLE IF EXISTS public.notification_announcements CASCADE;
      DROP TABLE IF EXISTS public.notification_deliveries CASCADE;
      DROP TABLE IF EXISTS public.notification_templates CASCADE;
      DROP TABLE IF EXISTS public.notification_preferences CASCADE;
      DROP TABLE IF EXISTS public.notification_channels CASCADE;
    `);
    
    // 2. Create notification_channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_channels (
        id VARCHAR PRIMARY KEY,
        provider VARCHAR NOT NULL,
        priority INT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Active',
        retry_policy JSONB NOT NULL,
        rate_limit INT DEFAULT 100,
        daily_limit INT DEFAULT 10000,
        monthly_limit INT DEFAULT 300000,
        cost_per_message NUMERIC NOT NULL DEFAULT 0.00,
        health_status VARCHAR NOT NULL DEFAULT 'Healthy',
        supported_regions TEXT[] DEFAULT '{"Global"}',
        supported_languages TEXT[] DEFAULT '{"en"}',
        fallback_channels TEXT[] DEFAULT '{}',
        audit_history JSONB[] DEFAULT '{}'
      )
    `);
    console.log("- Table 'notification_channels' created.");

    // 3. Create notification_templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_templates (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        category VARCHAR NOT NULL,
        channel VARCHAR NOT NULL,
        language VARCHAR NOT NULL DEFAULT 'en',
        subject VARCHAR,
        title VARCHAR,
        message TEXT NOT NULL,
        html_body TEXT,
        variables TEXT[] DEFAULT '{}',
        preview TEXT,
        status VARCHAR NOT NULL DEFAULT 'Approved',
        version INT NOT NULL DEFAULT 1,
        approval JSONB DEFAULT '{"status": "Approved", "approver": "System"}'::jsonb,
        audit_history JSONB[] DEFAULT '{}'
      )
    `);
    console.log("- Table 'notification_templates' created.");

    // 4. Create notification_preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_preferences (
        user_id VARCHAR PRIMARY KEY,
        email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        learning_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        achievement_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        payment_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        system_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        community_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        quiet_hours_start TIME DEFAULT NULL,
        quiet_hours_end TIME DEFAULT NULL,
        preferred_time TIME DEFAULT NULL,
        preferred_language VARCHAR NOT NULL DEFAULT 'en'
      )
    `);
    console.log("- Table 'notification_preferences' created.");

    // 5. Create notification_deliveries
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_deliveries (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        template_id VARCHAR,
        channel VARCHAR NOT NULL,
        provider VARCHAR NOT NULL,
        recipient VARCHAR NOT NULL,
        subject VARCHAR,
        message TEXT NOT NULL,
        html_body TEXT,
        status VARCHAR NOT NULL DEFAULT 'Queued',
        priority VARCHAR NOT NULL DEFAULT 'Medium',
        retry_count INT NOT NULL DEFAULT 0,
        max_retries INT NOT NULL DEFAULT 3,
        error_message TEXT,
        scheduled_at TIMESTAMP DEFAULT NULL,
        sent_at TIMESTAMP DEFAULT NULL,
        delivered_at TIMESTAMP DEFAULT NULL,
        opened_at TIMESTAMP DEFAULT NULL,
        clicked_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log("- Table 'notification_deliveries' created.");

    // 6. Create notification_queues
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_queues (
        id VARCHAR PRIMARY KEY,
        delivery_id VARCHAR NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
        queue_type VARCHAR NOT NULL,
        priority INT NOT NULL DEFAULT 1,
        retry_after TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'notification_queues' created.");

    // 7. Create notification_campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_campaigns (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        category VARCHAR NOT NULL,
        template_id VARCHAR REFERENCES public.notification_templates(id),
        audience_segment JSONB NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Draft',
        scheduled_at TIMESTAMP DEFAULT NULL,
        sent_count INT NOT NULL DEFAULT 0,
        delivery_count INT NOT NULL DEFAULT 0,
        open_count INT NOT NULL DEFAULT 0,
        click_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'notification_campaigns' created.");

    // 8. Create notification_announcements
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_announcements (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR NOT NULL,
        scope_type VARCHAR NOT NULL DEFAULT 'Global',
        scope_value VARCHAR DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'notification_announcements' created.");

    // 9. Create notification_audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        target VARCHAR NOT NULL,
        details JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'notification_audit_logs' created.");

    // ── SEED DATA ──
    console.log("Seeding default channels, templates, and preferences...");

    // Seed Channels
    await client.query(`
      INSERT INTO public.notification_channels (id, provider, priority, status, retry_policy, rate_limit, daily_limit, monthly_limit, cost_per_message, health_status, fallback_channels)
      VALUES
        ('email', 'smtp', 1, 'Active', '{"max_retries": 3, "backoff_ms": 100, "multiplier": 2}'::jsonb, 100, 10000, 300000, 0.005, 'Healthy', '{"sms"}'),
        ('push', 'firebase', 1, 'Active', '{"max_retries": 4, "backoff_ms": 50, "multiplier": 2}'::jsonb, 500, 50000, 1000000, 0.000, 'Healthy', '{"in-app", "email"}'),
        ('in-app', 'database', 1, 'Active', '{"max_retries": 1, "backoff_ms": 10, "multiplier": 1}'::jsonb, 1000, 100000, 3000000, 0.000, 'Healthy', '{}'),
        ('sms', 'twilio', 2, 'Active', '{"max_retries": 2, "backoff_ms": 200, "multiplier": 2}'::jsonb, 50, 5000, 150000, 0.020, 'Healthy', '{"email"}'),
        ('whatsapp', 'whatsapp_business', 2, 'Active', '{"max_retries": 2, "backoff_ms": 150, "multiplier": 2}'::jsonb, 50, 5000, 100000, 0.015, 'Healthy', '{"sms"}'),
        ('webhook', 'generic_http', 3, 'Active', '{"max_retries": 3, "backoff_ms": 200, "multiplier": 2}'::jsonb, 200, 20000, 500000, 0.000, 'Healthy', '{}'),
        ('slack', 'slack_webhook', 3, 'Active', '{"max_retries": 2, "backoff_ms": 100, "multiplier": 1.5}'::jsonb, 100, 10000, 200000, 0.000, 'Healthy', '{}')
      ON CONFLICT (id) DO UPDATE SET 
        provider = EXCLUDED.provider, 
        priority = EXCLUDED.priority, 
        status = EXCLUDED.status, 
        retry_policy = EXCLUDED.retry_policy,
        cost_per_message = EXCLUDED.cost_per_message,
        fallback_channels = EXCLUDED.fallback_channels;
    `);

    // Seed Templates
    await client.query(`
      INSERT INTO public.notification_templates (id, name, category, channel, language, subject, title, message, html_body, variables)
      VALUES
        ('temp_welcome_email', 'Welcome Email', 'User Registration', 'email', 'en', 'Welcome to FUTRIX!', 'Welcome to FUTRIX', 'Hi {{studentName}}, thank you for registering with {{institute}}! We are thrilled to help you master your {{exam}} preparation.', '<h1>Welcome to FUTRIX!</h1><p>Hi {{studentName}},</p><p>Thank you for registering with {{institute}}! We are thrilled to help you master your {{exam}} preparation.</p>', '{"studentName", "institute", "exam"}'),
        ('temp_welcome_sms', 'Welcome SMS', 'User Registration', 'sms', 'en', NULL, 'Welcome', 'Hi {{studentName}}, welcome to FUTRIX! Your registration with {{institute}} is complete. Start preparing for {{exam}} today!', NULL, '{"studentName", "institute", "exam"}'),
        
        ('temp_mock_submit_email', 'Mock Test Submission Email', 'Mock Test Submission', 'email', 'en', 'Mock Test Submitted Successfully', 'Test Submitted', 'Hi {{studentName}}, your mock test for {{subject}} has been submitted. Score: {{score}}, Rank: {{rank}}, XP Earned: {{xp}}.', '<h1>Mock Test Submitted!</h1><p>Hi {{studentName}},</p><p>Your mock test for {{subject}} has been submitted.</p><ul><li>Score: {{score}}</li><li>Rank: {{rank}}</li><li>XP Earned: {{xp}}</li></ul>', '{"studentName", "subject", "score", "rank", "xp"}'),
        ('temp_mock_submit_push', 'Mock Test Submission Push', 'Mock Test Submission', 'push', 'en', NULL, 'Test Submitted Successfully', 'Hi {{studentName}}, your mock test for {{subject}} is submitted! Score: {{score}}, Rank: {{rank}}.', NULL, '{"studentName", "subject", "score", "rank"}'),
        
        ('temp_payment_success_email', 'Payment Success Email', 'Payment Notifications', 'email', 'en', 'Payment Confirmed — Invoice {{invoiceNumber}}', 'Payment Confirmed', 'Hi {{studentName}}, your payment of {{paymentAmount}} for {{plan}} subscription was successful. Invoice: {{invoiceNumber}}.', '<h1>Payment Confirmed!</h1><p>Hi {{studentName}},</p><p>Your payment of {{paymentAmount}} for {{plan}} was successful.</p><p>Invoice Number: {{invoiceNumber}}</p>', '{"studentName", "paymentAmount", "plan", "invoiceNumber"}'),
        ('temp_payment_success_wa', 'Payment Success WhatsApp', 'Payment Notifications', 'whatsapp', 'en', NULL, 'Payment Received', 'Hi {{studentName}}, payment of {{paymentAmount}} for plan {{plan}} is successful. Invoice: {{invoiceNumber}}.', NULL, '{"studentName", "paymentAmount", "plan", "invoiceNumber"}'),

        ('temp_streak_reminder_push', 'Streak Reminder Push', 'Reminder Notifications', 'push', 'en', NULL, 'Keep the streak alive! 🔥', 'Hey {{studentName}}, you have {{xp}} XP today. Complete your daily study targets to keep your streak going!', NULL, '{"studentName", "xp"}'),
        ('temp_revision_reminder_push', 'Revision Reminder Push', 'Learning Notifications', 'push', 'en', NULL, 'Time to revise! 📚', 'Hey {{studentName}}, ready to review {{subject}}? Our AI recommends revising {{chapter}} today.', NULL, '{"studentName", "subject", "chapter"}')
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        subject = EXCLUDED.subject,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        html_body = EXCLUDED.html_body,
        variables = EXCLUDED.variables;
    `);

    // Seed default preferences for existing test users
    await client.query(`
      INSERT INTO public.notification_preferences (user_id, email_enabled, sms_enabled, whatsapp_enabled, push_enabled, marketing_enabled, learning_reminders_enabled, achievement_alerts_enabled, payment_alerts_enabled, system_alerts_enabled, community_updates_enabled)
      VALUES
        ('pay-test-student', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
        ('admin_test', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
      ON CONFLICT (user_id) DO NOTHING;
    `);

    console.log("Seeding complete. Migrations finished.");

  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
