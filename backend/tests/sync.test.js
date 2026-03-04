const { app, request, getToken, createEvent, createCasualty } = require('./helpers');
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

describe('GET /sync', () => {
  it('returns delta since timestamp', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Sync Event' });
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });

    const since = new Date(Date.now() - 60000).toISOString();

    const res = await request(app)
      .get('/sync')
      .set('Authorization', `Bearer ${token}`)
      .query({ since, event_id: eventId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.changes).toBeDefined();
    expect(Array.isArray(res.body.changes.casualties)).toBe(true);
    expect(res.body.changes.casualties.length).toBeGreaterThanOrEqual(1);
    expect(res.body.serverTime).toBeDefined();
  });

  it('rejects missing since param with 400', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .get('/sync')
      .set('Authorization', `Bearer ${token}`)
      .query({ event_id: eventId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects >48hr window with 400', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get('/sync')
      .set('Authorization', `Bearer ${token}`)
      .query({ since, event_id: eventId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/48 hours/i);
  });

  it('rejects missing event_id with 400', async () => {
    const { token } = await getToken();

    const since = new Date(Date.now() - 60000).toISOString();

    const res = await request(app)
      .get('/sync')
      .set('Authorization', `Bearer ${token}`)
      .query({ since });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /sync/batch', () => {
  it('processes operations', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Batch Event' });
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .post('/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
            method: 'POST',
            path: 'casualties',
            body: {
              event_id: eventId,
              color: 'green',
              breathing: true,
              conscious: true,
              bleeding: false
            }
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(1);
    expect(res.body.results[0].status).toBeGreaterThanOrEqual(200);
    expect(res.body.results[0].status).toBeLessThan(300);
  });

  it('handles invalid operations gracefully', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            idempotency_key: '550e8400-e29b-41d4-a716-446655440001',
            method: 'POST',
            path: 'nonexistent/route',
            body: {}
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.length).toBe(1);
    // The invalid operation should be marked as failed (400)
    expect(res.body.results[0].status).toBe(400);
    expect(res.body.failed).toBe(1);
  });
});
