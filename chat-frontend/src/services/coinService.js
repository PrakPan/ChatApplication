import api from './api';

export const coinService = {
  getPackages: async () => {
    const response = await api.get('/coins/packages');
    return response;
  },

  getBalance: async () => {
    const response = await api.get('/coins/balance');
    return response;
  },

  createOrder: async (packageId) => {
    const response = await api.post('/coins/create-order', { packageId });
    return response;
  },

  verifyPayment: async (paymentData) => {
    const response = await api.post('/coins/verify-payment', paymentData);
    return response;
  },

  getTransactions: async (params) => {
    const response = await api.get('/coins/transactions', { params });
    return response;
  },
};