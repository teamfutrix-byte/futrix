const { Client } = require('pg');
const crypto = require('crypto');

async function testInserts() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  const userId = '19f30ebf-1fed-4b72-911c-54927cd8047c'; // our seeded user id
  const sessionId = crypto.randomUUID();

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    // Test 1: auth.audit_log_entries
    console.log("Testing insert into auth.audit_log_entries...");
    try {
      await client.query(`
        INSERT INTO auth.audit_log_entries (id, instance_id, payload, created_at)
        VALUES ($1, '00000000-0000-0000-0000-000000000000', '{"action": "login"}', now())
      `, [crypto.randomUUID()]);
      console.log("[✓] auth.audit_log_entries insert passed.");
    } catch (err) {
      console.error("[✗] auth.audit_log_entries failed:", err.message);
    }

    // Test 2: auth.sessions
    console.log("Testing insert into auth.sessions...");
    try {
      await client.query(`
        INSERT INTO auth.sessions (
          id, user_id, created_at, updated_at, aal, refresh_token_hmac_key
        ) VALUES (
          $1, $2, now(), now(), 'aal1', 'dummykey'
        )
      `, [sessionId, userId]);
      console.log("[✓] auth.sessions insert passed.");
    } catch (err) {
      console.error("[✗] auth.sessions failed:", err.message);
    }

    // Test 3: auth.refresh_tokens
    console.log("Testing insert into auth.refresh_tokens...");
    try {
      await client.query(`
        INSERT INTO auth.refresh_tokens (
          instance_id, id, token, user_id, revoked, created_at, updated_at, session_id
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          nextval('auth.refresh_tokens_id_seq'),
          'dummytokenhash',
          $1,
          false,
          now(),
          now(),
          $2
        )
      `, [userId, sessionId]);
      console.log("[✓] auth.refresh_tokens insert passed.");
    } catch (err) {
      console.error("[✗] auth.refresh_tokens failed:", err.message);
    }

    // Clean up
    console.log("Cleaning up test rows...");
    await client.query('DELETE FROM auth.refresh_tokens WHERE token = \'dummytokenhash\'');
    await client.query('DELETE FROM auth.sessions WHERE id = $1', [sessionId]);

  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    await client.end();
  }
}

testInserts();
