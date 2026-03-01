const { Pool } = require('pg');

const TEST_DB = 'emertgency_test';
const CONN = `postgresql://emert:emertpass@localhost:5432`;

module.exports = async function globalTeardown() {
  const adminPool = new Pool({ connectionString: `${CONN}/postgres` });
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  } finally {
    await adminPool.end();
  }
};
