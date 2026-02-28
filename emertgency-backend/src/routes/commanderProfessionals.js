import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as store from '../store/index.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const rows = await store.listProfessionals();
    res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const professional = await store.findProfessionalById(req.params.id);
    if (!professional) {
      return res.status(404).json({ error: 'Not Found', message: 'Professional not found' });
    }
    const { password_hash, ...rest } = professional;
    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const updated = await store.updateProfessional(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Not Found', message: 'Professional not found' });
    }
    const { password_hash, ...rest } = updated;
    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
});

export default router;
