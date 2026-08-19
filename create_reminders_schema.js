const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Reminder & Notification Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create reminders table
    console.log("- Creating public.reminders table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'Revision', -- 'Streak', 'Revision', 'Flashcard', 'Test'
        rule_cron VARCHAR(50),
        target_time TIME NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create notification_queue table
    console.log("- Creating public.notification_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
        scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Delivered', 'Failed'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create notification_delivery table
    console.log("- Creating public.notification_delivery table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_delivery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_id UUID REFERENCES public.notification_queue(id) ON DELETE CASCADE,
        channel VARCHAR(30) NOT NULL, -- 'In-App', 'Push', 'Email', 'WhatsApp', 'SMS'
        provider VARCHAR(50) DEFAULT 'LocalMockProvider',
        sent_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create notification_templates table
    console.log("- Creating public.notification_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(50) NOT NULL,
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        variables_list_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create notification_preferences table
    console.log("- Creating public.notification_preferences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        channels_allowed_json JSONB DEFAULT '["In-App", "Email"]'::jsonb,
        quiet_hours_start TIME DEFAULT '22:00:00',
        quiet_hours_end TIME DEFAULT '07:00:00',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Create notification_history table
    console.log("- Creating public.notification_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        channel VARCHAR(30) NOT NULL,
        open_status BOOLEAN DEFAULT FALSE,
        click_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 7. Create notification_analytics table
    console.log("- Creating public.notification_analytics table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        total_sent INTEGER DEFAULT 0,
        total_opened INTEGER DEFAULT 0,
        total_clicked INTEGER DEFAULT 0,
        conversion_rate_pct NUMERIC DEFAULT 0.0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 8. Create notification_ai_logs table
    console.log("- Creating public.notification_ai_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notification_ai_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        best_time_predicted TIME DEFAULT '18:00:00',
        tone_predicted VARCHAR(50) DEFAULT 'Motivational',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 9. Create channel_configuration table
    console.log("- Creating public.channel_configuration table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.channel_configuration (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_name VARCHAR(30) UNIQUE NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        api_credentials_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 10. Create future_notification_models table
    console.log("- Creating public.future_notification_models table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.future_notification_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        config_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Reminder & Notification Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
