const { app, request, getToken, createEvent } = require('./helpers');
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

describe('POST /shifts/check-in', () => {
  it('creates shift when user is in event and returns 201', async () => {
    const { token } = await getToken();
    // Creating an event auto-assigns the creator to that event
    await createEvent(token, { name: 'Shift Event' });

    const res = await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/checked in/i);
    expect(res.body.shift).toBeDefined();
    expect(res.body.shift.shift_id).toBeDefined();
    expect(res.body.shift.check_in).toBeDefined();
    expect(res.body.shift.check_out).toBeNull();
  });

  it('rejects when user has no current event with 400', async () => {
    const { token } = await getToken();
    // Do not create or join any event

    const res = await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/event/i);
  });

  it('rejects double check-in with 400', async () => {
    const { token } = await getToken();
    await createEvent(token, { name: 'Double Check-in Event' });

    // First check-in should succeed
    const first = await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(201);

    // Second check-in without checking out should fail
    const second = await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(400);
    expect(second.body.success).toBe(false);
    expect(second.body.message).toMatch(/open shift/i);
  });
});

describe('POST /shifts/check-out', () => {
  it('checks out open shift', async () => {
    const { token } = await getToken();
    await createEvent(token, { name: 'Checkout Event' });

    // Check in first
    await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/shifts/check-out')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/checked out/i);
    expect(res.body.shift).toBeDefined();
    expect(res.body.shift.check_out).not.toBeNull();
  });

  it('rejects when no open shift with 400', async () => {
    const { token } = await getToken();
    // No shift has been started

    const res = await request(app)
      .post('/shifts/check-out')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no open shift/i);
  });
});

describe('GET /shifts/my-shifts', () => {
  it('returns shift data', async () => {
    const { token } = await getToken();
    await createEvent(token, { name: 'My Shifts Event' });

    // Check in and then check out to create a completed shift
    await request(app)
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .post('/shifts/check-out')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/shifts/my-shifts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_on_duty).toBe(false);
    expect(res.body.current_shift).toBeNull();
    expect(res.body.total_shifts).toBe(1);
    expect(typeof res.body.total_hours).toBe('number');
    expect(Array.isArray(res.body.shifts)).toBe(true);
    expect(res.body.shifts.length).toBe(1);
    expect(res.body.shifts[0].check_in).toBeDefined();
    expect(res.body.shifts[0].check_out).toBeDefined();
    expect(res.body.shifts[0].duration_hours).toBeDefined();
  });
});
