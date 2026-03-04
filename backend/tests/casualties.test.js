const { app, request, getToken, createEvent, createCasualty } = require('./helpers');
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

describe('GET /casualties', () => {
  it('returns casualty list for event', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });

    const res = await request(app)
      .get('/casualties')
      .set('Authorization', `Bearer ${token}`)
      .query({ event_id: eventId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.casualties)).toBe(true);
    expect(res.body.casualties.length).toBe(1);
    expect(res.body.casualties[0].color).toBe('yellow');
    expect(res.body.casualties[0].event_id).toBe(eventId);
  });

  it('supports pagination', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });
    await createCasualty(token, eventId, { color: 'red' });
    await createCasualty(token, eventId, { color: 'green' });

    const res = await request(app)
      .get('/casualties')
      .set('Authorization', `Bearer ${token}`)
      .query({ event_id: eventId, page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.casualties.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.hasMore).toBe(true);
  });
});

describe('POST /casualties', () => {
  it('valid creation returns 201', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await createCasualty(token, eventId, { color: 'red' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.casualty).toBeDefined();
    expect(res.body.casualty.color).toBe('red');
    expect(res.body.casualty.event_id).toBe(eventId);
  });

  it('rejects invalid color', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/casualties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_id: eventId,
        color: 'purple',
        breathing: true,
        conscious: true,
        bleeding: false
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing event_id', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/casualties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        color: 'yellow',
        breathing: true,
        conscious: true,
        bleeding: false
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /casualties/update/:casualtyId/status', () => {
  it('updates color successfully', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const casualtyRes = await createCasualty(token, eventId, { color: 'yellow' });
    const casualtyId = casualtyRes.body.casualty.injured_person_id;

    const res = await request(app)
      .put(`/casualties/update/${casualtyId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ color: 'red' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.casualty.color).toBe('red');
    expect(res.body.changes).toContain('color');
  });

  it('returns 404 for nonexistent casualty', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .put('/casualties/update/nonexistent_id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ color: 'red' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Casualty not found');
  });
});

describe('GET /casualties/statistics', () => {
  it('returns breakdown by triage color', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });
    await createCasualty(token, eventId, { color: 'red' });

    const res = await request(app)
      .get('/casualties/statistics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.yellow.total).toBe(1);
    expect(res.body.data.red.total).toBe(1);
    expect(res.body.data.green.total).toBe(0);
    expect(res.body.data.black.total).toBe(0);
  });

  it('accepts event_id filter', async () => {
    const { token } = await getToken();

    const eventRes1 = await createEvent(token, { name: 'Event One' });
    const eventId1 = eventRes1.body.event.event_id;

    const eventRes2 = await createEvent(token, { name: 'Event Two' });
    const eventId2 = eventRes2.body.event.event_id;

    await createCasualty(token, eventId1, { color: 'yellow' });
    await createCasualty(token, eventId2, { color: 'red' });

    const res = await request(app)
      .get('/casualties/statistics')
      .set('Authorization', `Bearer ${token}`)
      .query({ event_id: eventId1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.yellow.total).toBe(1);
    expect(res.body.data.red.total).toBe(0);
  });
});

describe('GET /casualties/:casualtyId/audit', () => {
  it('returns audit log entries after creation', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const casualtyRes = await createCasualty(token, eventId, { color: 'yellow' });
    const casualtyId = casualtyRes.body.casualty.injured_person_id;

    const res = await request(app)
      .get(`/casualties/${casualtyId}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.audit)).toBe(true);
    expect(res.body.audit.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 for nonexistent casualty', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/casualties/nonexistent_id/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Casualty not found');
  });
});

describe('DELETE /casualties/:casualtyId', () => {
  it('deletes successfully', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const casualtyRes = await createCasualty(token, eventId, { color: 'green' });
    const casualtyId = casualtyRes.body.casualty.injured_person_id;

    const res = await request(app)
      .delete(`/casualties/${casualtyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Casualty deleted successfully');

    const listRes = await request(app)
      .get('/casualties')
      .set('Authorization', `Bearer ${token}`)
      .query({ event_id: eventId });

    expect(listRes.body.casualties.length).toBe(0);
  });

  it('populates deleted_casualties table', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const casualtyRes = await createCasualty(token, eventId, { color: 'yellow' });
    const casualtyId = casualtyRes.body.casualty.injured_person_id;

    await request(app)
      .delete(`/casualties/${casualtyId}`)
      .set('Authorization', `Bearer ${token}`);

    const dbResult = await pool.query(
      'SELECT * FROM deleted_casualties WHERE casualty_id = $1',
      [casualtyId]
    );

    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].casualty_id).toBe(casualtyId);
    expect(dbResult.rows[0].event_id).toBe(eventId);
  });

  it('returns 404 for nonexistent casualty', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .delete('/casualties/nonexistent_id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Casualty not found');
  });
});
