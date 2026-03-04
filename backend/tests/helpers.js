const request = require('supertest');
const app = require('../app');

let userCounter = 0;

function uniqueEmail() {
  userCounter++;
  return `test${userCounter}_${Date.now()}@pennmert.org`;
}

const DEFAULT_PASSWORD = 'TestPassword1$xx';

async function registerUser(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const res = await request(app)
    .post('/auth/register')
    .send({
      name: overrides.name || 'Test User',
      email,
      password: overrides.password || DEFAULT_PASSWORD,
      role: overrides.role || 'Commander',
      ...overrides
    });
  return res;
}

async function loginUser(email, password = DEFAULT_PASSWORD) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password });
  return res;
}

async function getToken(overrides = {}) {
  const regRes = await registerUser(overrides);
  return {
    token: regRes.body.token,
    user: regRes.body.user,
    email: regRes.body.user.email
  };
}

async function createEvent(token, overrides = {}) {
  const res = await request(app)
    .post('/event/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: overrides.name || 'Test Event',
      location: overrides.location || 'Test Location',
      status: overrides.status || 'in_progress',
      ...overrides
    });
  return res;
}

async function createCamp(token, eventId, overrides = {}) {
  const res = await request(app)
    .post(`/event/${eventId}/camps/create`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      location_name: overrides.location_name || 'Test Camp',
      capacity: overrides.capacity || 50,
      ...overrides
    });
  return res;
}

async function createCasualty(token, eventId, overrides = {}) {
  const res = await request(app)
    .post('/casualties')
    .set('Authorization', `Bearer ${token}`)
    .send({
      event_id: eventId,
      color: overrides.color || 'yellow',
      breathing: true,
      conscious: true,
      bleeding: false,
      ...overrides
    });
  return res;
}

async function createTask(token, eventId, assignedTo, overrides = {}) {
  const res = await request(app)
    .post('/tasks/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      event_id: eventId,
      assigned_to: assignedTo,
      task_description: overrides.task_description || 'Test task description',
      priority: overrides.priority || 'medium',
      ...overrides
    });
  return res;
}

async function createResourceRequest(token, eventId, overrides = {}) {
  const res = await request(app)
    .post('/resources/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      event_id: eventId,
      resource_name: overrides.resource_name || 'Stretcher',
      quantity: overrides.quantity || 1,
      priority: overrides.priority || 'medium',
      ...overrides
    });
  return res;
}

async function createGroup(token, overrides = {}) {
  const res = await request(app)
    .post('/groups/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      group_name: overrides.group_name || `Group ${Date.now()}`,
      max_members: overrides.max_members || 10,
      ...overrides
    });
  return res;
}

module.exports = {
  app,
  request,
  DEFAULT_PASSWORD,
  uniqueEmail,
  registerUser,
  loginUser,
  getToken,
  createEvent,
  createCamp,
  createCasualty,
  createTask,
  createResourceRequest,
  createGroup
};
