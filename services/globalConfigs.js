const crypto = require('crypto');

// Central memory cache for configurations, flags, and overrides
const configCache = {};
const flagCache = {};
const overrideCache = {};

function invalidateCache() {
  console.log('[CACHE] In-memory configurations cache invalidated.');
  for (const k in configCache) delete configCache[k];
  for (const k in flagCache) delete flagCache[k];
  for (const k in overrideCache) delete overrideCache[k];
}

/**
 * Deterministic hash-based bucketing for A/B testing and percentage rollouts.
 * Returns an integer between 0 and 99.
 */
function getDeterministicBucket(userId, salt) {
  if (!userId) return Math.floor(Math.random() * 100);
  const combined = userId + '-' + salt;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  const integer = parseInt(hash.substring(0, 8), 16);
  return integer % 100;
}

/**
 * Helper to check dependencies without cycles
 */
async function resolvePrerequisites(db, flagKey, visited = new Set()) {
  if (visited.has(flagKey)) {
    throw new Error(`Cyclic dependency detected involving feature flag: ${flagKey}`);
  }
  visited.add(flagKey);

  const { rows } = await db.query(`
    SELECT depends_on_key FROM public.feature_dependencies
    WHERE flag_key = $1
  `, [flagKey]);

  for (const r of rows) {
    const depKey = r.depends_on_key;
    // Fetch and check status of prerequisite flag
    const { rows: flagRows } = await db.query('SELECT enabled FROM public.feature_flags WHERE key = $1', [depKey]);
    if (flagRows.length === 0 || !flagRows[0].enabled) {
      return { resolved: false, brokenKey: depKey };
    }
    // Recurse into the prerequisite's dependencies
    const nestedRes = await resolvePrerequisites(db, depKey, visited);
    if (!nestedRes.resolved) {
      return nestedRes;
    }
  }

  visited.delete(flagKey);
  return { resolved: true };
}

/**
 * Evaluates combined inheritance resolution for a configuration setting:
 * Global -> Country -> State -> Institute -> Batch -> Role -> User (individual override)
 */
async function getConfigWithInheritance(db, configKey, context = {}) {
  const cacheKey = `${configKey}:${JSON.stringify(context)}`;
  if (configCache[cacheKey] !== undefined) {
    return configCache[cacheKey];
  }

  // 1. Fetch global default
  const { rows: configRows } = await db.query(`
    SELECT id, value FROM public.platform_configs WHERE key = $1
  `, [configKey]);

  if (configRows.length === 0) {
    return null;
  }
  const config = configRows[0];
  let finalValue = config.value;

  // 2. Fetch all overrides matching this configuration
  const { rows: overrides } = await db.query(`
    SELECT level, level_value, value FROM public.config_overrides
    WHERE config_id = $1
  `, [config.id]);

  if (overrides.length > 0) {
    // Priority order: user > role > batch > institute > state > country
    const levelPriority = {
      user: 6,
      role: 5,
      batch: 4,
      institute: 3,
      state: 2,
      country: 1
    };

    let bestOverride = null;
    let bestPriority = -1;

    for (const ovr of overrides) {
      const p = levelPriority[ovr.level] || 0;
      if (p > bestPriority) {
        let isMatch = false;
        
        if (ovr.level === 'user' && context.userId === ovr.level_value) isMatch = true;
        else if (ovr.level === 'role' && context.role === ovr.level_value) isMatch = true;
        else if (ovr.level === 'batch' && context.batchId === ovr.level_value) isMatch = true;
        else if (ovr.level === 'institute' && context.instituteId === ovr.level_value) isMatch = true;
        else if (ovr.level === 'state' && context.state === ovr.level_value) isMatch = true;
        else if (ovr.level === 'country' && context.country === ovr.level_value) isMatch = true;

        if (isMatch) {
          bestOverride = ovr;
          bestPriority = p;
        }
      }
    }

    if (bestOverride) {
      finalValue = bestOverride.value;
    }
  }

  configCache[cacheKey] = finalValue;
  return finalValue;
}

/**
 * Checks whether a feature is active for a user or tenant context
 */
