require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/group');
const eventRoutes = require('./routes/event');
const casualtyRoutes = require('./routes/casualties');
const taskRoutes = require('./routes/tasks');
const analyticsRoutes = require('./routes/analytics');
const resourceRoutes = require('./routes/resources');
const shiftRoutes = require('./routes/shifts');
const syncRoutes = require('./routes/sync');
const campRoutes = require('./routes/camps');
const drillRoutes = require('./routes/drills');
const hospitalRoutes = require('./routes/hospitals');
const professionalRoutes = require('./routes/professionals');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/event', eventRoutes);
app.use('/events', eventRoutes);
app.use('/casualties', casualtyRoutes);
app.use('/tasks', taskRoutes);
app.use('/resources', resourceRoutes);
app.use('/shifts', shiftRoutes);
app.use('/sync', syncRoutes);
app.use('/camps', campRoutes);
app.use('/drills', drillRoutes);
app.use('/hospitals', hospitalRoutes);
app.use('/professionals', professionalRoutes);
app.use('/', analyticsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

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