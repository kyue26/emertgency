// API Service for connecting frontend to backend (member flow).
// Set EXPO_PUBLIC_API_URL in .env: simulator → http://localhost:3000  device → http://YOUR_IP:3000
const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3000';

// token storage key
const TOKEN_KEY = '@emertgency:auth_token';
const USER_KEY = '@emertgency:user';

// helper to get stored token
export const getStoredToken = async () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

// helper to store token
export const storeToken = async (token) => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

// helper to remove token
export const removeToken = async () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// helper to store user
export const storeUser = async (user) => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error storing user:', error);
  }
};

// helper to get stored user
export const getStoredUser = async () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const userStr = await AsyncStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting stored user:', error);
    return null;
  }
};

// main API request function
const apiRequest = async (endpoint, options = {}) => {
  const token = await getStoredToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      // Attach the full error response to the error object
      const error = new Error(data.message || `An error occurred: ${response.status}`);
      error.response = data;
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// ==================== AUTH ENDPOINTS ====================

export const authAPI = {
  // POST /auth/login
  login: async (email, password) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.token) {
      await storeToken(response.token);
      if (response.user) {
        await storeUser(response.user);
      }
    }
    
    return response;
  },

  // POST /auth/register
  register: async (name, email, password, phone_number, role) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone_number, role }),
    });
    
    if (response.success && response.token) {
      await storeToken(response.token);
      if (response.user) {
        await storeUser(response.user);
      }
    }
    
    return response;
  },

  // POST /auth/change-password
  changePassword: async (currentPassword, newPassword) => {
    return await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // PUT /auth/update
  updateProfile: async (updates) => {
    return await apiRequest('/auth/update', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Logout (local only)
  logout: async () => {
    await removeToken();
  },

  // GET /auth/professionals
  getProfessionals: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/auth/professionals?${queryString}` : '/auth/professionals';
    return await apiRequest(endpoint);
  },
};

// event endpoints

export const eventAPI = {
  // GET /event
  getEvents: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/event?${queryString}` : '/event';
    return await apiRequest(endpoint);
  },

  // GET /event/:eventId
  getEvent: async (eventId) => {
    return await apiRequest(`/event/${eventId}`);
  },

  // POST /event/create
  createEvent: async (eventData) => {
    return await apiRequest('/event/create', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  // PUT /event/update/:eventId
  updateEvent: async (eventId, updates) => {
    return await apiRequest(`/event/update/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // DELETE /event/delete/:eventId
  deleteEvent: async (eventId, force = false) => {
    const queryString = force ? '?force=true' : '';
    return await apiRequest(`/event/delete/${eventId}${queryString}`, {
      method: 'DELETE',
    });
  },

  // GET /event/:eventId/invite-code
  getInviteCode: async (eventId) => {
    return await apiRequest(`/event/${eventId}/invite-code`);
  },

  // POST /event/join
  joinEvent: async (inviteCode, campId) => {
    const body = { invite_code: inviteCode };
    if (campId) {
      body.camp_id = campId;
    }
    return await apiRequest('/event/join', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // GET /event/current
  getCurrentEvent: async () => {
    return await apiRequest('/event/current');
  },

  // POST /event/leave
  leaveEvent: async () => {
    return await apiRequest('/event/leave', {
      method: 'POST',
    });
  },
};

// casualty endpoints

export const casualtyAPI = {
  // GET /casualties
  getCasualties: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/casualties?${queryString}` : '/casualties';
    return await apiRequest(endpoint);
  },

  // POST /casualties/add
  addCasualty: async (casualtyData) => {
    return await apiRequest('/casualties/add', {
      method: 'POST',
      body: JSON.stringify(casualtyData),
    });
  },

  // PUT /casualties/update/:casualtyId/status
  updateCasualty: async (casualtyId, updates) => {
    return await apiRequest(`/casualties/update/${casualtyId}/status`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // DELETE /casualties/:casualtyId
  deleteCasualty: async (casualtyId) => {
    return await apiRequest(`/casualties/${casualtyId}`, {
      method: 'DELETE',
    });
  },

  // GET /casualties/:casualtyId/history
  getCasualtyHistory: async (casualtyId) => {
    return await apiRequest(`/casualties/${casualtyId}/history`);
  },
};

// task endpoints

export const taskAPI = {
  // GET /tasks
  getTasks: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';
    return await apiRequest(endpoint);
  },

  // GET /tasks/:taskId
  getTask: async (taskId) => {
    return await apiRequest(`/tasks/${taskId}`);
  },

  // POST /tasks/create
  createTask: async (taskData) => {
    return await apiRequest('/tasks/create', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  // PUT /tasks/update/:taskId
  updateTask: async (taskId, updates) => {
    return await apiRequest(`/tasks/update/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // DELETE /tasks/delete/:taskId
  deleteTask: async (taskId) => {
    return await apiRequest(`/tasks/delete/${taskId}`, {
      method: 'DELETE',
    });
  },
};

// group endpoints

export const groupAPI = {
  // GET /groups
  getGroups: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/groups?${queryString}` : '/groups';
    return await apiRequest(endpoint);
  },

  // GET /groups/:groupId
  getGroup: async (groupId) => {
    return await apiRequest(`/groups/${groupId}`);
  },

  // POST /groups/register
  createGroup: async (groupData) => {
    return await apiRequest('/groups/register', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  },

  // PUT /groups/update/:groupId
  updateGroup: async (groupId, updates) => {
    return await apiRequest(`/groups/update/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // POST /groups/:groupId/members/add
  addMember: async (groupId, professionalId) => {
    return await apiRequest(`/groups/${groupId}/members/add`, {
      method: 'POST',
      body: JSON.stringify({ professional_id: professionalId }),
    });
  },

  // DELETE /groups/:groupId/members/remove/:professionalId
  removeMember: async (groupId, professionalId) => {
    return await apiRequest(`/groups/${groupId}/members/remove/${professionalId}`, {
      method: 'DELETE',
    });
  },

  // DELETE /groups/delete/:groupId
  deleteGroup: async (groupId, force = false) => {
    const queryString = force ? '?force=true' : '';
    return await apiRequest(`/groups/delete/${groupId}${queryString}`, {
      method: 'DELETE',
    });
  },
};

// shift endpoints

export const shiftAPI = {
  checkIn: async () => {
    return await apiRequest('/shifts/check-in', { method: 'POST' });
  },

  checkOut: async () => {
    return await apiRequest('/shifts/check-out', { method: 'POST' });
  },

  getMyShifts: async () => {
    return await apiRequest('/shifts/my-shifts');
  },
};

// analytics endpoints

export const analyticsAPI = {
  // GET /locations/active
  getActiveLocations: async () => {
    return await apiRequest('/locations/active');
  },

  // GET /hospitals
  getHospitals: async () => {
    return await apiRequest('/hospitals');
  },

  // GET /reports/summary
  getSummaryReport: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/reports/summary?${queryString}` : '/reports/summary';
    return await apiRequest(endpoint);
  },
};

