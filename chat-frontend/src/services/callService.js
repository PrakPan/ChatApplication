import api from './api';

export const callService = {
  initiateCall: async (hostId) => {
    const response = await api.post('/calls/initiate', { hostId });
    return response;
  },

  acceptCall: async (callId) => {
    const response = await api.post('/calls/accept', { callId });
    return response;
  },

  endCall: async (callId) => {
    const response = await api.post('/calls/end', { callId });
    return response;
  },

  rateCall: async (callId, rating, feedback) => {
    const response = await api.post('/calls/rate', { callId, rating, feedback });
    return response;
  },

  getHistory: async (params) => {
    const response = await api.get('/calls/history', { params });
    return response;
  },

  getDetails: async (callId) => {
    const response = await api.get(`/calls/${callId}`);
    return response;
  },
};