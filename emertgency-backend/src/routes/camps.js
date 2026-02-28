import express from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/camps - Get all camps (optionally filter by event)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.query;
    
    let queryText = 'SELECT * FROM camps';
    const params = [];

    if (eventId) {
      queryText += ' WHERE event_id = $1';
      params.push(eventId);
    }

    queryText += ' ORDER BY location_name';

    const result = await query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/camps/:id - Get camp by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM camps WHERE camp_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Camp not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/camps - Create new camp
router.post('/', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { campId, eventId, locationName, capacity } = req.body;

    const result = await query(
      `INSERT INTO camps (camp_id, event_id, location_name, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [campId, eventId, locationName, capacity || null, req.user.professionalId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/camps/:id - Update camp
router.put('/:id', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locationName, capacity } = req.body;

    const result = await query(
      `UPDATE camps
       SET location_name = COALESCE($1, location_name),
           capacity = COALESCE($2, capacity),
           updated_by = $3
       WHERE camp_id = $4
       RETURNING *`,
      [locationName, capacity, req.user.professionalId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Camp not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/camps/:id - Delete camp
router.delete('/:id', authenticate, authorize('Commander'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM camps WHERE camp_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Camp not found',
      });
    }

    res.status(200).json({
      message: 'Camp deleted successfully',
      camp: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
