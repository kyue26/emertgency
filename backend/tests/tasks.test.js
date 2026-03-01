const { app, request, getToken, createEvent, createTask } = require('./helpers');
const pool = require('../config/database');

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM shifts');
  await pool.query('DELETE FROM resource_request_audit_log');
  await pool.query('DELETE FROM resource_requests');
  await pool.query('DELETE FROM task_audit_log');
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM casualty_audit_log');
  await pool.query('DELETE FROM deleted_casualties');
  await pool.query('DELETE FROM injured_persons');
  await pool.query('DELETE FROM event_groups');
  await pool.query('DELETE FROM drill_sessions');
  await pool.query('DELETE FROM idempotency_keys');
  await pool.query('UPDATE professionals SET group_id = NULL, current_event_id = NULL, current_camp_id = NULL');
  await pool.query('DELETE FROM camps');
  await pool.query('DELETE FROM events');
  await pool.query('DELETE FROM professional_passwords');
  await pool.query('DELETE FROM groups');
  await pool.query('DELETE FROM professionals');
});

describe('GET /tasks', () => {
  it('returns task list', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createTask(token, eventId, user.professional_id);

    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /tasks/:taskId', () => {
  it('returns a single task by id', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const taskRes = await createTask(token, eventId, user.professional_id);
    const taskId = taskRes.body.task.task_id;

    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.task_id).toBe(taskId);
    expect(res.body.task.task_description).toBe('Test task description');
  });
});

describe('POST /tasks/create', () => {
  it('creates a task and returns 201', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_id: eventId,
        assigned_to: user.professional_id,
        task_description: 'Set up triage area',
        priority: 'high'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.task_description).toBe('Set up triage area');
    expect(res.body.task.priority).toBe('high');
    expect(res.body.task.status).toBe('pending');
    expect(res.body.task.event_id).toBe(eventId);
    expect(res.body.task.assigned_to).toBe(user.professional_id);
  });

  it('rejects creation when task_description is missing', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_id: eventId,
        assigned_to: user.professional_id,
        priority: 'medium'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /tasks/update/:taskId', () => {
  it('updates task status to in_progress', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const taskRes = await createTask(token, eventId, user.professional_id);
    const taskId = taskRes.body.task.task_id;

    const res = await request(app)
      .put(`/tasks/update/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.status).toBe('in_progress');
    expect(res.body.changes).toContain('status');
  });
});

describe('DELETE /tasks/:taskId', () => {
  it('deletes (cancels) a task', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const taskRes = await createTask(token, eventId, user.professional_id);
    const taskId = taskRes.body.task.task_id;

    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/cancelled/i);
    expect(res.body.task.status).toBe('cancelled');
  });
});

describe('Auth protection', () => {
  it('GET /tasks without token returns 401', async () => {
    const res = await request(app)
      .get('/tasks');

    expect(res.status).toBe(401);
  });
});
