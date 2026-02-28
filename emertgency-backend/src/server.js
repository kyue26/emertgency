import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import eventRoutes from './routes/events.js';
import professionalRoutes from './routes/professionals.js';
import groupRoutes from './routes/groups.js';
import campRoutes from './routes/camps.js';
import injuredPersonRoutes from './routes/injuredPersons.js';
import taskRoutes from './routes/tasks.js';
import hospitalRoutes from './routes/hospitals.js';
import authRoutes from './routes/auth.js';
import casualtyRoutes from './routes/casualties.js';
import resourceRoutes from './routes/resources.js';
import drillRoutes from './routes/drills.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS – allow Vite dev ports; mobile/Expo often sends no origin, which we allow
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigin.includes(',') ? corsOrigin.split(',').map(o => o.trim()) : [corsOrigin];
if (!allowedOrigins.includes('http://localhost:5174')) allowedOrigins.push('http://localhost:5174');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/injured-persons', injuredPersonRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/casualties', casualtyRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/drills', drillRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

export default app;
