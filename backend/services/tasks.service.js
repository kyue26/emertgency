// tasks.service.js
// Pure business logic extracted from routes/tasks.js.
// Each function accepts (body, user, pool) and returns { status, body }.

// POST /tasks/create
const createTask = async (body, user, pool) => {
  const { event_id, assigned_to, task_description, priority, due_date, notes } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventCheck = await client.query(
      'SELECT event_id, status, name FROM events WHERE event_id = $1',
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Event not found' } };
    }

    if (eventCheck.rows[0].status === 'finished' || eventCheck.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot create tasks for finished or cancelled events' } };
    }

    const professionalCheck = await client.query(
      `SELECT p.professional_id, p.name, p.email, p.current_camp_id, c.event_id
       FROM professionals p
       LEFT JOIN camps c ON p.current_camp_id = c.camp_id
       WHERE p.professional_id = $1`,
      [assigned_to]
    );

    if (professionalCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Assigned professional not found' } };
    }

    const professional = professionalCheck.rows[0];

    if (professional.event_id !== event_id && user.role !== 'Commander') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: `${professional.name} is not currently assigned to this event` } };
    }

    if (due_date) {
      const dueDateTime = new Date(due_date);
      if (dueDateTime < new Date()) {
        await client.query('ROLLBACK');
        return { status: 400, body: { success: false, message: 'Due date cannot be in the past' } };
      }
    }

    const task_id = `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO tasks
       (task_id, created_by, assigned_to, event_id, task_description, priority,
        status, due_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        task_id,
        user.professional_id,
        assigned_to,
        event_id,
        task_description,
        priority || 'medium',
        'pending',
        due_date || null,
        notes || null
      ]
    );

    await client.query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [task_id, 'created', user.professional_id, JSON.stringify({
        task_description,
        assigned_to,
        priority: priority || 'medium'
      })]
    );

    await client.query('COMMIT');

    return {
      status: 201,
      body: {
        success: true,
        message: 'Task created successfully',
        task: result.rows[0]
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createTask error:', error.message);

    if (error.code === '23503') {
      return { status: 400, body: { success: false, message: 'Invalid event_id or assigned_to' } };
    }

    return { status: 500, body: { success: false, message: 'Failed to create task' } };
  } finally {
    client.release();
  }
};

// PUT /tasks/update/:taskId
const updateTask = async (taskId, body, user, pool) => {
  const { status, priority, task_description, due_date, notes, assigned_to } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      `SELECT t.*, e.status as event_status
       FROM tasks t
       LEFT JOIN events e ON t.event_id = e.event_id
       WHERE t.task_id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Task not found' } };
    }

    const task = taskResult.rows[0];

    if (user.role !== 'Commander' &&
        user.professional_id !== task.created_by &&
        user.professional_id !== task.assigned_to) {
      await client.query('ROLLBACK');
      return { status: 403, body: { success: false, message: 'You do not have access to this task' } };
    }

    if (assigned_to && assigned_to !== task.assigned_to) {
      if (user.professional_id !== task.created_by && user.role !== 'Commander') {
        await client.query('ROLLBACK');
        return { status: 403, body: { success: false, message: 'Only task creator or commanders can reassign tasks' } };
      }

      const newAssigneeCheck = await client.query(
        'SELECT professional_id, name FROM professionals WHERE professional_id = $1',
        [assigned_to]
      );

      if (newAssigneeCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 404, body: { success: false, message: 'New assignee not found' } };
      }
    }

    if (status && status !== task.status) {
      const validTransitions = {
        'pending': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'pending', 'cancelled'],
        'completed': ['in_progress'],
        'cancelled': ['pending']
      };

      if (!validTransitions[task.status]?.includes(status)) {
        await client.query('ROLLBACK');
        return { status: 400, body: { success: false, message: `Cannot transition from ${task.status} to ${status}` } };
      }
    }

    if ((task.status === 'completed' || task.status === 'cancelled') &&
        user.professional_id !== task.created_by &&
        user.role !== 'Commander') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot modify completed or cancelled tasks' } };
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (status && status !== task.status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      changes.status = { from: task.status, to: status };

      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
        changes.completed_at = 'now';
      }
    }

    if (priority && priority !== task.priority) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
      changes.priority = { from: task.priority, to: priority };
    }

    if (task_description && task_description !== task.task_description) {
      updates.push(`task_description = $${paramCount++}`);
      values.push(task_description);
      changes.task_description = { from: task.task_description, to: task_description };
    }

    if (due_date !== undefined) {
      const dueDateTime = due_date ? new Date(due_date) : null;
      if (dueDateTime && dueDateTime < new Date() && status !== 'completed') {
        await client.query('ROLLBACK');
        return { status: 400, body: { success: false, message: 'Due date cannot be in the past' } };
      }
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date || null);
      changes.due_date = { from: task.due_date, to: due_date };
    }

    if (notes !== undefined && notes !== task.notes) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes || null);
      changes.notes = { from: task.notes, to: notes };
    }

    if (assigned_to && assigned_to !== task.assigned_to) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assigned_to);
      changes.assigned_to = { from: task.assigned_to, to: assigned_to };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'No changes detected' } };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(user.professional_id);
    values.push(taskId);

    const result = await client.query(
      `UPDATE tasks SET ${updates.join(', ')}
       WHERE task_id = $${paramCount}
       RETURNING *`,
      values
    );

    await client.query(
      `INSERT INTO task_audit_log (task_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [taskId, 'updated', user.professional_id, JSON.stringify(changes)]
    );

    await client.query('COMMIT');

    return {
      status: 200,
      body: {
        success: true,
        message: 'Task updated successfully',
        task: result.rows[0],
        changes: Object.keys(changes)
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateTask error:', error.message);
    return { status: 500, body: { success: false, message: 'Failed to update task' } };
  } finally {
    client.release();
  }
};

module.exports = { createTask, updateTask };
