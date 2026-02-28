import express from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/events - Get all events
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let queryText = 'SELECT * FROM events';
    const params = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY start_time DESC';

    const result = await query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM events WHERE event_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Event not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/events - Create new event
router.post('/', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { eventId, name, location, startTime, finishTime, status } = req.body;

    const result = await query(
      `INSERT INTO events (event_id, name, location, start_time, finish_time, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [eventId, name, location || null, startTime || null, finishTime || null, status || 'upcoming', req.user.professionalId]
    );

    // Log to audit
    await query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [eventId, 'CREATE', req.user.professionalId, JSON.stringify({ name, location, startTime })]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, location, startTime, finishTime, status } = req.body;

    const result = await query(
      `UPDATE events
       SET name = COALESCE($1, name),
           location = COALESCE($2, location),
           start_time = COALESCE($3, start_time),
           finish_time = COALESCE($4, finish_time),
           status = COALESCE($5, status),
           updated_by = $6
       WHERE event_id = $7
       RETURNING *`,
      [name, location, startTime, finishTime, status, req.user.professionalId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Event not found',
      });
    }

    // Log to audit
    await query(
      `INSERT INTO event_audit_log (event_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'UPDATE', req.user.professionalId, JSON.stringify(req.body)]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', authenticate, authorize('Commander'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM events WHERE event_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Event not found',
      });
    }

    res.status(200).json({
      message: 'Event deleted successfully',
      event: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:id/statistics - Get event statistics
router.get('/:id/statistics', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM casualty_statistics_view WHERE event_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Event not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
