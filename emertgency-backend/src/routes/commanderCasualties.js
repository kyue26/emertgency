import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as store from '../store/index.js';

const router = express.Router();

router.get('/statistics', authenticate, async (req, res, next) => {
  try {
    const data = await store.getCasualtyStatistics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
