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
  await pool.query('DELETE FROM group_audit_log');
  await pool.query('UPDATE professionals SET group_id = NULL, current_event_id = NULL, current_camp_id = NULL');
  await pool.query('DELETE FROM camps');
  await pool.query('DELETE FROM events');
  await pool.query('DELETE FROM professional_passwords');
  await pool.query('DELETE FROM groups');
  await pool.query('DELETE FROM professionals');
  await pool.query('DELETE FROM hospitals');
  await pool.query("INSERT INTO hospitals (name, distance, trauma_level, is_active) VALUES ('Test Hospital', '1 mile', 1, true)");
});

describe('GET /reports/hospital-transfers', () => {
  it('returns hospitals list and transfer statistics', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/reports/hospital-transfers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.hospitals)).toBe(true);
    expect(res.body.hospitals.length).toBeGreaterThanOrEqual(1);
    expect(res.body.hospitals[0].name).toBe('Test Hospital');
    expect(Array.isArray(res.body.transferStatistics)).toBe(true);
  });

  it('includes transfer stats when casualties have hospital_status', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token);
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, {
      color: 'red',
      hospital_status: 'Test Hospital'
    });

    const res = await request(app)
      .get('/reports/hospital-transfers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.transferStatistics.length).toBeGreaterThanOrEqual(1);

    const stat = res.body.transferStatistics.find(s => s.hospital_status === 'Test Hospital');
    expect(stat).toBeDefined();
    expect(Number(stat.patient_count)).toBe(1);
    expect(Number(stat.red_patients)).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/reports/hospital-transfers');
    expect(res.status).toBe(401);
  });
});

describe('GET /reports/summary', () => {
  it('returns overall summary with events', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Summary Event' });
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });

    const res = await request(app)
      .get('/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.overall).toBeDefined();
    expect(Number(res.body.summary.overall.total_events)).toBeGreaterThanOrEqual(1);
    expect(Number(res.body.summary.overall.total_professionals)).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.summary.events)).toBe(true);
    expect(res.body.summary.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.generatedAt).toBeDefined();

    const evt = res.body.summary.events.find(e => e.event_id === eventId);
    expect(evt).toBeDefined();
    expect(Number(evt.total_casualties)).toBe(1);
    expect(Number(evt.yellow_count)).toBe(1);
  });

  it('returns multiple events in summary', async () => {
    const { token } = await getToken();
    const event1Res = await createEvent(token, { name: 'Event One' });
    const event2Res = await createEvent(token, { name: 'Event Two' });
    const eventId1 = event1Res.body.event.event_id;

    await createCasualty(token, eventId1, { color: 'red' });

    const res = await request(app)
      .get('/reports/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.events.length).toBe(2);

    const evt1 = res.body.summary.events.find(e => e.event_id === eventId1);
    expect(evt1).toBeDefined();
    expect(Number(evt1.total_casualties)).toBe(1);
    expect(Number(evt1.red_count)).toBe(1);
  });

  it('rejects start_date without end_date', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/reports/summary?start_date=2026-01-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/both/i);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/reports/summary');
    expect(res.status).toBe(401);
  });
});
