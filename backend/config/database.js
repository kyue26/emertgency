const pg = require('pg');
const { Pool, types } = pg;

// OID 1114 = TIMESTAMP WITHOUT TIME ZONE.
//
// Problem: the pg driver assumes the server's local timezone for both
// directions, silently shifting every value by the UTC offset.
//
// Read fix  – interpret bare timestamps coming FROM Postgres as UTC:
types.setTypeParser(1114, (str) => new Date(str + 'Z'));
//
// Write fix – serialize JS Date objects going TO Postgres as UTC:
pg.defaults.parseInputDatesAsUTC = true;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=UTC',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;