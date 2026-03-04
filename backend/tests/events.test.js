const { app, request, DEFAULT_PASSWORD, getToken, createEvent, createCamp, createCasualty } = require('./helpers');
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

describe('GET /events', () => {
  it('returns event list with pagination', async () => {
    const { token } = await getToken();
    await createEvent(token, { name: 'Paginated Event' });

    const res = await request(app)
      .get('/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('filters by status query param', async () => {
    const { token } = await getToken();
    await createEvent(token, { name: 'Active Event', status: 'in_progress' });
    await createEvent(token, { name: 'Upcoming Event', status: 'upcoming' });

    const res = await request(app)
      .get('/events?status=upcoming')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.events.length).toBe(1);
    expect(res.body.events[0].status).toBe('upcoming');
  });
});

describe('GET /event/current', () => {
  it('returns current event for user', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Current Event' });

    const res = await request(app)
      .get('/event/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).not.toBeNull();
    expect(res.body.event.name).toBe('Current Event');
    expect(res.body.event.event_id).toBe(eventRes.body.event.event_id);
  });

  it('returns invite_code for Commander', async () => {
    const { token } = await getToken({ role: 'Commander' });
    await createEvent(token, { name: 'Commander Event' });

    const res = await request(app)
      .get('/event/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).not.toBeNull();
    expect(res.body.event.invite_code).toBeDefined();
    expect(res.body.event.invite_code.length).toBeGreaterThan(0);
  });

  it('returns null event when user has no event', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/event/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toBeNull();
  });
});

describe('POST /event/create', () => {
  it('valid creation returns 201 with event object including invite_code', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Emergency Event',
        location: 'City Center',
        status: 'in_progress'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toBeDefined();
    expect(res.body.event.name).toBe('New Emergency Event');
    expect(res.body.event.location).toBe('City Center');
    expect(res.body.event.invite_code).toBeDefined();
    expect(res.body.event.invite_code.length).toBeGreaterThan(0);
    expect(res.body.event.event_id).toBeDefined();
  });

  it('name too short (2 chars) returns 400', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'AB',
        location: 'Somewhere'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects finished as initial status', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Not Work',
        location: 'Nowhere',
        status: 'finished'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/finished/i);
  });
});

describe('PUT /event/update/:eventId', () => {
  it('Commander can update event name', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Old Name' });
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .put(`/event/update/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.name).toBe('Updated Name');
    expect(res.body.changes).toContain('name');
  });

  it('validates status transitions (upcoming cannot go directly to finished)', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Transition Test', status: 'upcoming' });
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .put(`/event/update/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'finished' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot transition/i);
  });
});

describe('POST /event/leave', () => {
  it('user leaves their current event', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Leave Event' });

    // Confirm user is in the event
    const beforeRes = await request(app)
      .get('/event/current')
      .set('Authorization', `Bearer ${token}`);
    expect(beforeRes.body.event).not.toBeNull();

    // Leave the event
    const res = await request(app)
      .post('/event/leave')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/left/i);

    // Confirm user is no longer in any event
    const afterRes = await request(app)
      .get('/event/current')
      .set('Authorization', `Bearer ${token}`);
    expect(afterRes.body.event).toBeNull();
  });

  it('returns 400 when not in any event', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/event/leave')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not currently/i);
  });
});

describe('GET /event/:eventId/invite-code', () => {
  it('Commander can retrieve invite code', async () => {
    const { token } = await getToken({ role: 'Commander' });
    const eventRes = await createEvent(token, { name: 'Invite Code Event' });
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .get(`/event/${eventId}/invite-code`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.invite_code).toBeDefined();
    expect(res.body.event.invite_code.length).toBeGreaterThan(0);
    expect(res.body.event.event_id).toBe(eventId);
  });

  it('non-Commander cannot retrieve invite code', async () => {
    const { token: cmdToken } = await getToken({ role: 'Commander' });
    const eventRes = await createEvent(cmdToken, { name: 'Protected Invite Event' });
    const eventId = eventRes.body.event.event_id;

    const { token: memberToken } = await getToken({ role: 'MERT Member', name: 'Regular User' });

    const res = await request(app)
      .get(`/event/${eventId}/invite-code`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for nonexistent event', async () => {
    const { token } = await getToken({ role: 'Commander' });

    const res = await request(app)
      .get('/event/nonexistent_event_id/invite-code')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /events/join', () => {
  it('valid invite code works, user gets assigned to event', async () => {
    const { token: commanderToken } = await getToken({ role: 'Commander' });
    const eventRes = await createEvent(commanderToken, { name: 'Joinable Event' });
    const inviteCode = eventRes.body.event.invite_code;

    const { token: memberToken } = await getToken({ role: 'Commander', name: 'Joiner User' });

    const res = await request(app)
      .post('/events/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ invite_code: inviteCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toBeDefined();
    expect(res.body.event.event_id).toBe(eventRes.body.event.event_id);
    expect(res.body.event.name).toBe('Joinable Event');
  });

  it('invalid invite code returns 404', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/events/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ invite_code: 'INVALIDCODE' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /events/:eventId/statistics', () => {
  it('returns casualty statistics', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Stats Event' });
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'yellow' });

    const res = await request(app)
      .get(`/events/${eventId}/statistics`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statistics).toBeDefined();
    expect(Number(res.body.statistics.yellow_count)).toBe(1);
  });
});

describe('DELETE /event/delete/:eventId', () => {
  it('deletes event with no associated data', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Deletable Event', status: 'upcoming' });
    const eventId = eventRes.body.event.event_id;

    const res = await request(app)
      .delete(`/event/delete/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('refuses to delete event with casualties unless force=true', async () => {
    const { token } = await getToken();
    const eventRes = await createEvent(token, { name: 'Event With Data' });
    const eventId = eventRes.body.event.event_id;

    await createCasualty(token, eventId, { color: 'red' });

    // Without force -- should be refused
    const refuseRes = await request(app)
      .delete(`/event/delete/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(refuseRes.status).toBe(400);
    expect(refuseRes.body.success).toBe(false);
    expect(refuseRes.body.message).toMatch(/force/i);

    // With force=true -- should succeed
    const forceRes = await request(app)
      .delete(`/event/delete/${eventId}?force=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(forceRes.status).toBe(200);
    expect(forceRes.body.success).toBe(true);
  });
});
