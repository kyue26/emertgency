import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/professionals - Get all professionals
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT professional_id, name, email, phone_number, role, group_id, current_camp_id, created_at, updated_at
       FROM professionals
       ORDER BY name`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/professionals/:id - Get professional by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT professional_id, name, email, phone_number, role, group_id, current_camp_id, created_at, updated_at
       FROM professionals
       WHERE professional_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Professional not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/professionals/:id/tasks - Get tasks for professional
router.get('/:id/tasks', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM professional_task_summary WHERE professional_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Professional not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/professionals/:id - Update professional
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, role, groupId, currentCampId } = req.body;

    const result = await query(
      `UPDATE professionals
       SET name = COALESCE($1, name),
           phone_number = COALESCE($2, phone_number),
           role = COALESCE($3, role),
           group_id = COALESCE($4, group_id),
           current_camp_id = COALESCE($5, current_camp_id)
       WHERE professional_id = $6
       RETURNING professional_id, name, email, phone_number, role, group_id, current_camp_id`,
      [name, phoneNumber, role, groupId, currentCampId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Professional not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
