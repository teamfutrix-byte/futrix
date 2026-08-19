/**
 * FUTRIX E2E INTEGRATION TEST - GLOBAL CONFIGS & FEATURE FLAGS
 * Validates:
 * 1. Configuration overrides and level-based inheritance resolution.
 * 2. Feature flag rollout strategies (100%, percentage, role-based targeting).
 * 3. Prerequisite dependency resolution and cyclic loop detection.
 * 4. A/B Testing experiment variant allocation and impressions/conversions incrementation.
 * 5. Caching and sub-10ms flag evaluation latency requirements.
 */

const { Client } = require('pg');
const globalConfigs = require('./services/globalConfigs');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log('====================================================');
  console.log('🧪 FUTRIX GLOBAL SETTINGS & FEATURE FLAGS TESTS');
  console.log('====================================================\n');

  const client = new Client(dbConfig);
  await client.connect();
  console.log('✓ Connected to PostgreSQL Database.');

  // Retrieve a test profile ID
  const { rows: userRows } = await client.query("SELECT id FROM public.profiles LIMIT 1");
  if (userRows.length === 0) {
    console.error('❌ Failed: No profiles found to execute test context.');
    await client.end();
    process.exit(1);
  }
  const testUserId = userRows[0].id;
  console.log(`✓ Using Test User ID: ${testUserId}`);

  try {
    // --------------------------------------------------------------------
    // TEST 1: Configuration Override Inheritance Resolution
    // --------------------------------------------------------------------
    console.log('\n--- TEST 1: Config Inheritance Resolution ---');
    
    // Fetch supported_languages config ID
    const { rows: cfgRows } = await client.query("SELECT id FROM public.platform_configs WHERE key = 'supported_languages'");
    if (cfgRows.length === 0) throw new Error("Config 'supported_languages' not seeded.");
    const configId = cfgRows[0].id;

    // Clear existing overrides for this config key
    await client.query("DELETE FROM public.config_overrides WHERE config_id = $1", [configId]);

    // 1. Check global default
    const globalVal = await globalConfigs.getConfigWithInheritance(client, 'supported_languages', {});
    console.log(`- Global Default Resolved: ${JSON.stringify(globalVal)}`);

    // 2. Set User override
    const userOverrideVal = ['en', 'te'];
    await client.query(`
      INSERT INTO public.config_overrides (config_id, level, level_value, value)
      VALUES ($1, 'user', $2, $3)
    `, [configId, testUserId, JSON.stringify(userOverrideVal)]);
    
    globalConfigs.invalidateCache();

    // 3. Resolve for targeted user (should get user override value)
    const resolvedUserVal = await globalConfigs.getConfigWithInheritance(client, 'supported_languages', { userId: testUserId });
    console.log(`- Targeted User Override Resolved: ${JSON.stringify(resolvedUserVal)}`);
    if (JSON.stringify(resolvedUserVal) !== JSON.stringify(userOverrideVal)) {
      throw new Error('User override value was not applied correctly.');
    }

    // 4. Resolve for untargeted user (should fallback to global value)
    const fallbackVal = await globalConfigs.getConfigWithInheritance(client, 'supported_languages', { userId: 'unregistered-user' });
    console.log(`- Untargeted User Resolved (Expected fallback): ${JSON.stringify(fallbackVal)}`);
    if (JSON.stringify(fallbackVal) !== JSON.stringify(globalVal)) {
      throw new Error('Fallback logic was not resolved correctly.');
    }


    // --------------------------------------------------------------------
    // TEST 2: Feature Flag Rollouts (100% vs Percentage)
    // --------------------------------------------------------------------
    console.log('\n--- TEST 2: Feature Flag Rollouts ---');

    // 1. Check globally disabled flag
    await client.query("UPDATE public.feature_flags SET enabled = false WHERE key = 'stripe_payments_enabled'");
    globalConfigs.invalidateCache();
    const isStripeActive = await globalConfigs.evaluateFeatureFlag(client, 'stripe_payments_enabled', testUserId);
    console.log(`- Stripe Payments Status (Expected false): ${isStripeActive}`);
    if (isStripeActive) throw new Error('Disabled feature flag returned true.');

    // 2. Check 100% rollout flag
    await client.query("UPDATE public.feature_flags SET enabled = true, rollout_strategy = '100% Rollout' WHERE key = 'llm_service'");
    globalConfigs.invalidateCache();
    const isLlmActive = await globalConfigs.evaluateFeatureFlag(client, 'llm_service', testUserId);
    console.log(`- LLM Service Status (Expected true): ${isLlmActive}`);
    if (!isLlmActive) throw new Error('100% rollout flag returned false.');

    // 3. Check Percentage Rollout (Deterministic group bucketing)
    await client.query(`
      UPDATE public.feature_flags 
      SET enabled = true, rollout_strategy = 'Percentage Rollout', rollout_rules = '{"percentage": 50}'::JSONB
      WHERE key = 'smart_revision_enabled'
    `);
    globalConfigs.invalidateCache();
    
    const results = [];
    const ids = ['user-a', 'user-b', 'user-c', 'user-d', 'user-e'];
    for (const id of ids) {
      const active = await globalConfigs.evaluateFeatureFlag(client, 'smart_revision_enabled', id);
      results.push(active);
      // Double check consistency
      const activeSecondTime = await globalConfigs.evaluateFeatureFlag(client, 'smart_revision_enabled', id);
      if (active !== activeSecondTime) throw new Error('Rollout check is not deterministic for ID: ' + id);
    }
    console.log(`- Percentage Rollout Results for 5 test IDs: ${JSON.stringify(results)}`);


    // --------------------------------------------------------------------
    // TEST 3: Flag Prerequisites & Cycle Warnings
    // --------------------------------------------------------------------
    console.log('\n--- TEST 3: Flag Prerequisites & Dependency Cycles ---');

    // 1. Prerequisite disable blocks parent flag
    await client.query("UPDATE public.feature_flags SET enabled = false WHERE key = 'llm_service'");
    await client.query("UPDATE public.feature_flags SET enabled = true WHERE key = 'ai_tutor_enabled'");
    globalConfigs.invalidateCache();

    const isTutorActiveBlocked = await globalConfigs.evaluateFeatureFlag(client, 'ai_tutor_enabled', testUserId);
    console.log(`- AI Tutor (prerequisite 'llm_service' disabled, Expected false): ${isTutorActiveBlocked}`);
    if (isTutorActiveBlocked) throw new Error('Flag evaluated to active despite disabled prerequisite dependency.');

    // 2. Prerequisite enable allows parent flag
    await client.query("UPDATE public.feature_flags SET enabled = true WHERE key = 'llm_service'");
    globalConfigs.invalidateCache();

    const isTutorActiveAllowed = await globalConfigs.evaluateFeatureFlag(client, 'ai_tutor_enabled', testUserId);
    console.log(`- AI Tutor (prerequisite 'llm_service' enabled, Expected true): ${isTutorActiveAllowed}`);
    if (!isTutorActiveAllowed) throw new Error('Parent flag should have been enabled.');

    // 3. Cyclic dependency warning check
    await client.query("INSERT INTO public.feature_dependencies (flag_key, depends_on_key) VALUES ('llm_service', 'ai_tutor_enabled') ON CONFLICT DO NOTHING");
    const cyclesRes = await globalConfigs.checkCyclicDependencies(client);
    console.log(`- Cycles detection check (Expected hasCycles: true): ${cyclesRes.hasCycles}`);
    if (!cyclesRes.hasCycles) throw new Error('Cyclic relationship checker failed to flag loop.');


    // --------------------------------------------------------------------
    // TEST 4: A/B Testing Variant Allocations & Metrics Tracking
    // --------------------------------------------------------------------
    console.log('\n--- TEST 4: A/B Variant Hashing & Conversion tracking ---');

    // Reset experiment metrics
    await client.query(`
      UPDATE public.experiments
      SET status = 'Running', metrics = '{"impressions": {"control": 0, "adaptive_v1": 0}, "conversions": {"control": 0, "adaptive_v1": 0}}'::JSONB
      WHERE key = 'mock_difficulty_algorithm'
    `);

    // 1. Allocate variants deterministically
    const allocA = await globalConfigs.evaluateExperiment(client, 'mock_difficulty_algorithm', 'user-id-alpha');
    const allocB = await globalConfigs.evaluateExperiment(client, 'mock_difficulty_algorithm', 'user-id-beta');
    console.log(`- User Alpha variant selection: ${allocA.variant}`);
    console.log(`- User Beta variant selection: ${allocB.variant}`);

    // Check impressions updated in DB
    const { rows: expRows } = await client.query("SELECT metrics FROM public.experiments WHERE key = 'mock_difficulty_algorithm'");
    const metrics = expRows[0].metrics;
    console.log(`- Impressions count updated in DB: ${JSON.stringify(metrics.impressions)}`);
    const totalImpressions = (metrics.impressions.control || 0) + (metrics.impressions.adaptive_v1 || 0);
    if (totalImpressions !== 2) throw new Error('Impressions count did not increment.');

    // 2. Perform Conversion
    await globalConfigs.recordConversion(client, 'mock_difficulty_algorithm', allocA.variant);
    const { rows: expRowsConv } = await client.query("SELECT metrics FROM public.experiments WHERE key = 'mock_difficulty_algorithm'");
    const metricsConv = expRowsConv[0].metrics;
    console.log(`- Conversions count updated in DB: ${JSON.stringify(metricsConv.conversions)}`);
    if ((metricsConv.conversions[allocA.variant] || 0) !== 1) {
      throw new Error('Conversions count was not logged.');
    }


    // --------------------------------------------------------------------
    // TEST 5: Caching & Latency Benchmarking
    // --------------------------------------------------------------------
    console.log('\n--- TEST 5: Latency Performance Benchmark ---');

    const runsCount = 1000;
    const start = Date.now();
    for (let i = 0; i < runsCount; i++) {
      await globalConfigs.evaluateFeatureFlag(client, 'ai_tutor_enabled', testUserId);
    }
    const end = Date.now();
    const durationMs = end - start;
    const avgMs = durationMs / runsCount;
    
    console.log(`- Checked flag '${runsCount}' times.`);
    console.log(`- Total Benchmark Duration: ${durationMs}ms`);
    console.log(`- Average Resolution Latency: ${avgMs.toFixed(3)}ms`);
    
    if (avgMs > 10) throw new Error(`Latency resolution exceeds target threshold (10ms): ${avgMs}ms`);


    // --------------------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------------------
    console.log('\n--- CLEANUP: Restoring database seed states ---');
    await client.query("DELETE FROM public.config_overrides WHERE config_id = $1", [configId]);
    await client.query("DELETE FROM public.feature_dependencies WHERE flag_key = 'llm_service' AND depends_on_key = 'ai_tutor_enabled'");
    await client.query("UPDATE public.feature_flags SET enabled = true WHERE key = 'llm_service'");
    globalConfigs.invalidateCache();
    console.log('✓ Cleanup completed.');

    console.log('\n====================================================');
    console.log('🎉 ALL GLOBAL SETTINGS & FEATURE FLAGS TESTS PASSED! ✓');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE EXCEPTION ENCOUNTERED:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('DB Connection closed.');
  }
}

runTests();
