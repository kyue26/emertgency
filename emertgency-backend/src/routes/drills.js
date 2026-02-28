import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/drills/active - Get active drill for current user's group
router.get('/active', authenticate, async (req, res, next) => {
  try {
    const { professionalId } = req.user;

    // Get user's group_id
    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    if (!userResult.rows[0]?.group_id) {
      return res.status(404).json({ message: 'No active drill found' });
    }

    const groupId = userResult.rows[0].group_id;

    // Get active drill for this group
    const drillResult = await pool.query(
      `SELECT id, drill_name, location, drill_date, role_assignments, created_at, updated_at
       FROM drill_sessions
       WHERE group_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [groupId]
    );

    if (drillResult.rows.length === 0) {
      return res.status(404).json({ message: 'No active drill found' });
    }

    res.json(drillResult.rows[0]);
  } catch (error) {
    console.error('Error fetching active drill:', error);
    next(error);
  }
});

// POST /api/drills - Create or update drill session
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { professionalId } = req.user;
    const { drillName, location, date, roleAssignments } = req.body;

    // Validation
    if (!drillName || !date) {
      return res.status(400).json({ message: 'Drill name and date are required' });
    }

    // Get user's group_id
    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    const groupId = userResult.rows[0]?.group_id;

    // Deactivate any existing active drills for this group
    if (groupId) {
      await pool.query(
        'UPDATE drill_sessions SET is_active = false WHERE group_id = $1 AND is_active = true',
        [groupId]
      );
    }

    // Create new drill session
    const result = await pool.query(
      `INSERT INTO drill_sessions (drill_name, location, drill_date, created_by, group_id, role_assignments, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, drill_name, location, drill_date, role_assignments, created_at, updated_at`,
      [drillName, location, date, professionalId, groupId, JSON.stringify(roleAssignments || {})]
    );

    res.status(201).json({
      message: 'Drill session created successfully',
      drill: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating drill session:', error);
    next(error);
  }
});

// PUT /api/drills/:id - Update drill session
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { drillName, location, date, roleAssignments } = req.body;

    const result = await pool.query(
      `UPDATE drill_sessions
       SET drill_name = $1, location = $2, drill_date = $3, role_assignments = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, drill_name, location, drill_date, role_assignments, created_at, updated_at`,
      [drillName, location, date, JSON.stringify(roleAssignments || {}), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Drill session not found' });
    }

    res.json({
      message: 'Drill session updated successfully',
      drill: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating drill session:', error);
    next(error);
  }
});

// DELETE /api/drills/:id - Delete/deactivate drill session
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE drill_sessions SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Drill session not found' });
    }

    res.json({ message: 'Drill session deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating drill session:', error);
    next(error);
  }
});

export default router;
