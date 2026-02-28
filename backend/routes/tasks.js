const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');
const { createTask, updateTask } = require('../services/tasks.service');
const { idempotencyMiddleware } = require('../config/idempotency');

const router = express.Router();

const checkTaskAccess = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    const result = await pool.query(
      `SELECT t.*, e.status as event_status
       FROM tasks t
       LEFT JOIN events e ON t.event_id = e.event_id
       WHERE t.task_id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = result.rows[0];

    // Commanders can access all tasks
    // Otherwise, must be creator, assignee, or assigned person
    if (req.user.role !== 'Commander' && 
        req.user.professional_id !== task.created_by &&
        req.user.professional_id !== task.assigned_to) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this task' 
      });
    }

    req.task = task;
    next();
  } catch (error) {
    console.error('Task access check error:', error.message);
    res.status(500).json({ success: false, message: 'Access verification failed' });
  }
};

// GET /tasks
router.get('/', authenticateToken, [
  query('event_id').optional().trim(),
  query('assigned_to').optional().trim(),
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('my_tasks').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { 
      event_id,
      eventId,
      assigned_to,
      assignedTo,
      status, 
      priority, 
      my_tasks,
      page = 1, 
      limit = 50 
    } = req.query;
    const offset = (page - 1) * limit;

    const eventIdResolved = event_id || eventId;
    const assignedToResolved = assigned_to || assignedTo;

    const conditions = ['1=1'];
    const params = [];
    let paramCount = 1;

    // Filter by access rights (non-commanders see only their tasks)
    if (req.user.role !== 'Commander' && !my_tasks) {
      conditions.push(`(t.created_by = $${paramCount} OR t.assigned_to = $${paramCount})`);
      params.push(req.user.professional_id);
      paramCount++;
    } else if (my_tasks) {
      conditions.push(`(t.created_by = $${paramCount} OR t.assigned_to = $${paramCount})`);
      params.push(req.user.professional_id);
      paramCount++;
    }

    if (eventIdResolved) {
      conditions.push(`t.event_id = $${paramCount++}`);
      params.push(eventIdResolved);
    }
    if (assignedToResolved) {
      conditions.push(`t.assigned_to = $${paramCount++}`);
      params.push(assignedToResolved);
    }
    if (status) {
      conditions.push(`t.status = $${paramCount++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`t.priority = $${paramCount++}`);
      params.push(priority);
    }

    params.push(limit, offset);

    const query = `
      SELECT t.*, 
             p_creator.name as created_by_name,
             p_assigned.name as assigned_to_name,
             p_assigned.email as assigned_to_email,
             e.name as event_name,
             e.status as event_status
      FROM tasks t
      LEFT JOIN professionals p_creator ON t.created_by = p_creator.professional_id
      LEFT JOIN professionals p_assigned ON t.assigned_to = p_assigned.professional_id
      LEFT JOIN events e ON t.event_id = e.event_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE t.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        CASE t.status
          WHEN 'in_progress' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'cancelled' THEN 4
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      WHERE ${conditions.join(' AND ')}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      tasks: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /tasks/:taskId/audit - Get audit history for task (must be before GET /:taskId)
router.get('/:taskId/audit', authenticateToken, [
  param('taskId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { taskId } = req.params;

    const taskCheck = await pool.query(
      'SELECT task_id, created_by, assigned_to FROM tasks WHERE task_id = $1',
      [taskId]
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskCheck.rows[0];
    if (req.user.role !== 'Commander' && req.user.professional_id !== task.created_by && req.user.professional_id !== task.assigned_to) {
      return res.status(403).json({ success: false, message: 'You do not have access to this task' });
    }

    const result = await pool.query(
      'SELECT * FROM task_audit_log WHERE task_id = $1 ORDER BY changed_at DESC',
      [taskId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get task audit error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve task audit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /tasks/:taskId
router.get('/:taskId', authenticateToken, checkTaskAccess, [
  param('taskId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { taskId } = req.params;

    const result = await pool.query(
      `SELECT t.*, 
              p_creator.name as created_by_name,
              p_creator.email as created_by_email,
              p_assigned.name as assigned_to_name,
              p_assigned.email as assigned_to_email,
              p_assigned.phone_number as assigned_to_phone,
              e.name as event_name,
              e.status as event_status
       FROM tasks t
       LEFT JOIN professionals p_creator ON t.created_by = p_creator.professional_id
       LEFT JOIN professionals p_assigned ON t.assigned_to = p_assigned.professional_id
       LEFT JOIN events e ON t.event_id = e.event_id
       WHERE t.task_id = $1`,
      [taskId]
    );

    // Get task history
    const history = await pool.query(
      `SELECT tl.*, p.name as changed_by_name
       FROM task_audit_log tl
       LEFT JOIN professionals p ON tl.changed_by = p.professional_id
       WHERE tl.task_id = $1
       ORDER BY tl.changed_at DESC`,
      [taskId]
    );

    res.json({
      success: true,
      task: result.rows[0],
      history: history.rows
    });
  } catch (error) {
    console.error('Get task error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /tasks - REST-style create (optional taskId; same as /create with audit CREATE)
router.post('/', authenticateToken, [
  body('task_id').optional().trim(),
  body('taskId').optional().trim(),
  body('event_id').optional().trim(),
  body('eventId').optional().trim(),
  body('assigned_to').optional().trim(),
  body('assignedTo').optional().trim(),
  body('task_description').notEmpty().trim().isLength({ min: 1, max: 1000 }),
  body('taskDescription').optional().trim().isLength({ min: 1, max: 1000 }),
  body('title').optional().trim().isLength({ max: 200 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  body('due_date').optional().isISO8601().toDate(),
  body('dueDate').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const event_id = req.body.event_id || req.body.eventId;
    const assigned_to = req.body.assigned_to || req.body.assignedTo;
    const task_description = req.body.task_description || req.body.taskDescription;
    const due_date = req.body.due_date || req.body.dueDate;

    if (!event_id || !assigned_to) {
      return res.status(400).json({ success: false, message: 'event_id and assigned_to are required' });
    }

    await client.query('BEGIN');

    const eventCheck = await client.query('SELECT event_id, status FROM events WHERE event_id = $1', [event_id]);
    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const assigneeCheck = await client.query('SELECT professional_id FROM professionals WHERE professional_id = $1', [assigned_to]);
    if (assigneeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Assigned professional not found' });
    }

    const task_id = req.body.task_id || req.body.taskId || `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const priority = req.body.priority || 'medium';
    const status = req.body.status || 'pending';
    const title = req.body.title || null;
    const notes = req.body.notes || null;

    const result = await client.query(
      `INSERT INTO tasks (task_id, created_by, assigned_to, event_id, title, task_description, priority, status, due_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [task_id, req.user.professional_id, assigned_to, event_id, title, task_description, priority, status, due_date || null, notes]
    );

    await client.query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [task_id, 'CREATE', req.user.professional_id, JSON.stringify(req.body)]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create task error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Task ID already exists' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Invalid event_id or assigned_to' });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// POST /tasks/create
router.post('/create', authenticateToken, idempotencyMiddleware, [
  body('event_id').notEmpty().trim(),
  body('assigned_to').notEmpty().trim(),
  body('title').optional().trim().isLength({ max: 200 }),
  body('task_description').notEmpty().trim().isLength({ min: 1, max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('due_date').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const result = await createTask(req.body, req.user, pool);
  return res.status(result.status).json(result.body);
});

// PUT /tasks/update/:taskId
// Note: checkTaskAccess is NOT in the chain here; access check is inside updateTask service.
router.put('/update/:taskId', authenticateToken, idempotencyMiddleware, [
  param('taskId').notEmpty().trim(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('title').optional().trim().isLength({ max: 200 }),
  body('task_description').optional().trim().isLength({ min: 1, max: 1000 }),
  body('due_date').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 2000 }),
  body('assigned_to').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const result = await updateTask(req.params.taskId, req.body, req.user, pool);
  return res.status(result.status).json(result.body);
});

// PUT /tasks/:taskId - REST-style update (task_description, priority, status, due_date, notes, completed_at)
router.put('/:taskId', authenticateToken, [
  param('taskId').notEmpty().trim(),
  body('task_description').optional().trim().isLength({ min: 1, max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  body('due_date').optional().isISO8601().toDate(),
  body('dueDate').optional().isISO8601().toDate(),
  body('notes').optional().trim().isLength({ max: 2000 }),
  body('completed_at').optional().isISO8601().toDate(),
  body('completedAt').optional().isISO8601().toDate()
], async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { taskId } = req.params;
    const due_date = req.body.due_date ?? req.body.dueDate;
    const completed_at = req.body.completed_at ?? req.body.completedAt;

    const current = await client.query(
      'SELECT task_id, created_by, assigned_to FROM tasks WHERE task_id = $1',
      [taskId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = current.rows[0];
    if (req.user.role !== 'Commander' && req.user.professional_id !== task.created_by && req.user.professional_id !== task.assigned_to) {
      return res.status(403).json({ success: false, message: 'You do not have access to this task' });
    }

    const result = await client.query(
      `UPDATE tasks
       SET task_description = COALESCE($1, task_description),
           priority = COALESCE($2, priority),
           status = COALESCE($3, status),
           due_date = COALESCE($4, due_date),
           notes = COALESCE($5, notes),
           completed_at = COALESCE($6, completed_at),
           updated_by = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = $8
       RETURNING *`,
      [
        req.body.task_description || null,
        req.body.priority || null,
        req.body.status || null,
        due_date !== undefined ? due_date : null,
        req.body.notes !== undefined ? req.body.notes : null,
        completed_at !== undefined ? completed_at : null,
        req.user.professional_id,
        taskId
      ]
    );

    await client.query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [taskId, 'UPDATE', req.user.professional_id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update task error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /tasks/delete/:taskId
router.delete('/delete/:taskId', authenticateToken, idempotencyMiddleware, checkTaskAccess, [
  param('taskId').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { taskId } = req.params;
    const task = req.task;

    if (req.user.professional_id !== task.created_by && req.user.role !== 'Commander') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only task creator or commanders can delete tasks' 
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tasks 
       SET status = 'cancelled', 
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $1
       WHERE task_id = $2 
       RETURNING *`,
      [req.user.professional_id, taskId]
    );

    // Log deletion
    await client.query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [taskId, 'cancelled', req.user.professional_id, JSON.stringify({ 
        reason: 'deleted',
        task_description: task.task_description 
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Task cancelled successfully',
      task: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete task error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Task deletion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /tasks/:taskId - REST-style hard delete (must be after /delete/:taskId)
router.delete('/:taskId', authenticateToken, [
  param('taskId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { taskId } = req.params;

    const current = await pool.query(
      'SELECT task_id, created_by, assigned_to FROM tasks WHERE task_id = $1',
      [taskId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = current.rows[0];
    if (req.user.role !== 'Commander' && req.user.professional_id !== task.created_by && req.user.professional_id !== task.assigned_to) {
      return res.status(403).json({ success: false, message: 'You do not have access to this task' });
    }

    const result = await pool.query(
      'DELETE FROM tasks WHERE task_id = $1 RETURNING *',
      [taskId]
    );

    res.json({
      success: true,
      message: 'Task deleted successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Delete task error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;