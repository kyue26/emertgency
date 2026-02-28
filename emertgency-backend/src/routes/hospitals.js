import express from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/hospitals - Get all active hospitals
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { isActive } = req.query;
    
    let queryText = 'SELECT * FROM hospitals';
    const params = [];

    if (isActive !== undefined) {
      queryText += ' WHERE is_active = $1';
      params.push(isActive === 'true');
    }

    queryText += ' ORDER BY trauma_level, name';

    const result = await query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/hospitals/:id - Get hospital by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM hospitals WHERE hospital_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Hospital not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/hospitals - Create new hospital
router.post('/', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { name, distance, traumaLevel, capacity, contactNumber, address, isActive } = req.body;

    const result = await query(
      `INSERT INTO hospitals (name, distance, trauma_level, capacity, contact_number, address, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, distance || null, traumaLevel || null, capacity || null, contactNumber || null, address || null, isActive !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/hospitals/:id - Update hospital
router.put('/:id', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, distance, traumaLevel, capacity, contactNumber, address, isActive } = req.body;

    const result = await query(
      `UPDATE hospitals
       SET name = COALESCE($1, name),
           distance = COALESCE($2, distance),
           trauma_level = COALESCE($3, trauma_level),
           capacity = COALESCE($4, capacity),
           contact_number = COALESCE($5, contact_number),
           address = COALESCE($6, address),
           is_active = COALESCE($7, is_active)
       WHERE hospital_id = $8
       RETURNING *`,
      [name, distance, traumaLevel, capacity, contactNumber, address, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Hospital not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/hospitals/:id - Delete hospital
router.delete('/:id', authenticate, authorize('Commander'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM hospitals WHERE hospital_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Hospital not found',
      });
    }

    res.status(200).json({
      message: 'Hospital deleted successfully',
      hospital: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
