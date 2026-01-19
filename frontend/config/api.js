const API_BASE_URL = 'https://emertgency.mayahuizar.com';

// there is no delete just in case we don't want people randomly deleting data
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    CHANGE_PASSWORD: '/auth/change-password',
    UPDATE_PROFILE: '/auth/update',
  },
  GROUPS: '/groups',
  EVENTS: '/event',
  CASUALTIES: '/casualties',
  TASKS: '/tasks',
  ANALYTICS: '/',
};

export default API_BASE_URL;