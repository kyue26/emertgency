const { app, request, getToken } = require('./helpers');
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
  await pool.query('DELETE FROM hospitals');

  // Seed a default hospital for read tests
  await pool.query(
    "INSERT INTO hospitals (name, distance, trauma_level, is_active) VALUES ('Test Hospital', '1 mile', 1, true)"
  );
});

describe('GET /hospitals', () => {
  it('returns seeded hospital list', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/hospitals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.hospitals)).toBe(true);
    expect(res.body.hospitals.length).toBeGreaterThanOrEqual(1);

    const seeded = res.body.hospitals.find(h => h.name === 'Test Hospital');
    expect(seeded).toBeDefined();
    expect(seeded.distance).toBe('1 mile');
    expect(seeded.trauma_level).toBe(1);
    expect(seeded.is_active).toBe(true);
  });

  it('filters active hospitals with ?isActive=true', async () => {
    const { token } = await getToken();

    // Insert an inactive hospital
    await pool.query(
      "INSERT INTO hospitals (name, distance, trauma_level, is_active) VALUES ('Inactive Hospital', '5 miles', 3, false)"
    );

    const res = await request(app)
      .get('/hospitals?isActive=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hospitals.every(h => h.is_active === true)).toBe(true);

    const inactive = res.body.hospitals.find(h => h.name === 'Inactive Hospital');
    expect(inactive).toBeUndefined();
  });
});

describe('GET /hospitals/:id', () => {
  it('returns single hospital', async () => {
    const { token } = await getToken();

    // Get the seeded hospital's id
    const listRes = await request(app)
      .get('/hospitals')
      .set('Authorization', `Bearer ${token}`);

    const hospitalId = listRes.body.hospitals[0].hospital_id;

    const res = await request(app)
      .get(`/hospitals/${hospitalId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hospital).toBeDefined();
    expect(res.body.hospital.hospital_id).toBe(hospitalId);
    expect(res.body.hospital.name).toBe('Test Hospital');
  });
});

describe('POST /hospitals', () => {
  it('Commander creates hospital and returns 201', async () => {
    const { token } = await getToken({ role: 'Commander' });

    const res = await request(app)
      .post('/hospitals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Hospital',
        distance: '3 miles',
        trauma_level: 2,
        is_active: true
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.hospital).toBeDefined();
    expect(res.body.hospital.name).toBe('New Hospital');
    expect(res.body.hospital.distance).toBe('3 miles');
    expect(res.body.hospital.trauma_level).toBe(2);
    expect(res.body.hospital.is_active).toBe(true);
    expect(res.body.hospital.hospital_id).toBeDefined();
  });
});

describe('PUT /hospitals/:id', () => {
  it('updates hospital name', async () => {
    const { token } = await getToken({ role: 'Commander' });

    // Get the seeded hospital's id
    const listRes = await request(app)
      .get('/hospitals')
      .set('Authorization', `Bearer ${token}`);

    const hospitalId = listRes.body.hospitals[0].hospital_id;

    const res = await request(app)
      .put(`/hospitals/${hospitalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Hospital Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hospital.name).toBe('Updated Hospital Name');
    expect(res.body.hospital.hospital_id).toBe(hospitalId);
  });
});

describe('DELETE /hospitals/:id', () => {
  it('deletes hospital', async () => {
    const { token } = await getToken({ role: 'Commander' });

    // Get the seeded hospital's id
    const listRes = await request(app)
      .get('/hospitals')
      .set('Authorization', `Bearer ${token}`);

    const hospitalId = listRes.body.hospitals[0].hospital_id;

    const res = await request(app)
      .delete(`/hospitals/${hospitalId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);

    // Verify it no longer exists
    const getRes = await request(app)
      .get(`/hospitals/${hospitalId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });
});

describe('Auth', () => {
  it('GET /hospitals without token returns 401', async () => {
    const res = await request(app)
      .get('/hospitals');

    expect(res.status).toBe(401);
  });
});
