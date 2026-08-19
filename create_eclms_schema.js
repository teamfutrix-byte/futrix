/**
 * Enterprise Content Lifecycle Management System (ECLMS) Database Schema Migration
 * Module 4D-2: content_versions, content_history, approval_queue, content_review_queue,
 * content_archive, recycle_bin, restore_jobs, content_governance, dependency_map,
 * lifecycle_audit_logs
 */
const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  const db = new Client(dbConfig);
  await db.connect();
  console.log('[ECLMS SCHEMA] Connected. Altering and creating lifecycle tables...');

  // 1. Alter existing content_versions to support generic content types
  await db.query(`
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'Question';
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS content_id VARCHAR(100);
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS editor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS ai_validation_json JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'Draft';
    ALTER TABLE public.content_versions ADD COLUMN IF NOT EXISTS content_data_json JSONB DEFAULT '{}'::jsonb;
  `);
  console.log('  ✓ content_versions (altered)');

  // 2. content_history
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL, -- 'Created', 'Drafted', 'Approved', 'Published', 'Archived', 'Deleted', 'Restored'
      actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      details_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_history');

  // 3. approval_queue
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.approval_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      submitter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      status VARCHAR(30) DEFAULT 'Pending Review', -- 'Pending AI Validation', 'Pending Admin Review', 'Approved', 'Rejected', 'Changes Requested'
      ai_feedback_json JSONB DEFAULT '{}'::jsonb,
      reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      reviewer_feedback TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ approval_queue');

  // 4. content_review_queue
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_review_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      approval_queue_id UUID REFERENCES public.approval_queue(id) ON DELETE CASCADE,
      priority INTEGER DEFAULT 1,
      assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_review_queue');

  // 5. content_archive
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_archive (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      reason TEXT,
      archive_rule TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_archive');

  // 6. recycle_bin (generic content recycle bin)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.recycle_bin (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      content_name TEXT,
      deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      deleted_at TIMESTAMPTZ DEFAULT now(),
      reason TEXT,
      previous_location TEXT,
      dependencies_json JSONB DEFAULT '[]'::jsonb
    )
  `);
  console.log('  ✓ recycle_bin');

  // 7. restore_jobs
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.restore_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restore_type VARCHAR(50) DEFAULT 'Single', -- 'Single', 'Bulk', 'Batch', 'Date'
      items_restored_count INTEGER DEFAULT 0,
      restored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      restore_criteria_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ restore_jobs');

  // 8. content_governance
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.content_governance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      publisher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      archiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      remover_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ content_governance');

  // 9. dependency_map
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.dependency_map (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      dependent_content_type VARCHAR(50) NOT NULL,
      dependent_content_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ dependency_map');

  // 10. lifecycle_audit_logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.lifecycle_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type VARCHAR(50) NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      from_state VARCHAR(50),
      to_state VARCHAR(50),
      changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ lifecycle_audit_logs');

  console.log('[ECLMS SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[ECLMS SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
