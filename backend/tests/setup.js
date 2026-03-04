const { execSync } = require('child_process');
const path = require('path');
const { Pool } = require('pg');

const TEST_DB = 'emertgency_test';
const CONN = `postgresql://emert:emertpass@localhost:5432`;

let pool;

// Runs once before all test suites
module.exports = async function globalSetup() {
  // 1. Drop and recreate the test database
  const adminPool = new Pool({ connectionString: `${CONN}/postgres` });
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB} OWNER emert`);
  } finally {
    await adminPool.end();
  }

  // 2. Run schema + migrations via psql
  const backendDir = path.resolve(__dirname, '..');
  const connStr = `${CONN}/${TEST_DB}`;

  execSync(`psql "${connStr}" -f "${path.join(backendDir, 'create-schema.sql')}"`, {
    stdio: 'pipe'
  });
  execSync(`psql "${connStr}" -f "${path.join(backendDir, 'migrations', '001_offline_sync.sql')}"`, {
    stdio: 'pipe'
  });
  execSync(`psql "${connStr}" -f "${path.join(backendDir, 'migrations', '002_add_missing_tables.sql')}"`, {
    stdio: 'pipe'
  });
};
