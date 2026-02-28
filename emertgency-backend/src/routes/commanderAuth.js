import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import * as store from '../store/index.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'commander-memory-secret-change-in-production';

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required' });
    }
    const professional = await store.findProfessionalByEmail(email);
    if (!professional) {
      return res.status(401).json({ error: 'Authentication Error', message: 'Invalid email or password' });
    }
    const passwordMatch = await bcrypt.compare(password, professional.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Authentication Error', message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { professionalId: professional.professional_id, email: professional.email, role: professional.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    res.status(200).json({
      message: 'Login successful',
      token,
      professional: {
        professionalId: professional.professional_id,
        name: professional.name,
        email: professional.email,
        role: professional.role,
        groupId: professional.group_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const professional = await store.findProfessionalById(req.user.professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Not Found', message: 'Professional not found' });
    }
    const { password_hash, ...rest } = professional;
    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
});

export default router;
