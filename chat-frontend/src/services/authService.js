import api from './api';

export const authService = {
  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return response;
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data) {
      localStorage.setItem('accessToken', response.data.token);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response;
  },

  logout: async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response;
  },

  updateProfile: async (data) => {
    const response = await api.put('/auth/profile', data);
    return response;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response;
  },
};