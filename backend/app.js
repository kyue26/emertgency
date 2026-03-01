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
const hospitalRoutes = require('./routes/hospitals');
const professionalRoutes = require('./routes/professionals');

const app = express();

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

module.exports = app;
