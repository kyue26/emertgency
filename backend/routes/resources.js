const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../config/auth');

const router = express.Router();

// Check if user has access to the event
const checkEventAccess = async (req, res, next) => {
  try {
    const eventId = req.body.event_id || req.query.event_id || req.params.eventId;
    if (!eventId) return next();

    const result = await pool.query(
      `SELECT e.event_id, e.status,
              EXISTS(
                SELECT 1 FROM professionals p
                JOIN camps c ON p.current_camp_id = c.camp_id
                WHERE c.event_id = e.event_id AND p.professional_id = $1
              ) as has_access
       FROM events e WHERE e.event_id = $2`,
      [req.user.professional_id, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = result.rows[0];

    // Commanders can access any event, others need to be assigned
    if (req.user.role !== 'Commander' && !event.has_access) {
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

// Log resource request changes
const logResourceChange = async (client, resourceRequestId, professionalId, action, details) => {
  try {
    await client.query(
      `INSERT INTO resource_request_audit_log
       (resource_request_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [resourceRequestId, action, professionalId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

// GET /resources - Get all resource requests
router.get('/', authenticateToken, [
  query('event_id').optional().trim(),
  query('confirmed').optional().isBoolean().toBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { event_id, confirmed, priority, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const conditions = ['1=1'];
    const params = [];
    let paramCount = 1;

    // Filter by events user has access to (unless Commander)
    if (req.user.role !== 'Commander') {
      conditions.push(`EXISTS(
        SELECT 1 FROM camps c
        JOIN professionals p ON p.current_camp_id = c.camp_id
        WHERE c.event_id = rr.event_id
        AND p.professional_id = $${paramCount++}
      )`);
      params.push(req.user.professional_id);
    }

    if (event_id) {
      conditions.push(`rr.event_id = $${paramCount++}`);
      params.push(event_id);
    }
    if (confirmed !== undefined) {
      conditions.push(`rr.confirmed = $${paramCount++}`);
      params.push(confirmed);
    }
    if (priority) {
      conditions.push(`rr.priority = $${paramCount++}`);
      params.push(priority);
    }

    params.push(limit, offset);

    const queryText = `
      SELECT rr.*,
             e.name as event_name,
             e.status as event_status,
             p_req.name as requested_by_name,
             p_conf.name as confirmed_by_name
      FROM resource_requests rr
      LEFT JOIN events e ON rr.event_id = e.event_id
      LEFT JOIN professionals p_req ON rr.requested_by = p_req.professional_id
      LEFT JOIN professionals p_conf ON rr.confirmed_by = p_conf.professional_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE rr.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        rr.confirmed ASC,
        rr.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM resource_requests rr
      WHERE ${conditions.join(' AND ')}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(queryText, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      resourceRequests: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Get resource requests error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /resources/:resourceRequestId - Get single resource request
router.get('/:resourceRequestId', authenticateToken, [
  param('resourceRequestId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { resourceRequestId } = req.params;

    const result = await pool.query(
      `SELECT rr.*,
              e.name as event_name,
              e.status as event_status,
              p_req.name as requested_by_name,
              p_req.email as requested_by_email,
              p_conf.name as confirmed_by_name
       FROM resource_requests rr
       LEFT JOIN events e ON rr.event_id = e.event_id
       LEFT JOIN professionals p_req ON rr.requested_by = p_req.professional_id
       LEFT JOIN professionals p_conf ON rr.confirmed_by = p_conf.professional_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Resource request not found' });
    }

    // Get audit history
    const history = await pool.query(
      `SELECT ral.*, p.name as changed_by_name
       FROM resource_request_audit_log ral
       LEFT JOIN professionals p ON ral.changed_by = p.professional_id
       WHERE ral.resource_request_id = $1
       ORDER BY ral.changed_at DESC`,
      [resourceRequestId]
    );

    res.json({
      success: true,
      resourceRequest: result.rows[0],
      history: history.rows
    });
  } catch (error) {
    console.error('Get resource request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /resources/create - Create new resource request
router.post('/create', authenticateToken, checkEventAccess, [
  body('event_id').notEmpty().trim(),
  body('resource_name').notEmpty().trim().isLength({ min: 2, max: 255 }),
  body('quantity').optional().isInt({ min: 1, max: 10000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('time_of_arrival').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      event_id,
      resource_name,
      quantity,
      priority,
      time_of_arrival,
      notes
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

    if (eventCheck.rows[0].status === 'finished' || eventCheck.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot create resource requests for finished or cancelled events'
      });
    }

    const resource_request_id = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO resource_requests
       (resource_request_id, event_id, resource_name, quantity, priority, 
        time_of_arrival, notes, requested_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        resource_request_id,
        event_id,
        resource_name,
        quantity || 1,
        priority || 'medium',
        time_of_arrival || null,
        notes || null,
        req.user.professional_id
      ]
    );

    // Log creation
    await logResourceChange(
      client,
      resource_request_id,
      req.user.professional_id,
      'created',
      { resource_name, quantity: quantity || 1, priority: priority || 'medium' }
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Resource request created successfully',
      resourceRequest: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create resource request error:', error.message);

    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid event_id'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create resource request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /resources/update/:resourceRequestId - Update resource request
router.put('/update/:resourceRequestId', authenticateToken, [
  param('resourceRequestId').notEmpty().trim(),
  body('resource_name').optional().notEmpty().trim().isLength({ min: 2, max: 255 }),
  body('quantity').optional().isInt({ min: 1, max: 10000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('time_of_arrival').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { resourceRequestId } = req.params;
    const { resource_name, quantity, priority, time_of_arrival, notes } = req.body;

    await client.query('BEGIN');

    // Get current state
    const currentState = await client.query(
      `SELECT rr.*, e.status as event_status
       FROM resource_requests rr
       JOIN events e ON rr.event_id = e.event_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Resource request not found' });
    }

    const resourceRequest = currentState.rows[0];

    // Check access rights
    if (req.user.role !== 'Commander' && resourceRequest.requested_by !== req.user.professional_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You can only modify your own resource requests'
      });
    }

    // Prevent modification of requests in finished events
    if (resourceRequest.event_status === 'finished' || resourceRequest.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot modify resource requests in finished or cancelled events'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (resource_name && resource_name !== resourceRequest.resource_name) {
      updates.push(`resource_name = $${paramCount++}`);
      values.push(resource_name);
      changes.resource_name = { from: resourceRequest.resource_name, to: resource_name };
    }
    if (quantity !== undefined && quantity !== resourceRequest.quantity) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
      changes.quantity = { from: resourceRequest.quantity, to: quantity };
    }
    if (priority && priority !== resourceRequest.priority) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
      changes.priority = { from: resourceRequest.priority, to: priority };
    }
    if (time_of_arrival !== undefined) {
      updates.push(`time_of_arrival = $${paramCount++}`);
      values.push(time_of_arrival || null);
      changes.time_of_arrival = { from: resourceRequest.time_of_arrival, to: time_of_arrival };
    }
    if (notes !== undefined && notes !== resourceRequest.notes) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes || null);
      changes.notes = { from: resourceRequest.notes, to: notes };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(resourceRequestId);

    const result = await client.query(
      `UPDATE resource_requests SET ${updates.join(', ')}
       WHERE resource_request_id = $${paramCount}
       RETURNING *`,
      values
    );

    // Log changes
    await logResourceChange(
      client,
      resourceRequestId,
      req.user.professional_id,
      'updated',
      changes
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Resource request updated successfully',
      resourceRequest: result.rows[0],
      changes: Object.keys(changes)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update resource request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update resource request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /resources/confirm/:resourceRequestId - Confirm/unconfirm resource request
router.put('/confirm/:resourceRequestId', authenticateToken, [
  param('resourceRequestId').notEmpty().trim(),
  body('confirmed').isBoolean(),
  body('time_of_arrival').optional().isISO8601().toDate()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { resourceRequestId } = req.params;
    const { confirmed, time_of_arrival } = req.body;

    await client.query('BEGIN');

    // Get current state
    const currentState = await client.query(
      `SELECT rr.*, e.status as event_status
       FROM resource_requests rr
       JOIN events e ON rr.event_id = e.event_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Resource request not found' });
    }

    const resourceRequest = currentState.rows[0];

    // Prevent modification of requests in finished events
    if (resourceRequest.event_status === 'finished' || resourceRequest.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm resource requests in finished or cancelled events'
      });
    }

    const updates = ['confirmed = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [confirmed];
    let paramCount = 2;

    if (confirmed) {
      updates.push(`confirmed_by = $${paramCount++}`);
      values.push(req.user.professional_id);
      
      if (time_of_arrival) {
        updates.push(`time_of_arrival = $${paramCount++}`);
        values.push(time_of_arrival);
      }
    } else {
      updates.push('confirmed_by = NULL');
    }

    values.push(resourceRequestId);

    const result = await client.query(
      `UPDATE resource_requests SET ${updates.join(', ')}
       WHERE resource_request_id = $${paramCount}
       RETURNING *`,
      values
    );

    // Log confirmation change
    await logResourceChange(
      client,
      resourceRequestId,
      req.user.professional_id,
      confirmed ? 'confirmed' : 'unconfirmed',
      { confirmed, time_of_arrival }
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Resource request ${confirmed ? 'confirmed' : 'unconfirmed'} successfully`,
      resourceRequest: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Confirm resource request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm resource request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /resources/delete/:resourceRequestId - Delete resource request
router.delete('/delete/:resourceRequestId', authenticateToken, [
  param('resourceRequestId').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { resourceRequestId } = req.params;

    await client.query('BEGIN');

    // Get current state
    const currentState = await client.query(
      `SELECT rr.*, e.status as event_status
       FROM resource_requests rr
       JOIN events e ON rr.event_id = e.event_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Resource request not found' });
    }

    const resourceRequest = currentState.rows[0];

    // Check access rights - only creator or Commander can delete
    if (req.user.role !== 'Commander' && resourceRequest.requested_by !== req.user.professional_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own resource requests'
      });
    }

    // Prevent deletion of requests in finished events
    if (resourceRequest.event_status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot delete resource requests in finished events'
      });
    }

    // Log deletion before removing
    await logResourceChange(
      client,
      resourceRequestId,
      req.user.professional_id,
      'deleted',
      { resource_name: resourceRequest.resource_name }
    );

    // Delete the resource request
    await client.query(
      'DELETE FROM resource_requests WHERE resource_request_id = $1',
      [resourceRequestId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Resource request deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete resource request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// GET /resources/event/:eventId/summary - Get resource summary for an event
router.get('/event/:eventId/summary', authenticateToken, checkEventAccess, [
  param('eventId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;

    const summary = await pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN confirmed = true THEN 1 END) as confirmed_requests,
        COUNT(CASE WHEN confirmed = false THEN 1 END) as pending_requests,
        COUNT(CASE WHEN priority = 'critical' AND confirmed = false THEN 1 END) as critical_pending,
        COUNT(CASE WHEN priority = 'high' AND confirmed = false THEN 1 END) as high_pending,
        SUM(quantity) as total_quantity,
        SUM(CASE WHEN confirmed = true THEN quantity ELSE 0 END) as confirmed_quantity
       FROM resource_requests
       WHERE event_id = $1`,
      [eventId]
    );

    const byPriority = await pool.query(
      `SELECT priority, confirmed, COUNT(*) as count, SUM(quantity) as total_quantity
       FROM resource_requests
       WHERE event_id = $1
       GROUP BY priority, confirmed
       ORDER BY 
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END`,
      [eventId]
    );

    res.json({
      success: true,
      summary: summary.rows[0],
      byPriority: byPriority.rows
    });
  } catch (error) {
    console.error('Get resource summary error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;