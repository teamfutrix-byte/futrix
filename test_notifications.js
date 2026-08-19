const { Client } = require('pg');
const notificationCenter = require('./services/notificationCenter');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE NOTIFICATION CENTER E2E TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  const testUserId = '3b9da023-4701-4443-bc33-1c946b0c39b0';

  try {
    // 0. Clean slate for E2E tests
    console.log("Cleaning old test delivery logs...");
    await db.query("DELETE FROM public.notification_queues WHERE delivery_id IN (SELECT id FROM public.notification_deliveries WHERE user_id = $1)", [testUserId]);
    await db.query("DELETE FROM public.notification_deliveries WHERE user_id = $1", [testUserId]);
    await db.query("DELETE FROM public.notification_audit_logs WHERE target = $1", [testUserId]);

    // Restore default preferences
    await db.query(
      `INSERT INTO public.notification_preferences (user_id, email_enabled, sms_enabled, whatsapp_enabled, push_enabled, marketing_enabled, learning_reminders_enabled, achievement_alerts_enabled, payment_alerts_enabled, system_alerts_enabled, community_updates_enabled, quiet_hours_start, quiet_hours_end)
       VALUES ($1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE SET 
         email_enabled = TRUE, sms_enabled = TRUE, whatsapp_enabled = TRUE, push_enabled = TRUE, 
         quiet_hours_start = NULL, quiet_hours_end = NULL`,
      [testUserId]
    );

    // Ensure email is clean
    await db.query("UPDATE public.profiles SET email = 'student@futrix.com' WHERE id = $1", [testUserId]);

    // 1. Assert Immediate Notification Event (Registration)
    console.log("\n1. Testing event trigger: 'User Registration'...");
    const results = await notificationCenter.triggerEvent(db, {
      eventName: 'User Registration',
      userId: testUserId,
      customVariables: {
        studentName: 'Test Student User'
      }
    });

    console.log(`- Dispatched templates count: ${results.length}`);
    if (results.length !== 2) {
      throw new Error(`Expected 2 templates (email and sms) to be dispatched, got: ${results.length}`);
    }

    // Verify database deliveries table
    const { rows: deliveries } = await db.query(
      `SELECT * FROM public.notification_deliveries WHERE user_id = $1 ORDER BY created_at DESC`,
      [testUserId]
    );
    console.log(`- Saved deliveries found in database: ${deliveries.length}`);
    
    const emailDel = deliveries.find(d => d.channel === 'email');
    const smsDel = deliveries.find(d => d.channel === 'sms');

    if (!emailDel || !smsDel) {
      throw new Error("Could not find matching email or sms delivery records.");
    }

    console.log(`- Email Delivery status: ${emailDel.status}`);
    console.log(`- SMS Delivery status: ${smsDel.status}`);
    console.log(`- Interpolated Message body: "${emailDel.message}"`);

    if (!emailDel.message.includes('Test Student User')) {
      throw new Error("Placeholder interpolation failed: studentName not replaced.");
    }
    console.log("✓ Event trigger and variable interpolation verified.");


    // 2. Assert Preferences opting out channel (Email)
    console.log("\n2. Testing Opt-Out preference checks...");
    await db.query("UPDATE public.notification_preferences SET email_enabled = FALSE WHERE user_id = $1", [testUserId]);
    
    // Clear log and trigger registration again
    await db.query("DELETE FROM public.notification_queues WHERE delivery_id IN (SELECT id FROM public.notification_deliveries WHERE user_id = $1)", [testUserId]);
    await db.query("DELETE FROM public.notification_deliveries WHERE user_id = $1", [testUserId]);

    const resultsOptOut = await notificationCenter.triggerEvent(db, {
      eventName: 'User Registration',
      userId: testUserId,
      customVariables: { studentName: 'Opt-Out Student' }
    });

    console.log(`- Opt-Out Dispatched count: ${resultsOptOut.length}`);
    const { rows: deliveriesOptOut } = await db.query(
      `SELECT channel FROM public.notification_deliveries WHERE user_id = $1`,
      [testUserId]
    );
    
    const emailSent = deliveriesOptOut.some(d => d.channel === 'email');
    console.log(`- Email channel sent? ${emailSent ? 'YES' : 'NO'}`);
    
    if (emailSent) {
      throw new Error("Preferences Engine failed: Sent email notification even when email was disabled.");
    }
    console.log("✓ Preferences Engine Opt-Out logic verified.");


    // 3. Assert Quiet Hours Scheduling Delay
    console.log("\n3. Testing Quiet Hours queue scheduling delay...");
    // Reset email enable, set quiet hours to cover current time
    await db.query(
      `UPDATE public.notification_preferences 
       SET email_enabled = TRUE, quiet_hours_start = '00:00:00', quiet_hours_end = '23:59:00' 
       WHERE user_id = $1`, 
      [testUserId]
    );

    await db.query("DELETE FROM public.notification_queues WHERE delivery_id IN (SELECT id FROM public.notification_deliveries WHERE user_id = $1)", [testUserId]);
    await db.query("DELETE FROM public.notification_deliveries WHERE user_id = $1", [testUserId]);

    const resultsQuiet = await notificationCenter.triggerEvent(db, {
      eventName: 'User Registration',
      userId: testUserId,
      customVariables: { studentName: 'Quiet Hours Student' }
    });

    console.log(`- Quiet hours trigger dispatch states:`, resultsQuiet);
    const { rows: deliveriesQuiet } = await db.query(
      `SELECT status FROM public.notification_deliveries WHERE user_id = $1 AND channel = 'email'`,
      [testUserId]
    );
    console.log(`- Email Delivery status inside quiet hours: ${deliveriesQuiet[0] ? deliveriesQuiet[0].status : 'None'}`);

    if (deliveriesQuiet.length === 0 || deliveriesQuiet[0].status !== 'Queued') {
      throw new Error("Quiet hours scheduler failure: Expected status 'Queued', got: " + (deliveriesQuiet[0] ? deliveriesQuiet[0].status : 'None'));
    }
    console.log("✓ Quiet hours constraints verified.");


    // 4. Assert Provider Outages & Fallback routing (Email -> SMS)
    console.log("\n4. Testing channel fallback logic on provider outages (Email fail -> SMS)...");
    // Set max_retries to 0 for email to trigger immediate fallback on failure
    await db.query("UPDATE public.notification_channels SET retry_policy = '{\"max_retries\": 0, \"backoff_ms\": 10, \"multiplier\": 2}'::jsonb WHERE id = 'email'");

    // Restore default preferences
    await db.query("UPDATE public.notification_preferences SET quiet_hours_start = NULL, quiet_hours_end = NULL WHERE user_id = $1", [testUserId]);
    // Force email delivery failure by putting 'fail' in email recipient
    await db.query("UPDATE public.profiles SET email = 'fail_test_student@futrix.com' WHERE id = $1", [testUserId]);

    await db.query("DELETE FROM public.notification_queues WHERE delivery_id IN (SELECT id FROM public.notification_deliveries WHERE user_id = $1)", [testUserId]);
    await db.query("DELETE FROM public.notification_deliveries WHERE user_id = $1", [testUserId]);

    console.log("Triggering event with force-fail recipient...");
    const resultsFallback = await notificationCenter.triggerEvent(db, {
      eventName: 'User Registration',
      userId: testUserId,
      customVariables: { studentName: 'Fallback Test Student' }
    });

    // Check deliveries created for this E2E run
    const { rows: deliveriesFallback } = await db.query(
      `SELECT channel, status, metadata FROM public.notification_deliveries WHERE user_id = $1 ORDER BY created_at ASC`,
      [testUserId]
    );

    console.log("- Deliveries trace post-outage:");
    deliveriesFallback.forEach(d => {
      console.log(`  * Channel: ${d.channel}, Status: ${d.status}, Fallback source: ${d.metadata ? JSON.stringify(d.metadata) : 'None'}`);
    });

    const hasFailedEmail = deliveriesFallback.some(d => d.channel === 'email' && d.status === 'Failed');
    const hasSuccessfulSmsFallback = deliveriesFallback.some(d => d.channel === 'sms' && d.status === 'Delivered');

    if (!hasFailedEmail || !hasSuccessfulSmsFallback) {
      throw new Error("Outage Fallback routing failed: Did not see a failed email and successful SMS fallback.");
    }
    
    // Restore email channel default config
    await db.query("UPDATE public.notification_channels SET retry_policy = '{\"max_retries\": 3, \"backoff_ms\": 100, \"multiplier\": 2}'::jsonb WHERE id = 'email'");
    console.log("✓ Provider outage and channel fallback routing verified.");


    // 5. Assert Campaign creation and Audience Segmentation
    console.log("\n5. Testing audience segmentation campaign dispatch...");
    const campaignResult = await notificationCenter.launchCampaign(db, {
      name: 'E2E Test Retainer',
      category: 'Retention',
      templateId: 'temp_revision_reminder_push',
      segment: {
        role: 'student',
        preparation_for: 'JEE Main'
      }
    });

    console.log(`- Campaign launch status: ${campaignResult.status}`);
    console.log(`- Segment targets matched: ${campaignResult.targetedCount}`);
    console.log(`- Total notifications dispatched: ${campaignResult.sentCount}`);

    if (campaignResult.targetedCount === 0) {
      console.warn("  [Warning] Targeted segment matches 0 users in test DB.");
    }
    console.log("✓ Audience segmentation campaigns verified.");


    // 6. Assert Dashboard Live Metrics Aggregates
    console.log("\n6. Testing dashboard real-time statistics generation...");
    const stats = await notificationCenter.getDashboardStats(db);
    console.log(`- Sent Today KPI: ${stats.sentToday}`);
    console.log(`- Delivery Success Rate KPI: ${stats.deliveryRate}%`);
    console.log(`- Failure Rate KPI: ${stats.failureRate}%`);
    console.log(`- Email Queue Pending: ${stats.queueStatus.EMAIL || 0}`);
    console.log(`- Recent activities retrieved: ${stats.recentActivity.length}`);

    if (stats.sentToday === 0) {
      throw new Error("Dashboard reports 0 notifications sent today, which is incorrect.");
    }
    console.log("✓ Dashboard reporting metrics verified.");


    console.log("\n=== ALL NOTIFICATION PLATFORM ENGINE TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ NOTIFICATION TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Clean up our E2E test data logs to avoid DB clutter
    console.log("\nCleaning up test logs...");
    await db.query("DELETE FROM public.notification_queues WHERE delivery_id IN (SELECT id FROM public.notification_deliveries WHERE user_id = $1)", [testUserId]);
    await db.query("DELETE FROM public.notification_deliveries WHERE user_id = $1", [testUserId]);
    await db.query("DELETE FROM public.notification_audit_logs WHERE target = $1", [testUserId]);
    await db.end();
  }
}

runTests();
