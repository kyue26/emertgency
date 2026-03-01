const { app, request, getToken, createEvent, createResourceRequest } = require('./helpers');
const pool = require('../config/database');

afterAll(async () => { await pool.end(); });

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

describe('GET /resources', () => {
  it('returns list with pagination', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createResourceRequest(token, eventId, { resource_name: 'Stretcher' });
    await createResourceRequest(token, eventId, { resource_name: 'Bandages' });

    const res = await request(app)
      .get('/resources')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.resourceRequests)).toBe(true);
    expect(res.body.resourceRequests.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /resources/event/:eventId', () => {
  it('returns resources for event', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createResourceRequest(token, eventId, { resource_name: 'Oxygen Tank' });

    const res = await request(app)
      .get(`/resources/event/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].resource_name).toBe('Oxygen Tank');
    expect(res.body.data[0].event_id).toBe(eventId);
  });
});

describe('GET /resources/:resourceRequestId', () => {
  it('returns single resource with history', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await createResourceRequest(token, eventId, { resource_name: 'Defibrillator' });
    const resourceRequestId = createRes.body.resourceRequest.resource_request_id;

    const res = await request(app)
      .get(`/resources/${resourceRequestId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resourceRequest).toBeDefined();
    expect(res.body.resourceRequest.resource_name).toBe('Defibrillator');
    expect(res.body.resourceRequest.resource_request_id).toBe(resourceRequestId);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /resources/create', () => {
  it('creates resource request and returns 201', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await createResourceRequest(token, eventId, {
      resource_name: 'Stretcher',
      quantity: 5,
      priority: 'high'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.resourceRequest).toBeDefined();
    expect(res.body.resourceRequest.resource_name).toBe('Stretcher');
    expect(res.body.resourceRequest.quantity).toBe(5);
    expect(res.body.resourceRequest.priority).toBe('high');
    expect(res.body.resourceRequest.event_id).toBe(eventId);
  });

  it('rejects missing event_id with 400', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/resources/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resource_name: 'Stretcher',
        quantity: 1,
        priority: 'medium'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing resource_name with 400', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/resources/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_id: eventId,
        quantity: 1,
        priority: 'medium'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /resources/update/:id', () => {
  it('updates resource_name', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await createResourceRequest(token, eventId, { resource_name: 'Old Name' });
    const resourceRequestId = createRes.body.resourceRequest.resource_request_id;

    const res = await request(app)
      .put(`/resources/update/${resourceRequestId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resource_name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resourceRequest.resource_name).toBe('Updated Name');
    expect(res.body.changes).toContain('resource_name');
  });
});

describe('PUT /resources/confirm/:id', () => {
  it('confirms resource request', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await createResourceRequest(token, eventId, { resource_name: 'Bandages' });
    const resourceRequestId = createRes.body.resourceRequest.resource_request_id;

    const res = await request(app)
      .put(`/resources/confirm/${resourceRequestId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resourceRequest.confirmed).toBe(true);
    expect(res.body.resourceRequest.confirmed_by).toBeDefined();
  });
});

describe('DELETE /resources/delete/:id', () => {
  it('deletes resource request', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await createResourceRequest(token, eventId, { resource_name: 'Temporary Item' });
    const resourceRequestId = createRes.body.resourceRequest.resource_request_id;

    const res = await request(app)
      .delete(`/resources/delete/${resourceRequestId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);

    // Verify it no longer exists
    const getRes = await request(app)
      .get(`/resources/${resourceRequestId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });
});

describe('Auth', () => {
  it('GET /resources without token returns 401', async () => {
    const res = await request(app)
      .get('/resources');

    expect(res.status).toBe(401);
  });
});
