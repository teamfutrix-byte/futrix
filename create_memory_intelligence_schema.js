const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Memory Intelligence Schema Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create knowledge_nodes table
    console.log("- Creating public.knowledge_nodes table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_name VARCHAR(100) NOT NULL,
        node_type VARCHAR(50) DEFAULT 'Concept', -- 'Subject', 'Chapter', 'Topic', 'Concept', 'Formula'
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Create knowledge_edges table
    console.log("- Creating public.knowledge_edges table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.knowledge_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
        target_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) DEFAULT 'Related', -- 'Prerequisite', 'Dependency', 'Related'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 3. Create learning_velocity table
    console.log("- Creating public.learning_velocity table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.learning_velocity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        learning_speed_index NUMERIC DEFAULT 1.0,
        revision_speed_index NUMERIC DEFAULT 1.0,
        mastery_speed_index NUMERIC DEFAULT 1.0,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 4. Create memory_reports table
    console.log("- Creating public.memory_reports table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        report_type VARCHAR(50) DEFAULT 'Student', -- 'Student', 'Parent', 'Teacher'
        content_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 5. Create memory_insights table
    console.log("- Creating public.memory_insights table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.memory_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        strongest_subject VARCHAR(50),
        weakest_chapter VARCHAR(100),
        most_forgotten_topic VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    console.log("Enterprise Memory Intelligence Schema Migrations completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
