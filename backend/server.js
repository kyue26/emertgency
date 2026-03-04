require('dotenv').config();
const app = require('./app');
const pool = require('./config/database');

const PORT = process.env.PORT || 3000;

// Purge expired idempotency keys hourly
setInterval(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP'
    );
    if (result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} expired idempotency keys`);
    }
  } catch (err) {
    console.error('Idempotency cleanup error:', err.message);
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
