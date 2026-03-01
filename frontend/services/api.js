// API Service for connecting frontend to backend
// Base URL: https://emertgency.mayahuizar.com

// const API_BASE_URL = 'https://emertgency.mayahuizar.com';
const API_BASE_URL ='http://100.69.38.177:3000';

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
};

// professional endpoints (REST-style)
export const professionalAPI = {
  // GET /professionals
  getProfessionals: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/professionals?${queryString}` : '/professionals';
    return await apiRequest(endpoint);
  },

  // GET /professionals/:id
  getProfessional: async (id) => {
    return await apiRequest(`/professionals/${id}`);
  },

  // GET /professionals/:id/tasks
  getProfessionalTasks: async (id) => {
    return await apiRequest(`/professionals/${id}/tasks`);
  },

  // PUT /professionals/:id
  updateProfessional: async (id, data) => {
    return await apiRequest(`/professionals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  // GET /event/:eventId/statistics
  getEventStatistics: async (eventId) => {
    return await apiRequest(`/event/${eventId}/statistics`);
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

  // GET /event/active - returns active event (404 if none; same concept as drills /active)
  getActiveEvent: async () => {
    return await apiRequest('/event/active');
  },

  // POST /event/start - Commander only; transitions current event to in_progress
  startEvent: async () => {
    return await apiRequest('/event/start', { method: 'POST' });
  },

  // POST /event/stop - Commander only; transitions current event to finished
  stopEvent: async () => {
    return await apiRequest('/event/stop', { method: 'POST' });
  },

  // POST /event/leave
  leaveEvent: async () => {
    return await apiRequest('/event/leave', {
      method: 'POST',
    });
  },
};

// camp endpoints

export const campAPI = {
  // GET /camps (optional ?eventId filter)
  getCamps: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/camps?${queryString}` : '/camps';
    return await apiRequest(endpoint);
  },

  // GET /camps/:id (optional eventId to verify camp belongs to event)
  getCamp: async (id, eventId = null) => {
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
    return await apiRequest(`/camps/${id}${query}`);
  },

  // POST /camps
  createCamp: async (campData) => {
    return await apiRequest('/camps', {
      method: 'POST',
      body: JSON.stringify(campData),
    });
  },

  // PUT /camps/:id (eventId required in updates or as third param)
  updateCamp: async (id, updates, eventId = null) => {
    const body = { ...updates };
    if (eventId) body.eventId = eventId;
    return await apiRequest(`/camps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  // DELETE /camps/:id (eventId required; ?force=true if camp has assignments)
  deleteCamp: async (id, force = false, eventId = null) => {
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    if (eventId) params.set('eventId', eventId);
    const queryString = params.toString();
    return await apiRequest(`/camps/${id}${queryString ? `?${queryString}` : ''}`, {
      method: 'DELETE',
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

  // GET /casualties/statistics (optional ?event_id for event-scoped stats)
  getCasualtyStatistics: async (eventId = null) => {
    const params = eventId ? { event_id: eventId } : {};
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/casualties/statistics?${queryString}` : '/casualties/statistics';
    return await apiRequest(endpoint);
  },

  // GET /casualties/:casualtyId - get single casualty (REST-style)
  getCasualty: async (casualtyId) => {
    return await apiRequest(`/casualties/${casualtyId}`);
  },

  // POST /casualties - create (REST-style; accepts eventId, campId, optional injuredPersonId; idempotent)
  createCasualty: async (casualtyData) => {
    return await apiRequest('/casualties', {
      method: 'POST',
      body: JSON.stringify(casualtyData),
    });
  },

  // Alias for createCasualty (POST /casualties)
  addCasualty: async (casualtyData) => {
    return casualtyAPI.createCasualty(casualtyData);
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

  // GET /casualties/:casualtyId/history - Audit log with professional names
  getCasualtyHistory: async (casualtyId) => {
    return await apiRequest(`/casualties/${casualtyId}/history`);
  },
};

// drill endpoints (proxied to events - see DRILLS_EVENTS_MERGE.md for compatibility notes)
// Note: Events require Commander role for create/update/delete/start/stop; drills did not.

// export const drillAPI = {
//   // GET /event/active - returns { event } (drill clients: use response.event, not response.drill)
//   getActiveDrill: async () => {
//     return await apiRequest('/event/active');
//   },

//   // POST /event/create - Commander only. Drills allowed any user to save drafts.
//   saveDrill: async (data) => {
//     const eventData = {
//       name: data.drillName ?? data.name,
//       location: data.location ?? null,
//       start_time: data.date ?? data.drill_date ?? data.start_time,
//     };
//     return await apiRequest('/event/create', {
//       method: 'POST',
//       body: JSON.stringify(eventData),
//     });
//   },

//   // POST /event/start - Commander only. Drills allowed any user.
//   startDrill: async () => {
//     return await apiRequest('/event/start', {
//       method: 'POST',
//     });
//   },

//   // POST /event/stop - Commander only. Drills allowed any user.
//   stopDrill: async () => {
//     return await apiRequest('/event/stop', {
//       method: 'POST',
//     });
//   },

//   // PUT /event/update/:eventId - Commander only.
//   updateDrill: async (id, data) => {
//     const updates = {};
//     if (data.drillName !== undefined || data.name !== undefined) {
//       updates.name = data.drillName ?? data.name;
//     }
//     if (data.location !== undefined) updates.location = data.location;
//     if (data.date !== undefined || data.drill_date !== undefined || data.start_time !== undefined) {
//       updates.start_time = data.date ?? data.drill_date ?? data.start_time;
//     }
//     return await apiRequest(`/event/update/${id}`, {
//       method: 'PUT',
//       body: JSON.stringify(updates),
//     });
//   },

//   // DELETE /event/delete/:eventId - Commander only.
//   deactivateDrill: async (id) => {
//     return await apiRequest(`/event/delete/${id}`, {
//       method: 'DELETE',
//     });
//   },
// };

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

  // DELETE /tasks/:taskId - Soft delete (cancel) by default. Use deleteTask(taskId, true) for permanent.
  deleteTask: async (taskId, permanent = false) => {
    const queryString = permanent ? '?permanent=true' : '';
    return await apiRequest(`/tasks/${taskId}${queryString}`, {
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

// hospital endpoints (CRUD)

export const hospitalAPI = {
  // GET /hospitals (optional ?isActive=true/false)
  getHospitals: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/hospitals?${queryString}` : '/hospitals';
    return await apiRequest(endpoint);
  },

  // GET /hospitals/:id
  getHospital: async (id) => {
    return await apiRequest(`/hospitals/${id}`);
  },

  // POST /hospitals
  createHospital: async (data) => {
    return await apiRequest('/hospitals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // PUT /hospitals/:id
  updateHospital: async (id, data) => {
    return await apiRequest(`/hospitals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // DELETE /hospitals/:id
  deleteHospital: async (id) => {
    return await apiRequest(`/hospitals/${id}`, {
      method: 'DELETE',
    });
  },
};

export const analyticsAPI = {
  // GET /locations/active
  getActiveLocations: async () => {
    return await apiRequest('/locations/active');
  },

  // GET /hospitals - list of hospitals (from hospitals API)
  getHospitals: async (params = {}) => {
    return await hospitalAPI.getHospitals(params);
  },

  // GET /reports/hospital-transfers - hospitals + transfer statistics
  getHospitalTransfers: async () => {
    return await apiRequest('/reports/hospital-transfers');
  },

  // GET /reports/summary
  getSummaryReport: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/reports/summary?${queryString}` : '/reports/summary';
    return await apiRequest(endpoint);
  },
};

