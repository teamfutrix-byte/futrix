/**
 * Enterprise AI Performance Analytics Engine Database Schema Migration
 * Module 4E-3: student_analytics, student_learning_profiles, subject_analytics,
 * chapter_analytics, topic_analytics, student_prediction_models, study_recommendations,
 * teacher_analytics, institute_analytics, learning_insights
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
  console.log('[AI ANALYTICS SCHEMA] Connected. Creating analytics tables...');

  // 1. student_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.student_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
      overall_score NUMERIC(6,2) DEFAULT 0.00,
      accuracy_pct NUMERIC(5,2) DEFAULT 0.00,
      avg_speed_sec NUMERIC(8,2) DEFAULT 0.00,
      retention_score NUMERIC(5,2) DEFAULT 100.00,
      focus_score NUMERIC(5,2) DEFAULT 80.00,
      consistency_score NUMERIC(5,2) DEFAULT 85.00,
      exam_readiness_score NUMERIC(5,2) DEFAULT 0.00,
      learning_velocity NUMERIC(5,2) DEFAULT 1.00,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ student_analytics');

  // 2. student_learning_profiles
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.student_learning_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
      study_goal VARCHAR(255) DEFAULT 'NEET AIR < 1000',
      learning_style VARCHAR(50) DEFAULT 'Visual-Interactive',
      daily_study_hours NUMERIC(4,2) DEFAULT 4.00,
      target_exam_date DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ student_learning_profiles');

  // 3. subject_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.subject_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      subject VARCHAR(50) NOT NULL,
      score_avg NUMERIC(6,2) DEFAULT 0.00,
      accuracy_pct NUMERIC(5,2) DEFAULT 0.00,
      avg_speed_sec NUMERIC(8,2) DEFAULT 0.00,
      retention_score NUMERIC(5,2) DEFAULT 100.00,
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_user_subject_analytics UNIQUE (user_id, subject)
    )
  `);
  console.log('  ✓ subject_analytics');

  // 4. chapter_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.chapter_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      subject VARCHAR(50) NOT NULL,
      chapter VARCHAR(100) NOT NULL,
      questions_attempted INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      wrong INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      avg_time_sec NUMERIC(8,2) DEFAULT 0.00,
      retention_pct NUMERIC(5,2) DEFAULT 100.00,
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_user_chapter_analytics UNIQUE (user_id, subject, chapter)
    )
  `);
  console.log('  ✓ chapter_analytics');

  // 5. topic_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.topic_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      subject VARCHAR(50) NOT NULL,
      chapter VARCHAR(100) NOT NULL,
      topic VARCHAR(100) NOT NULL,
      mastery_pct NUMERIC(5,2) DEFAULT 0.00,
      mistake_frequency INTEGER DEFAULT 0,
      retention_probability NUMERIC(5,2) DEFAULT 100.00,
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_user_topic_analytics UNIQUE (user_id, subject, chapter, topic)
    )
  `);
  console.log('  ✓ topic_analytics');

  // 6. student_prediction_models
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.student_prediction_models (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      expected_score NUMERIC(6,2),
      expected_rank INTEGER,
      expected_percentile NUMERIC(5,2),
      exam_success_probability NUMERIC(5,2),
      confidence_score NUMERIC(5,2) DEFAULT 80.00,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ student_prediction_models');

  // 7. study_recommendations
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.study_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      recommendation_type VARCHAR(50) NOT NULL,
      priority INTEGER DEFAULT 1,
      reasoning TEXT,
      is_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ study_recommendations');

  // 8. teacher_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.teacher_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      class_accuracy_pct NUMERIC(5,2) DEFAULT 0.00,
      syllabus_completion_pct NUMERIC(5,2) DEFAULT 0.00,
      engagement_score NUMERIC(5,2) DEFAULT 80.00,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ teacher_analytics');

  // 9. institute_analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.institute_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      institute_id UUID UNIQUE NOT NULL,
      active_students INTEGER DEFAULT 0,
      avg_accuracy_pct NUMERIC(5,2) DEFAULT 0.00,
      premium_adoption_pct NUMERIC(5,2) DEFAULT 0.00,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ institute_analytics');

  // Seed default institute analytics
  await db.query(`
    INSERT INTO public.institute_analytics (institute_id, active_students, avg_accuracy_pct, premium_adoption_pct)
    VALUES ('11111111-1111-1111-1111-111111111111', 120, 72.50, 45.00)
    ON CONFLICT (institute_id) DO NOTHING
  `);
  console.log('  ✓ institute_analytics seed');

  // 10. learning_insights
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.learning_insights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      insight_text TEXT NOT NULL,
      insight_type VARCHAR(50) DEFAULT 'General', -- 'Improvement', 'Warning', 'Strategy'
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('  ✓ learning_insights');

  console.log('[AI ANALYTICS SCHEMA] All tables migrated successfully.');
  await db.end();
}

migrate().catch(err => {
  console.error('[AI ANALYTICS SCHEMA] Migration failed:', err.stack);
  process.exit(1);
});
