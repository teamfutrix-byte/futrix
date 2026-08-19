/**
 * Database Performance Indexes Stabilization
 * Creates indexes on foreign keys to support fast dashboard queries and stats aggregations.
 */
const { Client } = require('pg');
const { dbConfig } = require('./config/db');

async function migrate() {
  const db = new Client(dbConfig);
  await db.connect();
  console.log('[PERFORMANCE INDEXES] Connected. Creating high-performance indexes...');

  // Create indexes to optimize student query filters
  await db.query('CREATE INDEX IF NOT EXISTS idx_results_user_id ON public.results(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_results_test_id ON public.results(test_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_id ON public.assessment_sessions(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_student_analytics_user_id ON public.student_analytics(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON public.generated_reports(user_id)');

  console.log('[PERFORMANCE INDEXES] All indexes created successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[PERFORMANCE INDEXES] Migration failed:', err.stack);
  process.exit(1);
});
