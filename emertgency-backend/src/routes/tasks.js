import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/tasks - Get all tasks (with filters)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { eventId, assignedTo, status, priority } = req.query;
    
    let queryText = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (eventId) {
      queryText += ` AND event_id = $${paramIndex}`;
      params.push(eventId);
      paramIndex++;
    }

    if (assignedTo) {
      queryText += ` AND assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      queryText += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    queryText += ' ORDER BY priority DESC, due_date ASC NULLS LAST, created_at DESC';

    const result = await query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id - Get task by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM tasks WHERE task_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks - Create new task
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { taskId, assignedTo, eventId, taskDescription, priority, status, dueDate, notes } = req.body;

    const result = await query(
      `INSERT INTO tasks (task_id, created_by, assigned_to, event_id, task_description, priority, status, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [taskId, req.user.professionalId, assignedTo, eventId, taskDescription, priority || 'medium', status || 'pending', dueDate || null, notes || null]
    );

    // Log to audit
    await query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [taskId, 'CREATE', req.user.professionalId, JSON.stringify(req.body)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { taskDescription, priority, status, dueDate, notes, completedAt } = req.body;

    const result = await query(
      `UPDATE tasks
       SET task_description = COALESCE($1, task_description),
           priority = COALESCE($2, priority),
           status = COALESCE($3, status),
           due_date = COALESCE($4, due_date),
           notes = COALESCE($5, notes),
           completed_at = COALESCE($6, completed_at),
           updated_by = $7
       WHERE task_id = $8
       RETURNING *`,
      [taskDescription, priority, status, dueDate, notes, completedAt, req.user.professionalId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    // Log to audit
    await query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'UPDATE', req.user.professionalId, JSON.stringify(req.body)]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM tasks WHERE task_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    res.status(200).json({
      message: 'Task deleted successfully',
      task: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/audit - Get audit history for task
router.get('/:id/audit', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM task_audit_log WHERE task_id = $1 ORDER BY changed_at DESC`,
      [id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
