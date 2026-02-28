/**
 * Commander flow API – talks to emertgency-backend (commander server).
 * Base URL can be overridden via env or constant when backends are integrated.
 */
// Commander backend default port 5010. For Expo Go on device use your machine IP: EXPO_PUBLIC_COMMANDER_API_URL=http://100.69.38.177:5010/api
const COMMANDER_API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_COMMANDER_API_URL) ||
  'http://localhost:5010/api';

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
    const professional = data.professional;
    if (token) {
      await setCommanderAuth(token, professional || data.user);
    }
    return { success: true, token, professional: professional || data.user };
  },

  async logout() {
    await clearCommanderAuth();
  },

  async getCurrentUser() {
    return request('/auth/me', { method: 'GET' });
  },

  async getCasualtyStatistics() {
    const data = await request('/casualties/statistics', { method: 'GET' });
    return data.data || data;
  },

  async getResourceRequests() {
    const data = await request('/resources', { method: 'GET' });
    return data.data || data || [];
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

  async getProfessionals() {
    const data = await request('/professionals', { method: 'GET' });
    const list = Array.isArray(data) ? data : data.data || [];
    return list.map(normalizeProfessional);
  },

  async getProfessional(id) {
    const data = await request(`/professionals/${id}`, { method: 'GET' });
    return normalizeProfessional(data);
  },

  async updateProfessional(id, body) {
    const data = await request(`/professionals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return normalizeProfessional(data);
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
    currentCampId: row.current_camp_id ?? row.currentCampId,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

export default commanderApi;
