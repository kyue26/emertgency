import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api';

const TOKEN_KEY = '@emertgency_token';
const USER_KEY = '@emertgency_user';

// get stored token
export const getStoredToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// store token
export const storeToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

// store user data
export const storeUser = async (user) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error storing user:', error);
  }
};

// get stored user
export const getStoredUser = async () => {
  try {
    const userStr = await AsyncStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// clear stored data
export const clearStoredData = async () => {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// base fetch function with authentication
const apiCall = async (endpoint, options = {}) => {
  const token = await getStoredToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// auth API functions
export const authAPI = {
  login: async (email, password) => {
    const response = await apiCall(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.token) {
      await storeToken(response.token);
      await storeUser(response.user);
    }
    
    return response;
  },

  register: async (userData) => {
    const endpoint = API_ENDPOINTS.AUTH.REGISTER;
    const url = `${API_BASE_URL}${endpoint}`;
    const requestBody = JSON.stringify(userData);
    const token = await getStoredToken();
    
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      const data = await response.json();

      if (!response.ok) {
        // Return the full error response so we can access errors array
        return {
          success: false,
          message: data.message || 'Registration failed',
          errors: data.errors || null,
        };
      }
      
      if (data.success && data.token) {
        await storeToken(data.token);
        await storeUser(data.user);
      }
      
      return data;
    } catch (error) {
      // Network or other errors
      return {
        success: false,
        message: error.message || 'Registration failed',
        errors: null,
      };
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    return await apiCall(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  updateProfile: async (profileData) => {
    return await apiCall(API_ENDPOINTS.AUTH.UPDATE_PROFILE, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  logout: async () => {
    await clearStoredData();
  },
};

// generic API functions for other endpoints
export const api = {
  get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
  post: (endpoint, data) => apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (endpoint, data) => apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
};

// specific API functions for analytics, casualties, events, groups, tasks

// groups API functions
export const groupsAPI = {
  getAll: () => api.get(API_ENDPOINTS.GROUPS),
  getById: (id) => api.get(`${API_ENDPOINTS.GROUPS}/${id}`),
  create: (data) => api.post(API_ENDPOINTS.GROUPS, data),
  update: (id, data) => api.put(`${API_ENDPOINTS.GROUPS}/${id}`, data),
  delete: (id) => api.delete(`${API_ENDPOINTS.GROUPS}/${id}`),
};

// events API functions
export const eventsAPI = {
  getAll: () => api.get(API_ENDPOINTS.EVENTS),
  getById: (id) => api.get(`${API_ENDPOINTS.EVENTS}/${id}`),
  create: (data) => api.post(API_ENDPOINTS.EVENTS, data),
  update: (id, data) => api.put(`${API_ENDPOINTS.EVENTS}/${id}`, data),
};

// casualties API functions
export const casualtiesAPI = {
  getAll: () => api.get(API_ENDPOINTS.CASUALTIES),
  getById: (id) => api.get(`${API_ENDPOINTS.CASUALTIES}/${id}`),
  create: (data) => api.post(API_ENDPOINTS.CASUALTIES, data),
  update: (id, data) => api.put(`${API_ENDPOINTS.CASUALTIES}/${id}`, data),
};

// tasks API functions
export const tasksAPI = {
  getAll: () => api.get(API_ENDPOINTS.TASKS),
  getById: (id) => api.get(`${API_ENDPOINTS.TASKS}/${id}`),
  create: (data) => api.post(API_ENDPOINTS.TASKS, data),
  update: (id, data) => api.put(`${API_ENDPOINTS.TASKS}/${id}`, data),
  delete: (id) => api.delete(`${API_ENDPOINTS.TASKS}/${id}`),
};