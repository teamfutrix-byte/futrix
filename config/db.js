/**
 * Centralized Enterprise Database Configuration
 * Integrates environment variables with default production overrides
 */
const { Client } = require('pg');

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

function getDbClient() {
  return new Client(dbConfig);
}

module.exports = {
  dbConfig,
  getDbClient
};
