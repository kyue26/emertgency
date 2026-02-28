import express from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/groups - Get all groups
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM group_membership_view ORDER BY group_name');
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/groups/:id - Get group by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM group_membership_view WHERE group_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Group not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/groups - Create new group
router.post('/', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { groupId, groupName, leadProfessionalId, maxMembers } = req.body;

    const result = await query(
      `INSERT INTO groups (group_id, group_name, lead_professional_id, max_members, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [groupId, groupName, leadProfessionalId || null, maxMembers || 10, req.user.professionalId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/groups/:id - Update group
router.put('/:id', authenticate, authorize('Commander', 'Medical Officer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupName, leadProfessionalId, maxMembers } = req.body;

    const result = await query(
      `UPDATE groups
       SET group_name = COALESCE($1, group_name),
           lead_professional_id = COALESCE($2, lead_professional_id),
           max_members = COALESCE($3, max_members),
           updated_by = $4
       WHERE group_id = $5
       RETURNING *`,
      [groupName, leadProfessionalId, maxMembers, req.user.professionalId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Group not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/groups/:id - Delete group
router.delete('/:id', authenticate, authorize('Commander'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM groups WHERE group_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Group not found',
      });
    }

    res.status(200).json({
      message: 'Group deleted successfully',
      group: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
