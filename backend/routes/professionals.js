const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// GET /professionals - Get all professionals
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT professional_id, name, email, phone_number, role, group_id,
              current_event_id, current_camp_id, created_at, updated_at
       FROM professionals
       ORDER BY name`
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

// GET /professionals/:id/tasks - Must be before /:id so "tasks" is matched
router.get('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM professional_task_summary WHERE professional_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    res.json({
      success: true,
      taskSummary: result.rows[0]
    });
  } catch (error) {
    console.error('Get professional tasks error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve professional task summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /professionals/:id - Get professional by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT professional_id, name, email, phone_number, role, group_id,
              current_event_id, current_camp_id, created_at, updated_at
       FROM professionals
       WHERE professional_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    res.json({
      success: true,
      professional: result.rows[0]
    });
  } catch (error) {
    console.error('Get professional error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve professional',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /professionals/:id - Update professional
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phoneNumber,
      phone_number,
      role,
      groupId,
      group_id,
      currentCampId,
      current_camp_id,
      currentEventId,
      current_event_id
    } = req.body;

    // Only Commander can update other users; users can update own profile (limited fields)
    const isSelf = req.user.professional_id === id;
    const isCommander = req.user.role === 'Commander';

    if (!isSelf && !isCommander) {
      return res.status(403).json({
        success: false,
        message: 'Only commanders can update other professionals'
      });
    }

    const result = await pool.query(
      `UPDATE professionals
       SET name = COALESCE($1, name),
           phone_number = COALESCE($2, phone_number),
           role = COALESCE($3, role),
           group_id = COALESCE($4, group_id),
           current_camp_id = COALESCE($5, current_camp_id),
           current_event_id = COALESCE($6, current_event_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE professional_id = $7
       RETURNING professional_id, name, email, phone_number, role, group_id, current_event_id, current_camp_id, created_at, updated_at`,
      [
        name ?? null,
        phoneNumber ?? phone_number ?? null,
        role ?? null,
        groupId ?? group_id ?? null,
        currentCampId ?? current_camp_id ?? null,
        currentEventId ?? current_event_id ?? null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    res.json({
      success: true,
      message: 'Professional updated successfully',
      professional: result.rows[0]
    });
  } catch (error) {
    console.error('Update professional error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update professional',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
