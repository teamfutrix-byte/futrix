/**
 * Centralized Enterprise Database Configuration
 * Integrates environment variables with default production overrides
 */
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '$anjana@123man',
  database: process.env.DB_NAME || 'postgres'
};

function getDbClient() {
  return new Client(dbConfig);
}

module.exports = {
  dbConfig,
  getDbClient
};
