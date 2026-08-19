const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Data & SRE DR Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Alter public.infra_db_backups to add metadata columns
    console.log("- Altering public.infra_db_backups table...");
    await client.query(`
      ALTER TABLE public.infra_db_backups 
      ADD COLUMN IF NOT EXISTS backup_type VARCHAR(50) DEFAULT 'Full',
      ADD COLUMN IF NOT EXISTS encryption_status VARCHAR(50) DEFAULT 'AES-256',
      ADD COLUMN IF NOT EXISTS checksum_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(50) DEFAULT 'Verified',
      ADD COLUMN IF NOT EXISTS validation_report JSONB;
    `);
    console.log("✓ public.infra_db_backups altered.");

    // 2. Create public.infra_database_registry table
    console.log("- Creating public.infra_database_registry table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_database_registry (
        id VARCHAR PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        purpose VARCHAR(100) NOT NULL,
        primary_node VARCHAR(100) NOT NULL,
        replica_nodes TEXT[] DEFAULT '{}'::TEXT[],
        health_score INT DEFAULT 100,
        status VARCHAR(50) DEFAULT 'Online'
      );
    `);
    console.log("✓ public.infra_database_registry created.");

    // 3. Create public.infra_dr_failover_history table
    console.log("- Creating public.infra_dr_failover_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.infra_dr_failover_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        primary_node VARCHAR(100) NOT NULL,
        promoted_replica VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Success',
        failover_time TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("✓ public.infra_dr_failover_history created.");

    // 4. Seed databases registry
    console.log("Seeding databases registry...");
    await client.query(`
      INSERT INTO public.infra_database_registry (id, display_name, purpose, primary_node, replica_nodes, health_score, status)
      VALUES
        ('postgres_prod', 'PostgreSQL Production', 'Operational Database', 'db-primary-01.c.teamfutrix.internal', ARRAY['db-replica-01.c.teamfutrix.internal', 'db-replica-02.c.teamfutrix.internal'], 100, 'Online'),
        ('redis_cache', 'Redis distributed cache', 'Active Session Cache & Queues', 'redis-master.c.teamfutrix.internal', ARRAY['redis-slave.c.teamfutrix.internal'], 100, 'Online'),
        ('elasticsearch_idx', 'ElasticSearch indexes cluster', 'Search indexing & autocomplete', 'es-master-01.c.teamfutrix.internal', ARRAY['es-replica-01.c.teamfutrix.internal'], 100, 'Online')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log("✓ Seeding complete. SRE Data Platform migrations finished.");

  } catch (err) {
    console.error("SRE Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
