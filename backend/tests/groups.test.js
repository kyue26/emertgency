const { app, request, getToken, createGroup } = require('./helpers');
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
});

describe('GET /groups', () => {
  it('returns empty list initially', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.groups).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns groups after creation', async () => {
    const { token } = await getToken();
    await createGroup(token, { group_name: 'Alpha Team' });

    const res = await request(app)
      .get('/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.groups.length).toBe(1);
    expect(res.body.groups[0].group_name).toBe('Alpha Team');
  });

  it('supports include_members query param', async () => {
    const { token } = await getToken();
    await createGroup(token, { group_name: 'Members Team' });

    const res = await request(app)
      .get('/groups?include_members=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.groups[0]).toHaveProperty('members');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/groups');
    expect(res.status).toBe(401);
  });
});

describe('GET /groups/:groupId', () => {
  it('returns single group with members', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Detail Team' });
    const groupId = groupRes.body.group.group_id;

    const res = await request(app)
      .get(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.group.group_id).toBe(groupId);
    expect(res.body.group.group_name).toBe('Detail Team');
  });

  it('returns 404 for nonexistent group', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .get('/groups/nonexistent_group_id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /groups/register', () => {
  it('creates group with creator as lead', async () => {
    const { token, user } = await getToken();

    const res = await request(app)
      .post('/groups/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ group_name: 'New Group', max_members: 15 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.group.group_name).toBe('New Group');
    expect(res.body.group.lead_professional_id).toBe(user.professional_id);
    expect(res.body.group.max_members).toBe(15);
  });

  it('rejects duplicate group name', async () => {
    const { token } = await getToken();
    await createGroup(token, { group_name: 'Unique Name' });

    // Use a different user so the "already in a group" check doesn't fire first
    const { token: token2 } = await getToken({ name: 'Second Creator' });

    const res = await request(app)
      .post('/groups/register')
      .set('Authorization', `Bearer ${token2}`)
      .send({ group_name: 'Unique Name' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects group_name too short', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .post('/groups/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ group_name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /groups/update/:groupId', () => {
  it('Commander updates group name', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Old Group Name' });
    const groupId = groupRes.body.group.group_id;

    const res = await request(app)
      .put(`/groups/update/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ group_name: 'New Group Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.group.group_name).toBe('New Group Name');
    expect(res.body.changes).toContain('group_name');
  });

  it('returns 400 with no changes', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Same Name' });
    const groupId = groupRes.body.group.group_id;

    const res = await request(app)
      .put(`/groups/update/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ group_name: 'Same Name' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent group', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .put('/groups/update/nonexistent_id')
      .set('Authorization', `Bearer ${token}`)
      .send({ group_name: 'Whatever' });

    expect(res.status).toBe(404);
  });
});

describe('POST /groups/:groupId/members/add', () => {
  it('adds a member to the group', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Add Member Team' });
    const groupId = groupRes.body.group.group_id;

    const { user: newMember } = await getToken({ name: 'New Member' });

    const res = await request(app)
      .post(`/groups/${groupId}/members/add`)
      .set('Authorization', `Bearer ${token}`)
      .send({ professional_id: newMember.professional_id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/added/i);
  });

  it('rejects adding member already in another group', async () => {
    const { token } = await getToken();
    const group1Res = await createGroup(token, { group_name: 'Group One' });

    const { token: token2, user: user2 } = await getToken({ name: 'Member Two' });
    const group2Res = await createGroup(token2, { group_name: 'Group Two' });

    const res = await request(app)
      .post(`/groups/${group1Res.body.group.group_id}/members/add`)
      .set('Authorization', `Bearer ${token}`)
      .send({ professional_id: user2.professional_id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already/i);
  });
});

describe('DELETE /groups/:groupId/members/remove/:professionalId', () => {
  it('removes a member from the group', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Remove Member Team' });
    const groupId = groupRes.body.group.group_id;

    const { user: member } = await getToken({ name: 'Removable Member' });

    await request(app)
      .post(`/groups/${groupId}/members/add`)
      .set('Authorization', `Bearer ${token}`)
      .send({ professional_id: member.professional_id });

    const res = await request(app)
      .delete(`/groups/${groupId}/members/remove/${member.professional_id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('cannot remove the group leader', async () => {
    const { token, user } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Leader Team' });
    const groupId = groupRes.body.group.group_id;

    const res = await request(app)
      .delete(`/groups/${groupId}/members/remove/${user.professional_id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/leader/i);
  });
});

describe('DELETE /groups/delete/:groupId', () => {
  it('Commander deletes empty group', async () => {
    const { token, user } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Deletable Group' });
    const groupId = groupRes.body.group.group_id;

    // Remove the lead from the group first so it's empty
    await pool.query('UPDATE professionals SET group_id = NULL WHERE professional_id = $1', [user.professional_id]);

    const res = await request(app)
      .delete(`/groups/delete/${groupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('refuses to delete group with members unless force=true', async () => {
    const { token } = await getToken();
    const groupRes = await createGroup(token, { group_name: 'Full Group' });
    const groupId = groupRes.body.group.group_id;

    const refuseRes = await request(app)
      .delete(`/groups/delete/${groupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(refuseRes.status).toBe(400);
    expect(refuseRes.body.message).toMatch(/force/i);

    const forceRes = await request(app)
      .delete(`/groups/delete/${groupId}?force=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(forceRes.status).toBe(200);
    expect(forceRes.body.success).toBe(true);
  });

  it('non-Commander cannot delete group', async () => {
    const { token: cmdToken } = await getToken();
    const groupRes = await createGroup(cmdToken, { group_name: 'Protected Group' });
    const groupId = groupRes.body.group.group_id;

    const { token: memberToken } = await getToken({ role: 'MERT Member', name: 'Regular Member' });

    const res = await request(app)
      .delete(`/groups/delete/${groupId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for nonexistent group', async () => {
    const { token } = await getToken();

    const res = await request(app)
      .delete('/groups/delete/nonexistent_id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
