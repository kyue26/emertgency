const { app, request, getToken, createEvent } = require('./helpers');
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

describe('GET /camps', () => {
  it('returns empty array when no camps exist', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/camps')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.camps)).toBe(true);
    expect(res.body.camps.length).toBe(0);
  });

  it('returns camps after creating one', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, locationName: 'Test Camp', capacity: 50 });

    const res = await request(app)
      .get('/camps')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.camps.length).toBe(1);
    expect(res.body.camps[0].location_name).toBe('Test Camp');
  });
});

describe('GET /camps/:id', () => {
  it('returns a camp by id', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, locationName: 'Alpha Camp', capacity: 30 });

    const campId = createRes.body.camp.camp_id;

    const res = await request(app)
      .get(`/camps/${campId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.camp).toBeDefined();
    expect(res.body.camp.camp_id).toBe(campId);
    expect(res.body.camp.location_name).toBe('Alpha Camp');
    expect(res.body.camp.capacity).toBe(30);
  });

  it('returns 404 for nonexistent camp', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/camps/nonexistent_camp_id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe('POST /camps', () => {
  it('creates a camp with eventId, locationName, and capacity', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, locationName: 'Test Camp', capacity: 50 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.camp).toBeDefined();
    expect(res.body.camp.location_name).toBe('Test Camp');
    expect(res.body.camp.capacity).toBe(50);
    expect(res.body.camp.event_id).toBe(eventId);
    expect(res.body.camp.camp_id).toBeDefined();
  });

  it('rejects creation when eventId is missing', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationName: 'No Event Camp', capacity: 25 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /camps/:id', () => {
  it('updates the location_name of a camp', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, locationName: 'Old Name', capacity: 40 });

    const campId = createRes.body.camp.camp_id;

    const res = await request(app)
      .put(`/camps/${campId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationName: 'Updated Name', eventId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.camp.location_name).toBe('Updated Name');
  });
});

describe('DELETE /camps/:id', () => {
  it('deletes an existing camp', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const createRes = await request(app)
      .post('/camps')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, locationName: 'Deletable Camp', capacity: 20 });

    const campId = createRes.body.camp.camp_id;

    const res = await request(app)
      .delete(`/camps/${campId}?eventId=${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when deleting a nonexistent camp', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .delete(`/camps/nonexistent_camp_id?eventId=${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});
