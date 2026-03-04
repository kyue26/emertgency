const { app, request, DEFAULT_PASSWORD, uniqueEmail, registerUser, loginUser, getToken } = require('./helpers');
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

describe('POST /auth/register', () => {
  it('valid registration returns 201, token, and user object', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email,
        password: DEFAULT_PASSWORD,
        role: 'Commander'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', email);
    expect(res.body.user).toHaveProperty('name', 'Test User');
    expect(res.body.user).toHaveProperty('role', 'Commander');
  });

  it('email not @pennmert.org is rejected with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'user@gmail.com',
        password: DEFAULT_PASSWORD,
        role: 'Commander'
      });

    expect(res.status).toBe(400);
  });

  it('password too short (less than 12 chars) rejected with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: uniqueEmail(),
        password: 'Short1$',
        role: 'Commander'
      });

    expect(res.status).toBe(400);
  });

  it('name too short (1 char) rejected with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'A',
        email: uniqueEmail(),
        password: DEFAULT_PASSWORD,
        role: 'Commander'
      });

    expect(res.status).toBe(400);
  });

  it('duplicate email returns 409', async () => {
    const email = uniqueEmail();

    await request(app)
      .post('/auth/register')
      .send({
        name: 'First User',
        email,
        password: DEFAULT_PASSWORD,
        role: 'Commander'
      });

    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Second User',
        email,
        password: DEFAULT_PASSWORD,
        role: 'Commander'
      });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('valid login returns 200, token, and user', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const res = await loginUser(email, DEFAULT_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', email);
  });

  it('wrong password returns 401', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const res = await loginUser(email, 'WrongPassword123$');

    expect(res.status).toBe(401);
  });

  it('nonexistent email returns 401', async () => {
    const res = await loginUser('nonexistent@pennmert.org', DEFAULT_PASSWORD);

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns profile with valid token', async () => {
    const { token, user } = await getToken();

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty('professional_id');
    expect(res.body.user).toHaveProperty('name');
    expect(res.body.user).toHaveProperty('email');
    expect(res.body.user).toHaveProperty('role');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .get('/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('successfully changes password', async () => {
    const email = uniqueEmail();
    const { token } = await getToken({ email });
    const newPassword = 'NewPassword1$xx';

    const changeRes = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: DEFAULT_PASSWORD,
        newPassword
      });

    expect(changeRes.status).toBe(200);

    const oldLoginRes = await loginUser(email, DEFAULT_PASSWORD);
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await loginUser(email, newPassword);
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body).toHaveProperty('token');
  });

  it('wrong current password returns 401', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'WrongPassword1$xx',
        newPassword: 'AnotherPass1$xx'
      });

    expect(res.status).toBe(401);
  });
});

describe('PUT /auth/update', () => {
  it('updates name successfully', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.body.user.name).toBe('Updated Name');
  });

  it('returns 400 when no fields provided', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('DELETE /auth/delete/:userId', () => {
  it('Commander can delete their own account', async () => {
    const { token, user } = await getToken({ role: 'Commander' });

    const res = await request(app)
      .delete(`/auth/delete/${user.professional_id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect([401, 404]).toContain(meRes.status);
  });

  it('returns 403 when non-Commander tries to delete another user', async () => {
    const { token: commanderToken, user: commander } = await getToken({ role: 'Commander' });
    const { token: memberToken } = await getToken({ role: 'MERT Member' });

    const res = await request(app)
      .delete(`/auth/delete/${commander.professional_id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
