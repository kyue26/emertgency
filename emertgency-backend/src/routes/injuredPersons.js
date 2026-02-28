import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/injured-persons - Get all injured persons (filter by event)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { eventId, color, campId } = req.query;
    
    let queryText = 'SELECT * FROM injured_persons WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (eventId) {
      queryText += ` AND event_id = $${paramIndex}`;
      params.push(eventId);
      paramIndex++;
    }

    if (color) {
      queryText += ` AND color = $${paramIndex}`;
      params.push(color);
      paramIndex++;
    }

    if (campId) {
      queryText += ` AND camp_id = $${paramIndex}`;
      params.push(campId);
      paramIndex++;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/injured-persons/:id - Get injured person by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM injured_persons WHERE injured_person_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Injured person not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/injured-persons - Create new injured person record
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { injuredPersonId, eventId, campId, color, breathing, conscious, bleeding, hospitalStatus, otherInformation } = req.body;

    const result = await query(
      `INSERT INTO injured_persons (injured_person_id, event_id, camp_id, color, breathing, conscious, bleeding, hospital_status, other_information, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [injuredPersonId, eventId, campId || null, color, breathing, conscious, bleeding, hospitalStatus || null, otherInformation || null, req.user.professionalId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/injured-persons/:id - Update injured person
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { campId, color, breathing, conscious, bleeding, hospitalStatus, otherInformation } = req.body;

    // Get previous state for audit log
    const previousState = await query('SELECT * FROM injured_persons WHERE injured_person_id = $1', [id]);

    if (previousState.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Injured person not found',
      });
    }

    const result = await query(
      `UPDATE injured_persons
       SET camp_id = COALESCE($1, camp_id),
           color = COALESCE($2, color),
           breathing = COALESCE($3, breathing),
           conscious = COALESCE($4, conscious),
           bleeding = COALESCE($5, bleeding),
           hospital_status = COALESCE($6, hospital_status),
           other_information = COALESCE($7, other_information),
           updated_by = $8
       WHERE injured_person_id = $9
       RETURNING *`,
      [campId, color, breathing, conscious, bleeding, hospitalStatus, otherInformation, req.user.professionalId, id]
    );

    // Log changes to audit
    await query(
      `INSERT INTO casualty_audit_log (casualty_id, changed_by, changes, previous_state)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.professionalId, JSON.stringify(req.body), JSON.stringify(previousState.rows[0])]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/injured-persons/:id - Delete injured person
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM injured_persons WHERE injured_person_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Injured person not found',
      });
    }

    res.status(200).json({
      message: 'Injured person record deleted successfully',
      injuredPerson: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/injured-persons/:id/audit - Get audit history for injured person
router.get('/:id/audit', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM casualty_audit_log WHERE casualty_id = $1 ORDER BY changed_at DESC`,
      [id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
