import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login - Authenticate professional
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
      });
    }

    // Get professional and password
    const result = await query(
      `SELECT p.professional_id, p.name, p.email, p.role, p.group_id, 
              pp.password_hash, pp.failed_login_attempts, pp.locked_until
       FROM professionals p
       INNER JOIN professional_passwords pp ON p.professional_id = pp.professional_id
       WHERE p.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid email or password',
      });
    }

    const professional = result.rows[0];

    // Check if account is locked
    if (professional.locked_until && new Date(professional.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Account Locked',
        message: 'Account is temporarily locked due to too many failed login attempts',
        lockedUntil: professional.locked_until,
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, professional.password_hash);

    if (!passwordMatch) {
      // Increment failed login attempts
      await query(
        `UPDATE professional_passwords 
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE 
               WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
               ELSE NULL
             END
         WHERE professional_id = $1`,
        [professional.professional_id]
      );

      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid email or password',
      });
    }

    // Reset failed login attempts on successful login
    await query(
      `UPDATE professional_passwords 
       SET failed_login_attempts = 0, locked_until = NULL
       WHERE professional_id = $1`,
      [professional.professional_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        professionalId: professional.professional_id,
        email: professional.email,
        role: professional.role,
      },
      process.env.JWT_SECRET,
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

// POST /api/auth/register - Register new professional (public)
router.post('/register', async (req, res, next) => {
  try {
    const { professionalId, name, email, password, phoneNumber, role } = req.body;

    if (!professionalId || !name || !email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Professional ID, name, email, and password are required',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Begin transaction
    const client = await query('BEGIN');

    try {
      // Insert professional
      await query(
        `INSERT INTO professionals (professional_id, name, email, phone_number, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [professionalId, name, email, phoneNumber || null, role || 'MERT Member']
      );

      // Insert password
      await query(
        `INSERT INTO professional_passwords (professional_id, password_hash)
         VALUES ($1, $2)`,
        [professionalId, passwordHash]
      );

      await query('COMMIT');

      res.status(201).json({
        message: 'Professional registered successfully',
        professional: {
          professionalId,
          name,
          email,
          role: role || 'MERT Member',
        },
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT professional_id, name, email, phone_number, role, group_id, current_camp_id, created_at
       FROM professionals
       WHERE professional_id = $1`,
      [req.user.professionalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Professional not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Current password and new password are required',
      });
    }

    // Get current password hash
    const result = await query(
      `SELECT password_hash FROM professional_passwords WHERE professional_id = $1`,
      [req.user.professionalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Password record not found',
      });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      `UPDATE professional_passwords 
       SET password_hash = $1, last_password_change = NOW(), updated_at = NOW()
       WHERE professional_id = $2`,
      [newPasswordHash, req.user.professionalId]
    );

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
