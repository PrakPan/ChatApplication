import api from './api';

export const hostService = {
  getOnlineHosts: async (params) => {
    const response = await api.get('/hosts/online', { params });
    return response;
  },

  getHostDetails: async (hostId) => {
    const response = await api.get(`/hosts/${hostId}`);
    return response;
  },

  createProfile: async (data) => {
    const response = await api.post('/hosts/profile', data);
    return response;
  },

  updateProfile: async (data) => {
    const response = await api.put('/hosts/profile', data);
    return response;
  },

  updateOnlineStatus: async (isOnline) => {
    const response = await api.put('/hosts/status', { isOnline });
    return response;
  },

  getEarnings: async () => {
    const response = await api.get('/hosts/me/earnings');
    return response;
  },

  getCallHistory: async (params) => {
    const response = await api.get('/hosts/me/calls', { params });
    return response;
  },
};