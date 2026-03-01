const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../config/auth');

const router = express.Router();

// GET /camps - Get all camps (optionally filter by event)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.query;

    let queryText = 'SELECT * FROM camps';
    const params = [];

    if (eventId) {
      queryText += ' WHERE event_id = $1';
      params.push(eventId);
    }

    queryText += ' ORDER BY location_name';

    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      camps: result.rows
    });
  } catch (error) {
    console.error('Get camps error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve camps',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /camps/:id - Get camp by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM camps WHERE camp_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Camp not found'
      });
    }

    res.json({
      success: true,
      camp: result.rows[0]
    });
  } catch (error) {
    console.error('Get camp error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve camp',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /camps - Create new camp
router.post('/', authenticateToken, authorize('Commander', 'Medical Officer'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { campId, eventId, locationName, capacity } = req.body;
    const location_name = locationName || req.body.location_name;
    const event_id = eventId || req.body.event_id;

    if (!event_id || !location_name) {
      return res.status(400).json({
        success: false,
        message: 'eventId and locationName (or location_name) are required'
      });
    }

    await client.query('BEGIN');

    // Verify event exists and is not finished
    const eventCheck = await client.query(
      'SELECT event_id, status FROM events WHERE event_id = $1',
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (eventCheck.rows[0].status === 'finished' || eventCheck.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot add camps to finished or cancelled events'
      });
    }

    const camp_id = campId || `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO camps (camp_id, event_id, location_name, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [camp_id, event_id, location_name, capacity ?? null, req.user.professional_id]
    );

    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [event_id, 'camp_created', req.user.professional_id, JSON.stringify({ camp_id, location_name })]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Camp created successfully',
      camp: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create camp error:', error.message);

    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Camp ID already exists' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Event not found' });
    }

    res.status(500).json({
      success: false,
      message: 'Camp creation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /camps/:id - Update camp
router.put('/:id', authenticateToken, authorize('Commander', 'Medical Officer'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { locationName, capacity } = req.body;
    const location_name = locationName ?? req.body.location_name;

    await client.query('BEGIN');

    const campCheck = await client.query(
      `SELECT c.*, e.status as event_status,
              (SELECT COUNT(*) FROM professionals p WHERE p.current_camp_id = c.camp_id) as assigned_professionals
       FROM camps c
       JOIN events e ON c.event_id = e.event_id
       WHERE c.camp_id = $1`,
      [id]
    );

    if (campCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Camp not found' });
    }

    const camp = campCheck.rows[0];

    if (camp.event_status === 'finished' || camp.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot modify camps in finished or cancelled events'
      });
    }

    const newCapacity = capacity ?? req.body.capacity;
    if (newCapacity !== undefined && newCapacity < parseInt(camp.assigned_professionals, 10)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity below ${camp.assigned_professionals} (current assignments)`
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (location_name !== undefined) {
      updates.push(`location_name = $${paramCount++}`);
      values.push(location_name);
    }
    if (newCapacity !== undefined) {
      updates.push(`capacity = $${paramCount++}`);
      values.push(newCapacity);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`, `updated_by = $${paramCount++}`);
    values.push(req.user.professional_id, id);

    const result = await client.query(
      `UPDATE camps SET ${updates.join(', ')} WHERE camp_id = $${paramCount} RETURNING *`,
      values
    );

    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [camp.event_id, 'camp_updated', req.user.professional_id, JSON.stringify(req.body)]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Camp updated successfully',
      camp: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update camp error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Camp update failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /camps/:id - Delete camp
router.delete('/:id', authenticateToken, authorize('Commander'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const campCheck = await client.query(
      `SELECT c.*, e.status as event_status,
              (SELECT COUNT(*) FROM professionals p WHERE p.current_camp_id = c.camp_id) as professional_count,
              (SELECT COUNT(*) FROM injured_persons ip WHERE ip.camp_id = c.camp_id) as casualty_count
       FROM camps c
       JOIN events e ON c.event_id = e.event_id
       WHERE c.camp_id = $1`,
      [id]
    );

    if (campCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Camp not found'
      });
    }

    const camp = campCheck.rows[0];
    const professionalCount = parseInt(camp.professional_count, 10);
    const casualtyCount = parseInt(camp.casualty_count, 10);

    if ((professionalCount > 0 || casualtyCount > 0) && !force) {
      return res.status(400).json({
        success: false,
        message: 'Camp has assigned professionals or casualties. Use ?force=true to delete anyway.',
        details: {
          professionals: professionalCount,
          casualties: casualtyCount
        }
      });
    }

    await client.query('BEGIN');

    if (professionalCount > 0) {
      await client.query(
        'UPDATE professionals SET current_camp_id = NULL WHERE current_camp_id = $1',
        [id]
      );
    }
    if (casualtyCount > 0) {
      await client.query(
        'UPDATE injured_persons SET camp_id = NULL WHERE camp_id = $1',
        [id]
      );
    }

    const result = await client.query(
      'DELETE FROM camps WHERE camp_id = $1 RETURNING *',
      [id]
    );

    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [camp.event_id, 'camp_deleted', req.user.professional_id, JSON.stringify({
        camp_id: id,
        location_name: camp.location_name,
        force,
        unassigned: { professionals: professionalCount, casualties: casualtyCount }
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Camp deleted successfully',
      camp: result.rows[0],
      unassigned: {
        professionals: professionalCount,
        casualties: casualtyCount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete camp error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Camp deletion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = router;
