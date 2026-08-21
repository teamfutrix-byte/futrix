/**
 * Centralized Enterprise Database Configuration
 * Integrates environment variables with default production overrides
 */
const { Client, Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '6543'),
  user: process.env.DB_USER || 'postgres.dsduytkikxfgiyptdwex',
  password: process.env.DB_PASSWORD || '$anjana@123man',
  database: process.env.DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
};

// Create a single shared pool
const pool = new Pool({
  ...dbConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err);
});

function getDbClient() {
  let pooledClient = null;
  return {
    async connect() {
      if (!pooledClient) {
        pooledClient = await pool.connect();
      }
    },
    async query(text, params) {
      if (pooledClient) {
        return pooledClient.query(text, params);
      } else {
        return pool.query(text, params);
      }
    },
    async end() {
      if (pooledClient) {
        pooledClient.release();
        pooledClient = null;
      }
    }
  };
}

module.exports = {
  dbConfig,
  getDbClient,
  pool
};
