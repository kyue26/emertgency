/**
 * Commander flow API – talks to backend (main server).
 * Base URL can be overridden via env: EXPO_PUBLIC_COMMANDER_API_URL
 */
// Backend default port 3000. For Expo Go on device use your machine IP: EXPO_PUBLIC_COMMANDER_API_URL=http://10.0.0.3:3000
const COMMANDER_API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_COMMANDER_API_URL) ||
  'http://localhost:3000';

const COMMANDER_TOKEN_KEY = '@emertgency:commander_auth_token';
const COMMANDER_USER_KEY = '@emertgency:commander_user';

const getAsyncStorage = () =>
  require('@react-native-async-storage/async-storage').default;

export const getCommanderToken = async () => {
  try {
    const AsyncStorage = getAsyncStorage();
    return await AsyncStorage.getItem(COMMANDER_TOKEN_KEY);
  } catch (e) {
    console.error('Error getting commander token:', e);
    return null;
  }
};

export const setCommanderAuth = async (token, user) => {
  try {
    const AsyncStorage = getAsyncStorage();
    await AsyncStorage.setItem(COMMANDER_TOKEN_KEY, token);
    if (user) {
      await AsyncStorage.setItem(COMMANDER_USER_KEY, JSON.stringify(user));
    }
  } catch (e) {
    console.error('Error storing commander auth:', e);
  }
};

export const clearCommanderAuth = async () => {
  try {
    const AsyncStorage = getAsyncStorage();
    await AsyncStorage.multiRemove([COMMANDER_TOKEN_KEY, COMMANDER_USER_KEY]);
  } catch (e) {
    console.error('Error clearing commander auth:', e);
  }
};

export const getCommanderUser = async () => {
  try {
    const AsyncStorage = getAsyncStorage();
    const raw = await AsyncStorage.getItem(COMMANDER_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Error getting commander user:', e);
    return null;
  }
};

const request = async (endpoint, options = {}) => {
  const token = await getCommanderToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${COMMANDER_API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `Request failed: ${res.status}`);
    err.response = data;
    err.status = res.status;
    throw err;
  }
  return data;
};

const commanderApi = {
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token;
    const professional = data.professional || data.user;
    if (token) {
      await setCommanderAuth(token, professional);
    }
    return { success: true, token, professional };
  },

  async logout() {
    await clearCommanderAuth();
  },

  async getCurrentUser() {
    const data = await request('/auth/me', { method: 'GET' });
    return data.user || data;
  },

  async getCasualtyStatistics(eventId = null) {
    const qs = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
    const data = await request(`/casualties/statistics${qs}`, { method: 'GET' });
    return data.data || data;
  },

  async getResourceRequests() {
    const data = await request('/resources', { method: 'GET' });
    return data.resourceRequests || data.data || (Array.isArray(data) ? data : []);
  },

  async getActiveDrill() {
    try {
      return await request('/drills/active', { method: 'GET' });
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async createOrUpdateDrill(payload) {
    return request('/drills', {
      method: 'POST',
      body: JSON.stringify({
        drillName: payload.drillName,
        location: payload.location,
        date: payload.date,
        roleAssignments: payload.roleAssignments || {},
      }),
    });
  },

  async startDrill(payload) {
    return request('/drills', {
      method: 'POST',
      body: JSON.stringify({
        drillName: payload.drillName,
        location: payload.location,
        date: payload.date,
        roleAssignments: payload.roleAssignments || {},
      }),
    });
  },

  async stopDrill() {
    return request('/drills/stop', { method: 'POST' });
  },

  async getProfessionals() {
    const data = await request('/professionals', { method: 'GET' });
    const list = Array.isArray(data) ? data : data.professionals || data.data || [];
    return list.map(normalizeProfessional);
  },

  async getProfessional(id) {
    const data = await request(`/professionals/${id}`, { method: 'GET' });
    const row = data.professional ?? data;
    return normalizeProfessional(row);
  },

  async updateProfessional(id, body) {
    const data = await request(`/professionals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const row = data.professional ?? data;
    return normalizeProfessional(row);
  },

  /** Register new user (Commander flow) – calls backend POST /auth/register */
  async registerUser(name, email, password, phone_number, role) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone_number, role }),
    });
    return data;
  },

  // Event endpoints (Commander-only: create, manage, invite code)
  async createEvent(eventData) {
    return request('/event/create', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  async getCurrentEvent() {
    return request('/event/current', { method: 'GET' });
  },

  async getActiveEvent() {
    try {
      return await request('/event/active', { method: 'GET' });
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async updateEvent(eventId, updates) {
    return request(`/event/update/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async startEvent() {
    return request('/event/start', { method: 'POST' });
  },

  async stopEvent() {
    return request('/event/stop', { method: 'POST' });
  },

  async getInviteCode(eventId) {
    return request(`/event/${eventId}/invite-code`, { method: 'GET' });
  },

  async joinEvent(inviteCode, campId = null) {
    const body = { invite_code: inviteCode };
    if (campId) body.camp_id = campId;
    return request('/event/join', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getChecklistData(eventId) {
    const data = await request(`/event/${eventId}/checklist-data`, { method: 'GET' });
    return data.data || data;
  },

  async putChecklistData(eventId, payload) {
    const data = await request(`/event/${eventId}/checklist-data`, {
      method: 'PUT',
      body: JSON.stringify({ payload }),
    });
    return data.data || data;
  },
};

function normalizeProfessional(row) {
  if (!row) return row;
  return {
    professionalId: row.professional_id ?? row.professionalId,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number ?? row.phoneNumber,
    role: row.role,
    groupId: row.group_id ?? row.groupId,
    currentEventId: row.current_event_id ?? row.currentEventId,
    currentCampId: row.current_camp_id ?? row.currentCampId,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

export default commanderApi;