async function evaluateFeatureFlag(db, flagKey, userId, context = {}) {
  const cacheKey = `${flagKey}:${userId}:${JSON.stringify(context)}`;
  if (flagCache[cacheKey] !== undefined) {
    return flagCache[cacheKey];
  }

  // 1. Fetch main flag record
  const { rows: flagRows } = await db.query('SELECT * FROM public.feature_flags WHERE key = $1', [flagKey]);
  if (flagRows.length === 0) {
    flagCache[cacheKey] = false;
    return false;
  }
  const flag = flagRows[0];

  // If globally disabled, bypass evaluation entirely
  if (!flag.enabled) {
    flagCache[cacheKey] = false;
    return false;
  }

  // 2. Resolve and evaluate prerequisite dependencies
  const depsRes = await resolvePrerequisites(db, flagKey);
  if (!depsRes.resolved) {
    console.warn(`[FLAGS] Feature Flag '${flagKey}' activation blocked because prerequisite '${depsRes.brokenKey}' is disabled.`);
    flagCache[cacheKey] = false;
    return false;
  }

  // 3. Process rollout targeting rule constraints
  const strategy = flag.rollout_strategy;
  const rules = flag.rollout_rules || {};

  if (strategy === '100% Rollout') {
    flagCache[cacheKey] = true;
    return true;
  }

  if (strategy === 'Percentage Rollout') {
    const bucket = getDeterministicBucket(userId, flagKey);
    const pass = bucket < (rules.percentage || 0);
    flagCache[cacheKey] = pass;
    return pass;
  }

  if (strategy === 'Role Based') {
    const roles = rules.roles || [];
    const pass = context.role && roles.includes(context.role);
    flagCache[cacheKey] = pass;
    return pass;
  }

  if (strategy === 'Subscription Based') {
    const tiers = rules.subscription_tiers || [];
    const pass = context.subscriptionTier && tiers.includes(context.subscriptionTier);
    flagCache[cacheKey] = pass;
    return pass;
  }

  if (strategy === 'Country Based') {
    const countries = rules.countries || [];
    const pass = context.country && countries.includes(context.country);
    flagCache[cacheKey] = pass;
    return pass;
  }

  if (strategy === 'Custom Rules') {
    // Custom list of explicitly whitelisted user emails or IDs
    const allowed = rules.allowed_users || [];
    const pass = userId && allowed.includes(userId);
    flagCache[cacheKey] = pass;
    return pass;
  }

  flagCache[cacheKey] = false;
  return false;
}

/**
 * Maps users to test variants and metrics impressions for A/B Testing
 */
async function evaluateExperiment(db, experimentKey, userId, context = {}) {
  // Fetch active experiment
  const { rows } = await db.query('SELECT * FROM public.experiments WHERE key = $1', [experimentKey]);
  if (rows.length === 0) return { variant: 'control', overrides: {} };
  
  const exp = rows[0];
  if (exp.status !== 'Running') {
    return { variant: 'control', overrides: {} };
  }

  const variants = exp.variants || [];
  if (variants.length === 0) {
    return { variant: 'control', overrides: {} };
  }

  // Deterministically bucket the user
  const bucket = getDeterministicBucket(userId, experimentKey);
  
  let cumulativeWeight = 0;
  let selectedVariant = variants[0];

  for (const v of variants) {
    cumulativeWeight += v.weight || 0;
    if (bucket < cumulativeWeight) {
      selectedVariant = v;
      break;
    }
  }

  // Increment impression metric asynchronously in database
  const metrics = exp.metrics || { impressions: {}, conversions: {} };
  metrics.impressions = metrics.impressions || {};
  metrics.impressions[selectedVariant.key] = (metrics.impressions[selectedVariant.key] || 0) + 1;

  await db.query(`
    UPDATE public.experiments
    SET metrics = $1, updated_at = now()
    WHERE id = $2
  `, [JSON.stringify(metrics), exp.id]);

  return {
    variant: selectedVariant.key,
    overrides: selectedVariant.config_overrides || {}
  };
}

/**
 * Records dynamic goal conversions for running experiments
 */
async function recordConversion(db, experimentKey, variantKey) {
  const { rows } = await db.query('SELECT * FROM public.experiments WHERE key = $1', [experimentKey]);
  if (rows.length === 0) return false;
  
  const exp = rows[0];
  const metrics = exp.metrics || { impressions: {}, conversions: {} };
  metrics.conversions = metrics.conversions || {};
  metrics.conversions[variantKey] = (metrics.conversions[variantKey] || 0) + 1;

  await db.query(`
    UPDATE public.experiments
    SET metrics = $1, updated_at = now()
    WHERE id = $2
  `, [JSON.stringify(metrics), exp.id]);

  return true;
}

/**
 * Conflict and cyclic loop dependency analyzer
 */
