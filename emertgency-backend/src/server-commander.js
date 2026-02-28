/**
 * Commander-only server: runs without PostgreSQL using in-memory store.
 * Use for mobile commander flow. Start with: npm run dev:commander
 * Login: commander@test.com / commander123
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import commanderAuth from './routes/commanderAuth.js';
import commanderDrills from './routes/commanderDrills.js';
import commanderCasualties from './routes/commanderCasualties.js';
import commanderResources from './routes/commanderResources.js';
import commanderProfessionals from './routes/commanderProfessionals.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'commander-memory-secret-change-in-production';
}

const app = express();
const PORT = process.env.PORT || 5010;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), mode: 'commander-memory' });
});

app.use('/api/auth', commanderAuth);
app.use('/api/drills', commanderDrills);
app.use('/api/casualties', commanderCasualties);
app.use('/api/resources', commanderResources);
app.use('/api/professionals', commanderProfessionals);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Commander server (in-memory) on port ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`📧 Login: commander@test.com / commander123`);
});

export default app;
