import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as store from '../store/index.js';

const router = express.Router();

router.get('/active', authenticate, async (req, res, next) => {
  try {
    const drill = await store.getActiveDrill();
    if (!drill) {
      return res.status(404).json({ message: 'No active drill found' });
    }
    res.json(drill);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { drillName, location, date, roleAssignments } = req.body;
    if (!drillName || !date) {
      return res.status(400).json({ message: 'Drill name and date are required' });
    }
    const drill = {
      id: 'drill-1',
      drill_name: drillName,
      location: location || '',
      drill_date: date,
      role_assignments: roleAssignments || {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.setActiveDrill(drill);
    res.status(201).json(drill);
  } catch (error) {
    next(error);
  }
});

export default router;
