/**
 * Enterprise Academic Intelligence Platform Database Schema Migration
 * Module 4E-4: academic_reports, report_templates, certificate_templates,
 * generated_reports, generated_certificates, report_delivery, report_history,
 * academic_insights, verification_records, future_credentials
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
  console.log('[ACADEMIC SCHEMA] Connected. Creating reporting tables...');

  // 1. academic_reports
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.academic_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type VARCHAR(50) NOT NULL, -- 'Student', 'Parent', 'Teacher', 'Institute'
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      report_metadata_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ academic_reports');

  // 2. report_templates
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.report_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_name VARCHAR(100) UNIQUE NOT NULL,
      config_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ report_templates');

  // Seed default report template
  await db.query(`
    INSERT INTO public.report_templates (template_name, config_json)
    VALUES ('Standard parent-teacher summary overview', '{"show_weak_subjects": true, "show_study_hours": true}'::jsonb)
    ON CONFLICT (template_name) DO NOTHING
  `);
  console.log('  ✓ report_templates seed');

  // 3. certificate_templates
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.certificate_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_type VARCHAR(50) UNIQUE NOT NULL, -- 'Participation', 'Completion', 'Achievement'
      template_html TEXT,
      branding_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ certificate_templates');

  // Seed default certificate templates
  await db.query(`
    INSERT INTO public.certificate_templates (certificate_type, template_html)
    VALUES
      ('Participation', '<h1>Participation Certificate</h1><p>Awarded to {{studentName}}</p>'),
      ('Achievement', '<h1>Certificate of Achievement</h1><p>Congratulations {{studentName}}</p>')
    ON CONFLICT (certificate_type) DO NOTHING
  `);
  console.log('  ✓ certificate_templates seed');

  // 4. generated_reports
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.generated_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      academic_report_id UUID REFERENCES public.academic_reports(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      report_data_json JSONB NOT NULL,
      ai_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ generated_reports');

  // 5. generated_certificates
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.generated_certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      certificate_type VARCHAR(50) NOT NULL,
      certificate_code VARCHAR(50) UNIQUE NOT NULL,
      issue_date DATE DEFAULT CURRENT_DATE,
      digital_signature TEXT,
      verification_url VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ generated_certificates');

  // 6. report_delivery
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.report_delivery (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      generated_report_id UUID REFERENCES public.generated_reports(id) ON DELETE CASCADE,
      channel VARCHAR(50) NOT NULL, -- 'Dashboard', 'Email', 'SMS'
      status VARCHAR(30) DEFAULT 'Sent', -- 'Sent', 'Failed', 'Opened'
      delivered_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ report_delivery');

  // 7. report_history
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.report_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      generated_report_id UUID REFERENCES public.generated_reports(id) ON DELETE CASCADE,
      version INTEGER DEFAULT 1,
      change_summary VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ report_history');

  // 8. academic_insights
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.academic_insights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      metric_trend VARCHAR(100) NOT NULL, -- 'Score Growth', 'Decay Warning'
      insight_details TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ academic_insights');

  // 9. verification_records
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.verification_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_code VARCHAR(50) REFERENCES public.generated_certificates(certificate_code) ON DELETE CASCADE,
      verified_by_ip VARCHAR(64),
      verified_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ verification_records');

  // 10. future_credentials
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.future_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      generated_certificate_id UUID REFERENCES public.generated_certificates(id) ON DELETE CASCADE,
      blockchain_address VARCHAR(255),
      metadata_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ future_credentials');

  // Seed future credentials configuration
  await db.query(`
    INSERT INTO public.future_credentials (blockchain_address, metadata_json)
    VALUES ('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', '{"network": "Polygon Mainnet", "credential_type": "Soulbound NFT Badge"}'::jsonb)
  `);
  console.log('  ✓ future_credentials seed');

  console.log('[ACADEMIC SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[ACADEMIC SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
