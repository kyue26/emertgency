const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

const requireCommander = (req, res, next) => {
  if (req.user.role !== 'Commander') {
    return res.status(403).json({ 
      success: false, 
      message: 'Only commanders can manage events' 
    });
  }
  next();
};

// Validate status transitions
const VALID_STATUS_TRANSITIONS = {
  'upcoming': ['in_progress', 'cancelled'],
  'in_progress': ['finished', 'cancelled'],
  'finished': [],
  'cancelled': []
};

const validateStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

// GET /events
router.get('/', authenticateToken, [
  query('status').optional().isIn(['upcoming', 'in_progress', 'finished', 'cancelled']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`e.status = $${paramCount++}`);
      params.push(status);
    }

    params.push(limit, offset);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT e.*,
             COUNT(DISTINCT c.camp_id) as camp_count,
             COUNT(DISTINCT ip.injured_person_id) as casualty_count,
             COUNT(DISTINCT p.professional_id) as professional_count
      FROM events e
      LEFT JOIN camps c ON e.event_id = c.event_id
      LEFT JOIN injured_persons ip ON e.event_id = ip.event_id
      LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
      ${whereClause}
      GROUP BY e.event_id
      ORDER BY e.start_time DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const countQuery = `SELECT COUNT(*) as total FROM events e ${whereClause}`;

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      events: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Get events error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /events/:eventId
router.get('/:eventId', authenticateToken, [
  param('eventId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;

    const result = await pool.query(
      `SELECT e.*,
              COUNT(DISTINCT c.camp_id) as camp_count,
              COUNT(DISTINCT ip.injured_person_id) as casualty_count,
              COUNT(DISTINCT p.professional_id) as professional_count,
              json_agg(DISTINCT jsonb_build_object(
                'camp_id', c.camp_id,
                'location_name', c.location_name,
                'capacity', c.capacity
              )) FILTER (WHERE c.camp_id IS NOT NULL) as camps
       FROM events e
       LEFT JOIN camps c ON e.event_id = c.event_id
       LEFT JOIN injured_persons ip ON e.event_id = ip.event_id
       LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
       WHERE e.event_id = $1
       GROUP BY e.event_id`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({
      success: true,
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Get event error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /events/create
router.post('/create', authenticateToken, requireCommander, [
  body('name').notEmpty().trim().isLength({ min: 3, max: 200 }),
  body('location').optional().trim().isLength({ max: 500 }),
  body('start_time').optional().isISO8601().toDate(),
  body('finish_time').optional().isISO8601().toDate(),
  body('status').optional().isIn(['upcoming', 'in_progress', 'finished', 'cancelled'])
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, location, start_time, finish_time, status } = req.body;

    // Validate time logic
    if (start_time && finish_time) {
      const startDate = new Date(start_time);
      const finishDate = new Date(finish_time);
      
      if (finishDate <= startDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'finish_time must be after start_time' 
        });
      }
    }

    // Validate initial status
    const initialStatus = status || 'upcoming';
    if (initialStatus === 'finished' || initialStatus === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot create event with finished or cancelled status' 
      });
    }

    await client.query('BEGIN');

    const event_id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO events (event_id, name, location, start_time, finish_time, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING *`,
      [event_id, name, location || null, start_time || null, finish_time || null, initialStatus, req.user.professional_id]
    );

    // Log event creation
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [event_id, 'created', req.user.professional_id, JSON.stringify({ name, location, status: initialStatus })]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Event creation error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Event creation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /events/update/:eventId
router.put('/update/:eventId', authenticateToken, requireCommander, [
  param('eventId').notEmpty().trim(),
  body('name').optional().notEmpty().trim().isLength({ min: 3, max: 200 }),
  body('location').optional().trim().isLength({ max: 500 }),
  body('start_time').optional().isISO8601().toDate(),
  body('finish_time').optional().isISO8601().toDate(),
  body('status').optional().isIn(['upcoming', 'in_progress', 'finished', 'cancelled'])
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;
    const { name, location, start_time, finish_time, status } = req.body;

    await client.query('BEGIN');

    // Get current event state
    const currentEvent = await client.query(
      'SELECT * FROM events WHERE event_id = $1',
      [eventId]
    );

    if (currentEvent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = currentEvent.rows[0];

    // Validate status transition
    if (status && status !== event.status) {
      if (!validateStatusTransition(event.status, status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: `Cannot transition from ${event.status} to ${status}. Valid transitions: ${VALID_STATUS_TRANSITIONS[event.status].join(', ')}` 
        });
      }
    }

    // Validate time logic
    const newStartTime = start_time || event.start_time;
    const newFinishTime = finish_time || event.finish_time;

    if (newStartTime && newFinishTime) {
      const startDate = new Date(newStartTime);
      const finishDate = new Date(newFinishTime);
      
      if (finishDate <= startDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'finish_time must be after start_time' 
        });
      }
    }

    // Prevent modifications to finished events (except status changes to reopen)
    if (event.status === 'finished' && status !== 'in_progress') {
      if (name || location || start_time || finish_time) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot modify finished events except to reopen them' 
        });
      }
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (name && name !== event.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
      changes.name = { from: event.name, to: name };
    }
    if (location !== undefined && location !== event.location) {
      updates.push(`location = $${paramCount++}`);
      values.push(location || null);
      changes.location = { from: event.location, to: location };
    }
    if (start_time && start_time !== event.start_time) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(start_time);
      changes.start_time = { from: event.start_time, to: start_time };
    }
    if (finish_time && finish_time !== event.finish_time) {
      updates.push(`finish_time = $${paramCount++}`);
      values.push(finish_time);
      changes.finish_time = { from: event.finish_time, to: finish_time };
    }
    if (status && status !== event.status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      changes.status = { from: event.status, to: status };

      // Auto-set finish_time when marking as finished
      if (status === 'finished' && !event.finish_time) {
        updates.push(`finish_time = CURRENT_TIMESTAMP`);
        changes.finish_time = { from: null, to: 'now' };
      }
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.professional_id);
    values.push(eventId);

    const result = await client.query(
      `UPDATE events SET ${updates.join(', ')} 
       WHERE event_id = $${paramCount} RETURNING *`,
      values
    );

    // Log the update
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [eventId, 'updated', req.user.professional_id, JSON.stringify(changes)]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: result.rows[0],
      changes: Object.keys(changes)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Event update error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Event update failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /events/delete/:eventId
router.delete('/delete/:eventId', authenticateToken, requireCommander, [
  param('eventId').notEmpty().trim(),
  query('force').optional().isBoolean().toBoolean()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;
    const { force } = req.query;

    await client.query('BEGIN');

    // Check if event exists
    const eventCheck = await client.query(
      'SELECT * FROM events WHERE event_id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = eventCheck.rows[0];

    // Check for associated data
    const associatedData = await client.query(
      `SELECT 
        (SELECT COUNT(*) FROM camps WHERE event_id = $1) as camp_count,
        (SELECT COUNT(*) FROM injured_persons WHERE event_id = $1) as casualty_count,
        (SELECT COUNT(*) FROM tasks WHERE event_id = $1) as task_count
      `,
      [eventId]
    );

    const { camp_count, casualty_count, task_count } = associatedData.rows[0];
    const hasData = parseInt(camp_count) > 0 || parseInt(casualty_count) > 0 || parseInt(task_count) > 0;

    if (hasData && !force) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Event has associated data (camps, casualties, or tasks). Use ?force=true to delete anyway.',
        details: {
          camps: parseInt(camp_count),
          casualties: parseInt(casualty_count),
          tasks: parseInt(task_count)
        }
      });
    }

    // Prevent deletion of active events without force
    if (event.status === 'in_progress' && !force) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete active event. Use ?force=true to delete anyway.' 
      });
    }

    // Delete event (cascade should handle related records)
    await client.query('DELETE FROM events WHERE event_id = $1', [eventId]);

    // Log deletion
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [eventId, 'deleted', req.user.professional_id, JSON.stringify({ 
        event_name: event.name, 
        force,
        deleted_data: { camps: camp_count, casualties: casualty_count, tasks: task_count }
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Event deleted successfully',
      deleted_data: {
        camps: parseInt(camp_count),
        casualties: parseInt(casualty_count),
        tasks: parseInt(task_count)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Event delete error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Event deletion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// POST /events/:eventId/camps/create
router.post('/:eventId/camps/create', authenticateToken, requireCommander, [
  param('eventId').notEmpty().trim(),
  body('location_name').notEmpty().trim().isLength({ min: 2, max: 200 }),
  body('capacity').optional().isInt({ min: 0, max: 10000 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;
    const { location_name, capacity } = req.body;

    await client.query('BEGIN');

    // Verify event exists and is not finished
    const eventCheck = await client.query(
      'SELECT event_id, status FROM events WHERE event_id = $1',
      [eventId]
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

    const camp_id = `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO camps (camp_id, event_id, location_name, capacity, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
      [camp_id, eventId, location_name, capacity || null, req.user.professional_id]
    );

    // Log camp creation
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [eventId, 'camp_created', req.user.professional_id, JSON.stringify({ camp_id, location_name })]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Camp created successfully',
      camp: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Camp creation error:', error.message);
    
    if (error.code === '23503') {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
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

// PUT /events/:eventId/camps/update/:campId
router.put('/:eventId/camps/update/:campId', authenticateToken, requireCommander, [
  param('eventId').notEmpty().trim(),
  param('campId').notEmpty().trim(),
  body('location_name').optional().notEmpty().trim().isLength({ min: 2, max: 200 }),
  body('capacity').optional().isInt({ min: 0, max: 10000 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId, campId } = req.params;
    const { location_name, capacity } = req.body;

    await client.query('BEGIN');

    // Get current camp state
    const campCheck = await client.query(
      `SELECT c.*, e.status as event_status,
              COUNT(p.professional_id) as assigned_professionals
       FROM camps c
       JOIN events e ON c.event_id = e.event_id
       LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
       WHERE c.camp_id = $1 AND c.event_id = $2
       GROUP BY c.camp_id, e.status`,
      [campId, eventId]
    );

    if (campCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Camp not found' });
    }

    const camp = campCheck.rows[0];

    // Prevent modifications to camps in finished events
    if (camp.event_status === 'finished' || camp.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot modify camps in finished or cancelled events' 
      });
    }

    // Check if reducing capacity below current assignments
    if (capacity !== undefined && capacity < camp.assigned_professionals) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reduce capacity to ${capacity}. Currently has ${camp.assigned_professionals} professionals assigned.` 
      });
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (location_name && location_name !== camp.location_name) {
      updates.push(`location_name = $${paramCount++}`);
      values.push(location_name);
      changes.location_name = { from: camp.location_name, to: location_name };
    }
    if (capacity !== undefined && capacity !== camp.capacity) {
      updates.push(`capacity = $${paramCount++}`);
      values.push(capacity);
      changes.capacity = { from: camp.capacity, to: capacity };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.professional_id);
    values.push(campId, eventId);

    const result = await client.query(
      `UPDATE camps SET ${updates.join(', ')} 
       WHERE camp_id = $${paramCount} AND event_id = $${paramCount + 1} RETURNING *`,
      values
    );

    // Log the update
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [eventId, 'camp_updated', req.user.professional_id, JSON.stringify({ camp_id: campId, changes })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Camp updated successfully',
      camp: result.rows[0],
      changes: Object.keys(changes)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Camp update error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Camp update failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /events/:eventId/camps/delete/:campId
router.delete('/:eventId/camps/delete/:campId', authenticateToken, requireCommander, [
  param('eventId').notEmpty().trim(),
  param('campId').notEmpty().trim(),
  query('force').optional().isBoolean().toBoolean()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId, campId } = req.params;
    const { force } = req.query;

    await client.query('BEGIN');

    // Check camp and its associations
    const campCheck = await client.query(
      `SELECT c.*, e.status as event_status,
              COUNT(DISTINCT p.professional_id) as professional_count,
              COUNT(DISTINCT ip.injured_person_id) as casualty_count
       FROM camps c
       JOIN events e ON c.event_id = e.event_id
       LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
       LEFT JOIN injured_persons ip ON ip.camp_id = c.camp_id
       WHERE c.camp_id = $1 AND c.event_id = $2
       GROUP BY c.camp_id, e.status`,
      [campId, eventId]
    );

    if (campCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Camp not found' });
    }

    const camp = campCheck.rows[0];
    const professionalCount = parseInt(camp.professional_count);
    const casualtyCount = parseInt(camp.casualty_count);

    // Prevent deletion if camp has assignments without force flag
    if ((professionalCount > 0 || casualtyCount > 0) && !force) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Camp has assigned professionals or casualties. Use ?force=true to delete anyway.',
        details: {
          professionals: professionalCount,
          casualties: casualtyCount
        }
      });
    }

    // Unassign professionals if force delete
    if (professionalCount > 0) {
      await client.query(
        'UPDATE professionals SET current_camp_id = NULL WHERE current_camp_id = $1',
        [campId]
      );
    }

    // Unassign casualties if force delete
    if (casualtyCount > 0) {
      await client.query(
        'UPDATE injured_persons SET camp_id = NULL WHERE camp_id = $1',
        [campId]
      );
    }

    // Delete camp
    await client.query(
      'DELETE FROM camps WHERE camp_id = $1 AND event_id = $2',
      [campId, eventId]
    );

    // Log deletion
    await client.query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [eventId, 'camp_deleted', req.user.professional_id, JSON.stringify({ 
        camp_id: campId, 
        location_name: camp.location_name,
        force,
        unassigned: { professionals: professionalCount, casualties: casualtyCount }
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Camp deleted successfully',
      unassigned: {
        professionals: professionalCount,
        casualties: casualtyCount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Camp delete error:', error.message);
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