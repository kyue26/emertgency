require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/group');
const eventRoutes = require('./routes/event');
const campRoutes = require('./routes/camps');
const casualtyRoutes = require('./routes/casualties');
const taskRoutes = require('./routes/tasks');
const analyticsRoutes = require('./routes/analytics');
const resourceRoutes = require('./routes/resources');
const shiftRoutes = require('./routes/shifts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/events', eventRoutes);
app.use('/camps', campRoutes);
app.use('/casualties', casualtyRoutes);
app.use('/tasks', taskRoutes);
app.use('/resources', resourceRoutes);
app.use('/shifts', shiftRoutes);
app.use('/', analyticsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});