const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// Validate JWT_SECRET exists and is strong
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

const loginAttempts = new Map();

const generateToken = (professional) => {
  return jwt.sign(
    { 
      professional_id: professional.professional_id,
      email: professional.email,
      role: professional.role,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Rate limiting middleware
const checkLoginAttempts = (email) => {
  const attempts = loginAttempts.get(email);
  if (!attempts) return true;

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeLeft = LOCKOUT_TIME - (Date.now() - attempts.firstAttempt);
    if (timeLeft > 0) {
      return false;
    } else {
      // Reset after lockout period
      loginAttempts.delete(email);
      return true;
    }
  }
  return true;
};

const recordLoginAttempt = (email, success) => {
  if (success) {
    loginAttempts.delete(email);
    return;
  }

  const attempts = loginAttempts.get(email) || { count: 0, firstAttempt: Date.now() };
  attempts.count++;
  
  if (attempts.count === 1) {
    attempts.firstAttempt = Date.now();
  }
  
  loginAttempts.set(email, attempts);
};

// POST /auth/register
router.post('/register', [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('phone_number').optional().isMobilePhone(),
  body('role').optional().isIn(['MERT Member', 'Commander', 'Medical Officer'])
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone_number, role } = req.body;

    // Checking email domain
    const allowedDomains = ['@pennmert.org', '@publicsafety.upenn.edu'];
    if (!allowedDomains.some(domain => email.endsWith(domain))) {
      return res.status(400).json({
        success: false,
        message: 'Registration is restricted to Penn MERT and Public Safety emails only.'
      });
    }
    
    await client.query('BEGIN');

    // Check if user already exists with UNIQUE constraint instead of SELECT
    const professional_id = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      // Insert new professional
      const newUser = await client.query(
        `INSERT INTO professionals (professional_id, name, email, phone_number, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING professional_id, name, email, role`,
        [professional_id, name, email, phone_number, role || 'MERT Member']
      );

      // Store password
      await client.query(
        `INSERT INTO professional_passwords (professional_id, password_hash, created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [professional_id, hashedPassword]
      );

      await client.query('COMMIT');

      const token = generateToken(newUser.rows[0]);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          professional_id: newUser.rows[0].professional_id,
          name: newUser.rows[0].name,
          email: newUser.rows[0].email,
          role: newUser.rows[0].role
        }
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      
      // Check for unique constraint violation
      if (dbError.code === '23505') { // Postgres unique violation
        return res.status(409).json({ 
          success: false, 
          message: 'User already exists' 
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Registration error:', error.message); // Don't log full error
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// POST /auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check rate limiting
    if (!checkLoginAttempts(email)) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many login attempts. Please try again later.' 
      });
    }

    // Find user
    const result = await pool.query(
      `SELECT p.professional_id, p.name, p.email, p.role, pp.password_hash 
       FROM professionals p
       LEFT JOIN professional_passwords pp ON p.professional_id = pp.professional_id
       WHERE p.email = $1`,
      [email]
    );

    // Use constant-time comparison to prevent timing attacks
    let isValidPassword = false;
    let user = null;

    if (result.rows.length > 0) {
      user = result.rows[0];
      if (user.password_hash) {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      }
    } else {
      // Perform dummy bcrypt to prevent timing attack
      await bcrypt.compare(password, '$2b$12$dummyhashtopreventtimingattack1234567890123456');
    }

    if (!isValidPassword || !user) {
      recordLoginAttempt(email, false);
      // Generic error message - don't reveal if email exists
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    recordLoginAttempt(email, true);

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        professional_id: user.professional_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// POST /auth/change-password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const professional_id = req.user.professional_id;

    // Verify current password
    const result = await client.query(
      `SELECT password_hash FROM professional_passwords WHERE professional_id = $1`,
      [professional_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await client.query('BEGIN');

    // Update password
    await client.query(
      `UPDATE professional_passwords 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE professional_id = $2`,
      [hashedPassword, professional_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Change password error:', error.message);
    res.status(500).json({ success: false, message: 'Password change failed' });
  } finally {
    client.release();
  }
});

// PUT /auth/update
router.put('/update', authenticateToken, [
  body('name').optional().notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone_number').optional().isMobilePhone(),
  body('role').optional().isIn(['MERT Member', 'Commander', 'Medical Officer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone_number, role } = req.body;
    const professional_id = req.user.professional_id;

    // Don't allow email changes without verification (security risk)
    if (email && email !== req.user.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email changes require verification. Please contact support.' 
      });
    }

    // Don't allow role self-escalation
    if (role && role !== req.user.role && req.user.role !== 'Commander') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only commanders can change roles' 
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (phone_number) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(phone_number);
    }
    if (role && req.user.role === 'Commander') {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(professional_id);

    const result = await pool.query(
      `UPDATE professionals SET ${updates.join(', ')} 
       WHERE professional_id = $${paramCount} 
       RETURNING professional_id, name, email, phone_number, role`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update error:', error.message);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// GET /auth/professionals
router.get('/professionals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        professional_id,
        name,
        email,
        phone_number,
        role,
        current_event_id,
        current_camp_id,
        group_id,
        created_at,
        updated_at
       FROM professionals
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      professionals: result.rows
    });
  } catch (error) {
    console.error('Get professionals error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve professionals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /auth/delete/:userId
router.delete('/delete/:userId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;

    // Check if user has permission
    if (req.user.professional_id !== userId && req.user.role !== 'Commander') {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    await client.query('BEGIN');

    // Delete password first (foreign key cascade should handle this, but being explicit)
    await client.query(
      'DELETE FROM professional_passwords WHERE professional_id = $1', 
      [userId]
    );

    // Delete user
    await client.query(
      'DELETE FROM professionals WHERE professional_id = $1', 
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete error:', error.message);
    res.status(500).json({ success: false, message: 'Delete failed' });
  } finally {
    client.release();
  }
});

module.exports = router;