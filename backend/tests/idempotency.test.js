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

describe('Idempotency middleware', () => {
  it('same idempotency key on POST returns cached 2xx response', async () => {
    const { token } = await getToken();
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    const first = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uuid)
      .send({
        name: 'Idempotent Event',
        location: 'Test Location',
        status: 'in_progress'
      });

    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    const firstEventId = first.body.event.event_id;

    const second = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uuid)
      .send({
        name: 'Idempotent Event',
        location: 'Test Location',
        status: 'in_progress'
      });

    // Should return the cached response with the same event_id
    expect([200, 201]).toContain(second.status);
    expect(second.body.success).toBe(true);
    expect(second.body.event.event_id).toBe(firstEventId);
  });

  it('different keys create separate records', async () => {
    const { token } = await getToken();
    const uuid1 = '550e8400-e29b-41d4-a716-446655440001';
    const uuid2 = '550e8400-e29b-41d4-a716-446655440002';

    const first = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uuid1)
      .send({
        name: 'Event One',
        location: 'Location One',
        status: 'in_progress'
      });

    expect(first.status).toBe(201);
    const firstEventId = first.body.event.event_id;

    const second = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uuid2)
      .send({
        name: 'Event Two',
        location: 'Location Two',
        status: 'in_progress'
      });

    expect(second.status).toBe(201);
    const secondEventId = second.body.event.event_id;

    expect(firstEventId).not.toBe(secondEventId);
  });

  it('invalid (non-UUID) key returns 400 with "UUID v4" message', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'not-a-valid-uuid')
      .send({
        name: 'Should Fail',
        location: 'Nowhere',
        status: 'in_progress'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/UUID v4/);
  });

  it('no key header passes through normally (backward compatible)', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'No Key Event',
        location: 'Any Location',
        status: 'in_progress'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toBeDefined();
    expect(res.body.event.event_id).toBeDefined();
  });
});
