const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

const checkEventAccess = async (req, res, next) => {
  try {
    const eventId = req.body.event_id || req.query.event_id;
    if (!eventId) return next();

    const result = await pool.query(
      `SELECT e.event_id, e.status,
              EXISTS(
                SELECT 1 FROM professionals p
                JOIN camps c ON p.current_camp_id = c.camp_id
                WHERE c.event_id = e.event_id AND p.professional_id = $1
              ) as in_camp,
              (SELECT p2.current_event_id FROM professionals p2 WHERE p2.professional_id = $1) as my_current_event_id
       FROM events e WHERE e.event_id = $2`,
      [req.user.professional_id, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = result.rows[0];
    const inEvent = event.my_current_event_id === eventId;

    // Commanders can access any event; others need to be in the event (current_event_id) or in a camp in it
    if (req.user.role !== 'Commander' && !event.in_camp && !inEvent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this event'
      });
    }

    req.event = event;
    next();
  } catch (error) {
    console.error('Event access check error:', error.message);
    res.status(500).json({ success: false, message: 'Access verification failed' });
  }
};

// Log casualty status changes
const logCasualtyChange = async (client, casualtyId, professionalId, changes, previousState) => {
  try {
    await client.query(
      `INSERT INTO casualty_audit_log
       (casualty_id, changed_by, changes, previous_state, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [casualtyId, professionalId, JSON.stringify(changes), JSON.stringify(previousState)]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
    // Don't fail the request if audit logging fails, but log the error
  }
};

// GET /casualties
router.get('/', authenticateToken, [
  query('event_id').optional().trim(),
  query('camp_id').optional().trim(),
  query('color').optional().isIn(['green', 'yellow', 'red', 'black']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { event_id, camp_id, color, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE conditions safely with parameters
    const conditions = ['1=1'];
    const params = [];
    let paramCount = 1;

    // Filter by events user has access to (unless Commander): show all casualties in user's current event
    if (req.user.role !== 'Commander') {
      conditions.push(`ip.event_id = (SELECT current_event_id FROM professionals WHERE professional_id = $${paramCount++})`);
      params.push(req.user.professional_id);
    }

    if (event_id) {
      conditions.push(`ip.event_id = $${paramCount++}`);
      params.push(event_id);
    }
    if (camp_id) {
      conditions.push(`ip.camp_id = $${paramCount++}`);
      params.push(camp_id);
    }
    if (color) {
      conditions.push(`ip.color = $${paramCount++}`);
      params.push(color);
    }

    // Add pagination params
    params.push(limit, offset);

    const query = `
      SELECT ip.*,
             e.name as event_name,
             e.status as event_status,
             c.location_name as camp_location,
             c.camp_id
      FROM injured_persons ip
      LEFT JOIN events e ON ip.event_id = e.event_id
      LEFT JOIN camps c ON ip.camp_id = c.camp_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE ip.color
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          WHEN 'green' THEN 3
          WHEN 'black' THEN 4
        END,
        ip.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM injured_persons ip
      WHERE ${conditions.join(' AND ')}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)) // Exclude limit/offset from count
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      casualties: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Get casualties error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve casualties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /casualties/add
router.post('/add', authenticateToken, checkEventAccess, [
  body('event_id').notEmpty().trim(),
  body('camp_id').optional().trim(),
  body('color').isIn(['green', 'yellow', 'red', 'black']),
  body('breathing').optional().isBoolean(),
  body('conscious').optional().isBoolean(),
  body('bleeding').optional().isBoolean(),
  body('hospital_status').optional().trim().isLength({ max: 255 }),
  body('other_information').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      event_id,
      camp_id,
      color,
      breathing,
      conscious,
      bleeding,
      hospital_status,
      other_information
    } = req.body;

    await client.query('BEGIN');

    // Verify event exists and is active
    const eventCheck = await client.query(
      'SELECT event_id, status FROM events WHERE event_id = $1',
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (eventCheck.rows[0].status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot add casualties to finished events'
      });
    }

    // Verify camp exists if provided
    if (camp_id) {
      const campCheck = await client.query(
        'SELECT camp_id, event_id FROM camps WHERE camp_id = $1',
        [camp_id]
      );

      if (campCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Camp not found' });
      }

      if (campCheck.rows[0].event_id !== event_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Camp does not belong to specified event'
        });
      }
    }

    const injured_person_id = `inj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO injured_persons
       (injured_person_id, event_id, camp_id, color, breathing, conscious, bleeding,
        hospital_status, other_information, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        injured_person_id, event_id, camp_id, color,
        breathing ?? null, conscious ?? null, bleeding ?? null,
        hospital_status || null, other_information || null,
        req.user.professional_id
      ]
    );

    // Log the creation
    await logCasualtyChange(
      client,
      injured_person_id,
      req.user.professional_id,
      { action: 'created', ...req.body },
      null
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Injured person added successfully',
      casualty: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add casualty error:', error.message);

    // Handle specific errors
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({
        success: false,
        message: 'Invalid event_id or camp_id'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add casualty',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /casualties/update/:casualtyId/status
router.put('/update/:casualtyId/status', authenticateToken, [
  param('casualtyId').notEmpty().trim(),
  body('color').optional().isIn(['green', 'yellow', 'red', 'black']),
  body('breathing').optional().isBoolean(),
  body('conscious').optional().isBoolean(),
  body('bleeding').optional().isBoolean(),
  body('hospital_status').optional().trim().isLength({ max: 255 }),
  body('other_information').optional().trim().isLength({ max: 1000 }),
  body('camp_id').optional().trim()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { casualtyId } = req.params;
    const {
      color,
      breathing,
      conscious,
      bleeding,
      hospital_status,
      other_information,
      camp_id
    } = req.body;

    await client.query('BEGIN');

    // Get current state for audit log and authorization
    const currentState = await client.query(
      `SELECT ip.*, e.status as event_status
       FROM injured_persons ip
       JOIN events e ON ip.event_id = e.event_id
       WHERE ip.injured_person_id = $1`,
      [casualtyId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Casualty not found' });
    }

    const casualty = currentState.rows[0];

    // Check access: user must be in event (current_event_id) or in a camp in this event
    if (req.user.role !== 'Commander') {
      const accessCheck = await client.query(
        `SELECT 1 FROM professionals p
         WHERE p.professional_id = $1
         AND (p.current_event_id = $2
              OR EXISTS (SELECT 1 FROM camps c WHERE c.camp_id = p.current_camp_id AND c.event_id = $2))`,
        [req.user.professional_id, casualty.event_id]
      );

      if (accessCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You do not have access to modify this casualty'
        });
      }
    }

    // Prevent modification of casualties in finished events
    if (casualty.event_status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot modify casualties in finished events'
      });
    }

    // Verify new camp_id if provided
    if (camp_id && camp_id !== casualty.camp_id) {
      const campCheck = await client.query(
        'SELECT camp_id, event_id FROM camps WHERE camp_id = $1',
        [camp_id]
      );

      if (campCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Camp not found' });
      }

      if (campCheck.rows[0].event_id !== casualty.event_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer casualty to camp in different event'
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (color && color !== casualty.color) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
      changes.color = { from: casualty.color, to: color };
    }
    if (breathing !== undefined && breathing !== casualty.breathing) {
      updates.push(`breathing = $${paramCount++}`);
      values.push(breathing);
      changes.breathing = { from: casualty.breathing, to: breathing };
    }
    if (conscious !== undefined && conscious !== casualty.conscious) {
      updates.push(`conscious = $${paramCount++}`);
      values.push(conscious);
      changes.conscious = { from: casualty.conscious, to: conscious };
    }
    if (bleeding !== undefined && bleeding !== casualty.bleeding) {
      updates.push(`bleeding = $${paramCount++}`);
      values.push(bleeding);
      changes.bleeding = { from: casualty.bleeding, to: bleeding };
    }
    if (hospital_status !== undefined && hospital_status !== casualty.hospital_status) {
      updates.push(`hospital_status = $${paramCount++}`);
      values.push(hospital_status || null);
      changes.hospital_status = { from: casualty.hospital_status, to: hospital_status };
    }
    if (other_information !== undefined && other_information !== casualty.other_information) {
      updates.push(`other_information = $${paramCount++}`);
      values.push(other_information || null);
      changes.other_information = { from: casualty.other_information, to: other_information };
    }
    if (camp_id && camp_id !== casualty.camp_id) {
      updates.push(`camp_id = $${paramCount++}`);
      values.push(camp_id);
      changes.camp_id = { from: casualty.camp_id, to: camp_id };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.professional_id);
    values.push(casualtyId);

    const result = await client.query(
      `UPDATE injured_persons SET ${updates.join(', ')}
       WHERE injured_person_id = $${paramCount}
       RETURNING *`,
      values
    );

    // Log the changes
    await logCasualtyChange(
      client,
      casualtyId,
      req.user.professional_id,
      changes,
      casualty
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Casualty status updated successfully',
      casualty: result.rows[0],
      changes: Object.keys(changes)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update casualty error:', error.message);

    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid camp_id'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update casualty',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// GET /casualties/:casualtyId/history
router.get('/:casualtyId/history', authenticateToken, [
  param('casualtyId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { casualtyId } = req.params;

    // Check if casualty exists and user has access
    const casualtyCheck = await pool.query(
      `SELECT ip.event_id FROM injured_persons ip WHERE ip.injured_person_id = $1`,
      [casualtyId]
    );

    if (casualtyCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Casualty not found' });
    }

    // Get audit log
    const history = await pool.query(
      `SELECT cal.*, p.name as changed_by_name, p.role as changed_by_role
       FROM casualty_audit_log cal
       LEFT JOIN professionals p ON cal.changed_by = p.professional_id
       WHERE cal.casualty_id = $1
       ORDER BY cal.changed_at DESC`,
      [casualtyId]
    );

    res.json({
      success: true,
      history: history.rows
    });
  } catch (error) {
    console.error('Get casualty history error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve history'
    });
  }
});

// DELETE /casualties/:casualtyId
router.delete('/:casualtyId', authenticateToken, [
  param('casualtyId').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { casualtyId } = req.params;

    await client.query('BEGIN');

    // Get current state for authorization check
    const currentState = await client.query(
      `SELECT ip.*, e.status as event_status
       FROM injured_persons ip
       JOIN events e ON ip.event_id = e.event_id
       WHERE ip.injured_person_id = $1`,
      [casualtyId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Casualty not found' });
    }

    const casualty = currentState.rows[0];

    // Check access rights - only Commander or the person who created it can delete
    if (req.user.role !== 'Commander' && casualty.created_by !== req.user.professional_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this casualty'
      });
    }

    // Prevent deletion of casualties in finished events
    if (casualty.event_status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot delete casualties in finished events'
      });
    }

    // Log the deletion before removing
    await logCasualtyChange(
      client,
      casualtyId,
      req.user.professional_id,
      { action: 'deleted' },
      casualty
    );

    // Delete the casualty
    await client.query(
      'DELETE FROM injured_persons WHERE injured_person_id = $1',
      [casualtyId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Casualty deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete casualty error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete casualty',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = router;
