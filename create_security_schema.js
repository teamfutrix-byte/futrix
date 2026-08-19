const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Enterprise Cyber Security & SOC Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log("- Dropping existing Security tables if they exist...");
    await client.query(`
      DROP TABLE IF EXISTS public.security_patches CASCADE;
      DROP TABLE IF EXISTS public.security_vulnerabilities CASCADE;
      DROP TABLE IF EXISTS public.security_blocked_ips CASCADE;
    `);

    // 1. Create security_blocked_ips table
    console.log("- Creating public.security_blocked_ips table...");
    await client.query(`
      CREATE TABLE public.security_blocked_ips (
        ip_address VARCHAR PRIMARY KEY,
        blocked_reason TEXT NOT NULL,
        blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        expires_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log("✓ security_blocked_ips created.");

    // 2. Create security_vulnerabilities table
    console.log("- Creating public.security_vulnerabilities table...");
    await client.query(`
      CREATE TABLE public.security_vulnerabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_name VARCHAR(100) NOT NULL,
        cve_id VARCHAR(50),
        severity VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'Open',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("✓ security_vulnerabilities created.");

    // 3. Create security_patches table
    console.log("- Creating public.security_patches table...");
    await client.query(`
      CREATE TABLE public.security_patches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patch_name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        applied_at TIMESTAMP WITH TIME ZONE,
        applied_by VARCHAR(100)
      );
    `);
    console.log("✓ security_patches created.");

    // 4. Seed vulnerability indicators
    console.log("Seeding baseline vulnerability and patch reports...");
    await client.query(`
      INSERT INTO public.security_vulnerabilities (component_name, cve_id, severity, description, status)
      VALUES
        ('Node.js runtime framework', 'CVE-2024-22019', 'High', 'HTTP Request Smuggling susceptibility due to socket handling quirks.', 'Open'),
        ('PostgreSQL server instances', 'CVE-2023-51385', 'Medium', 'Client connection parameter injection vulnerabilities.', 'Open'),
        ('OpenSSL library package', 'CVE-2024-0727', 'Low', 'Null pointer dereference during certificate parsing processing.', 'Open')
    `);

    // 5. Seed patch management targets
    await client.query(`
      INSERT INTO public.security_patches (patch_name, description, status)
      VALUES
        ('Node v22 LTS security update', 'Upgrade cluster runtimes to Node 22.14.0 to resolve HTTP Smuggling CVE-2024-22019', 'Pending'),
        ('Supabase pg_transporter patch', 'Updates secure postgres parameters check configurations', 'Pending'),
        ('OpenSSL boundary sanitization update', 'Patches local boundary checks in cert handlers', 'Pending')
    `);

    console.log("✓ Seeding complete. SOC migrations finished.");

  } catch (err) {
    console.error("SOC Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
