process.env.DATABASE_URL = 'postgresql://emert:emertpass@localhost:5432/emertgency_test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000
};