async function checkCyclicDependencies(db) {
  const { rows: flags } = await db.query('SELECT key FROM public.feature_flags');
  const cycles = [];

  for (const f of flags) {
    try {
      await resolvePrerequisites(db, f.key);
    } catch (err) {
      cycles.push(err.message);
    }
  }

  return { hasCycles: cycles.length > 0, cycles };
}

/**
 * Bundles settings data structure for configuration backups and environments migrations
 */
async function exportConfigs(db) {
  const { rows: configs } = await db.query('SELECT * FROM public.platform_configs ORDER BY key');
  const { rows: overrides } = await db.query('SELECT * FROM public.config_overrides');
  const { rows: flags } = await db.query('SELECT * FROM public.feature_flags ORDER BY key');
  const { rows: deps } = await db.query('SELECT * FROM public.feature_dependencies');
  const { rows: exps } = await db.query('SELECT * FROM public.experiments ORDER BY key');

  return {
    exported_at: new Date().toISOString(),
    configs,
    overrides,
    feature_flags: flags,
    dependencies: deps,
    experiments: exps
  };
}

/**
 * Bulk updates settings variables from backups
 */
async function importConfigs(db, data, editorId) {
  // Begin transactional block
  await db.query('BEGIN');
  try {
    // 1. Restore platform configs
    if (data.configs) {
      for (const cfg of data.configs) {
        await db.query(`
          INSERT INTO public.platform_configs (category, key, value, version, status, updated_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, now())
          ON CONFLICT (key) DO UPDATE
          SET category = EXCLUDED.category, value = EXCLUDED.value, version = EXCLUDED.version, 
              status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();
        `, [cfg.category, cfg.key, JSON.stringify(cfg.value), cfg.version || 1, cfg.status || 'Approved', editorId]);
      }
    }

    // 2. Restore overrides
    if (data.overrides) {
      // Clear out existing overrides to prevent UNIQUE index constraint failures
      await db.query('DELETE FROM public.config_overrides');
      for (const ovr of data.overrides) {
        // Query to match config key mapping
        const { rows } = await db.query('SELECT id FROM public.platform_configs WHERE key = $1', [ovr.config_key || ovr.config_id]);
        const configId = rows.length > 0 ? rows[0].id : ovr.config_id;
        
        if (configId) {
          await db.query(`
            INSERT INTO public.config_overrides (config_id, level, level_value, value)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (config_id, level, level_value) DO UPDATE
            SET value = EXCLUDED.value;
          `, [configId, ovr.level, ovr.level_value, JSON.stringify(ovr.value)]);
        }
      }
    }

    // 3. Restore feature flags
    if (data.feature_flags) {
      for (const f of data.feature_flags) {
        await db.query(`
          INSERT INTO public.feature_flags (key, display_name, description, module, status, enabled, rollout_strategy, rollout_rules)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (key) DO UPDATE
          SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, module = EXCLUDED.module,
              status = EXCLUDED.status, enabled = EXCLUDED.enabled, rollout_strategy = EXCLUDED.rollout_strategy,
              rollout_rules = EXCLUDED.rollout_rules;
        `, [f.key, f.display_name, f.description, f.module, f.status || 'Active', f.enabled || false, f.rollout_strategy || '100% Rollout', JSON.stringify(f.rollout_rules || {})]);
      }
    }

    // 4. Restore dependencies
    if (data.dependencies) {
      await db.query('DELETE FROM public.feature_dependencies');
      for (const d of data.dependencies) {
        await db.query(`
          INSERT INTO public.feature_dependencies (flag_key, depends_on_key)
          VALUES ($1, $2)
          ON CONFLICT (flag_key, depends_on_key) DO NOTHING;
        `, [d.flag_key, d.depends_on_key]);
      }
    }

    // 5. Restore experiments
    if (data.experiments) {
      for (const e of data.experiments) {
        await db.query(`
          INSERT INTO public.experiments (key, display_name, description, status, variants, metrics, start_time, end_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (key) DO UPDATE
          SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = EXCLUDED.status,
              variants = EXCLUDED.variants, metrics = EXCLUDED.metrics, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time;
        `, [e.key, e.display_name, e.description, e.status || 'Draft', JSON.stringify(e.variants || []), JSON.stringify(e.metrics || {}), e.start_time, e.end_time]);
      }
    }

    await db.query('COMMIT');
    invalidateCache();
    return { success: true };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

module.exports = {
  invalidateCache,
  getConfigWithInheritance,
  evaluateFeatureFlag,
  evaluateExperiment,
  recordConversion,
  checkCyclicDependencies,
  exportConfigs,
  importConfigs
};
