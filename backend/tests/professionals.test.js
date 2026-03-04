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

describe('GET /professionals', () => {
  it('returns list including registered user', async () => {
    const { token, user } = await getToken({ name: 'Listed Pro' });

    const res = await request(app)
      .get('/professionals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.professionals)).toBe(true);
    expect(res.body.professionals.length).toBeGreaterThanOrEqual(1);

    const found = res.body.professionals.find(
      (p) => p.professional_id === user.professional_id
    );
    expect(found).toBeDefined();
    expect(found.name).toBe('Listed Pro');
  });
});

describe('GET /professionals/:id', () => {
  it('returns single professional', async () => {
    const { token, user } = await getToken({ name: 'Single Pro' });

    const res = await request(app)
      .get(`/professionals/${user.professional_id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.professional).toBeDefined();
    expect(res.body.professional.professional_id).toBe(user.professional_id);
    expect(res.body.professional.name).toBe('Single Pro');
  });

  it('returns 404 for nonexistent professional', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/professionals/nonexistent_id_12345')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Professional not found');
  });
});

describe('GET /professionals/:id/tasks', () => {
  it('returns task summary with counts after creating a task', async () => {
    const { token, user } = await getToken();
    const eventRes = await createEvent(token, { name: 'Task Summary Event' });
    const eventId = eventRes.body.event.event_id;

    await createTask(token, eventId, user.professional_id, {
      task_description: 'Summary test task',
      priority: 'high'
    });

    const res = await request(app)
      .get(`/professionals/${user.professional_id}/tasks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.taskSummary).toBeDefined();
    expect(res.body.taskSummary.professional_id).toBe(user.professional_id);
    expect(Number(res.body.taskSummary.pending_tasks)).toBe(1);
  });
});

describe('PUT /professionals/:id', () => {
  it('Commander updates own profile', async () => {
    const { token, user } = await getToken({ role: 'Commander', name: 'Old Name' });

    const res = await request(app)
      .put(`/professionals/${user.professional_id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.professional).toBeDefined();
    expect(res.body.professional.name).toBe('Updated Name');
  });

  it('non-Commander cannot update other user (403)', async () => {
    const { user: target } = await getToken({ role: 'Commander', name: 'Target User' });
    const { token: otherToken } = await getToken({ role: 'MERT Member', name: 'Other User' });

    const res = await request(app)
      .put(`/professionals/${target.professional_id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/commanders/i);
  });
});

describe('Auth: GET /professionals without token', () => {
  it('returns 401', async () => {
    const res = await request(app)
      .get('/professionals');

    expect(res.status).toBe(401);
  });
});
