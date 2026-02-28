const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../config/auth');

const router = express.Router();

// GET /drills/active - Get active drill for current user's group (or created by user if no group)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const professionalId = req.user.professional_id;

    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    const groupId = userResult.rows[0]?.group_id;

    let drillResult;
    if (groupId) {
      drillResult = await pool.query(
        `SELECT id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at
         FROM drill_sessions
         WHERE group_id = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [groupId]
      );
    } else {
      drillResult = await pool.query(
        `SELECT id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at
         FROM drill_sessions
         WHERE group_id IS NULL AND created_by = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [professionalId]
      );
    }

    if (drillResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active drill found'
      });
    }

    res.json({
      success: true,
      drill: drillResult.rows[0]
    });
  } catch (error) {
    console.error('Get active drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active drill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /drills - Create or update drill session (save as draft)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const professionalId = req.user.professional_id;
    const { drillName, location, date, roleAssignments } = req.body;
    const drill_name = drillName ?? req.body.drill_name;
    const drill_date = date ?? req.body.drill_date;

    if (!drill_name || !drill_date) {
      return res.status(400).json({
        success: false,
        message: 'Drill name and date are required'
      });
    }

    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    const groupId = userResult.rows[0]?.group_id ?? null;

    const existingDrill = groupId
      ? await pool.query(
          'SELECT id, status FROM drill_sessions WHERE group_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [groupId]
        )
      : await pool.query(
          'SELECT id, status FROM drill_sessions WHERE group_id IS NULL AND created_by = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [professionalId]
        );

    const role_assignments = roleAssignments ?? req.body.role_assignments ?? {};
    const roleAssignmentsJson = typeof role_assignments === 'string' ? role_assignments : JSON.stringify(role_assignments);

    if (existingDrill.rows.length > 0) {
      const drillId = existingDrill.rows[0].id;
      const result = await pool.query(
        `UPDATE drill_sessions
         SET drill_name = $1, location = $2, drill_date = $3, role_assignments = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
        [drill_name, location ?? null, drill_date, roleAssignmentsJson, drillId]
      );
      return res.json({
        success: true,
        message: 'Drill session updated successfully',
        drill: result.rows[0]
      });
    }

    const result = await pool.query(
      `INSERT INTO drill_sessions (drill_name, location, drill_date, created_by, group_id, role_assignments, is_active, status)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'draft')
       RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
      [drill_name, location ?? null, drill_date, professionalId, groupId, roleAssignmentsJson]
    );

    res.status(201).json({
      success: true,
      message: 'Drill session created successfully',
      drill: result.rows[0]
    });
  } catch (error) {
    console.error('Create drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create or update drill session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /drills/start - Start an active drill
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const professionalId = req.user.professional_id;
    const { drillName, location, date, roleAssignments } = req.body;
    const drill_name = drillName ?? req.body.drill_name;
    const drill_date = date ?? req.body.drill_date;

    if (!drill_name || !drill_date) {
      return res.status(400).json({
        success: false,
        message: 'Drill name and date are required'
      });
    }

    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    const groupId = userResult.rows[0]?.group_id ?? null;

    const existingDrill = groupId
      ? await pool.query(
          'SELECT id FROM drill_sessions WHERE group_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [groupId]
        )
      : await pool.query(
          'SELECT id FROM drill_sessions WHERE group_id IS NULL AND created_by = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [professionalId]
        );

    const role_assignments = roleAssignments ?? req.body.role_assignments ?? {};
    const roleAssignmentsJson = typeof role_assignments === 'string' ? role_assignments : JSON.stringify(role_assignments);

    if (existingDrill.rows.length > 0) {
      const drillId = existingDrill.rows[0].id;
      const result = await pool.query(
        `UPDATE drill_sessions
         SET drill_name = $1, location = $2, drill_date = $3, role_assignments = $4, status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
        [drill_name, location ?? null, drill_date, roleAssignmentsJson, drillId]
      );
      return res.json({
        success: true,
        message: 'Drill started successfully',
        drill: result.rows[0]
      });
    }

    const result = await pool.query(
      `INSERT INTO drill_sessions (drill_name, location, drill_date, created_by, group_id, role_assignments, is_active, status)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'active')
       RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
      [drill_name, location ?? null, drill_date, professionalId, groupId, roleAssignmentsJson]
    );

    res.status(201).json({
      success: true,
      message: 'Drill started successfully',
      drill: result.rows[0]
    });
  } catch (error) {
    console.error('Start drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to start drill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /drills/stop - Stop the active drill
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const professionalId = req.user.professional_id;

    const userResult = await pool.query(
      'SELECT group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    const groupId = userResult.rows[0]?.group_id ?? null;

    let result;
    if (groupId) {
      result = await pool.query(
        `UPDATE drill_sessions
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE group_id = $1 AND status = 'active' AND is_active = true
         RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
        [groupId]
      );
    } else {
      result = await pool.query(
        `UPDATE drill_sessions
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE group_id IS NULL AND created_by = $1 AND status = 'active' AND is_active = true
         RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
        [professionalId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active drill found to stop'
      });
    }

    res.json({
      success: true,
      message: 'Drill stopped successfully',
      drill: result.rows[0]
    });
  } catch (error) {
    console.error('Stop drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to stop drill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /drills/:id - Update drill session
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { drillName, location, date, roleAssignments } = req.body;
    const drill_name = drillName ?? req.body.drill_name;
    const drill_date = date ?? req.body.drill_date;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (drill_name !== undefined) {
      updates.push(`drill_name = $${paramCount++}`);
      values.push(drill_name);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (drill_date !== undefined) {
      updates.push(`drill_date = $${paramCount++}`);
      values.push(drill_date);
    }
    if (roleAssignments !== undefined || req.body.role_assignments !== undefined) {
      const ra = roleAssignments ?? req.body.role_assignments ?? {};
      updates.push(`role_assignments = $${paramCount++}`);
      values.push(typeof ra === 'string' ? ra : JSON.stringify(ra));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE drill_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, drill_name, location, drill_date, role_assignments, status, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Drill session not found'
      });
    }

    res.json({
      success: true,
      message: 'Drill session updated successfully',
      drill: result.rows[0]
    });
  } catch (error) {
    console.error('Update drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update drill session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /drills/:id - Deactivate drill session
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE drill_sessions SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Drill session not found'
      });
    }

    res.json({
      success: true,
      message: 'Drill session deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate drill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate drill session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
