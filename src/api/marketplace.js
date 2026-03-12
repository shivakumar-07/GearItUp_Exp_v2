import { api } from './client.js';

export const searchMarketplace = (params) => api.get('/api/marketplace/search', params);
export const createOrder = (data) => api.post('/api/marketplace/orders', data);
export const updateOrderStatus = (id, status) => api.put(`/api/marketplace/orders/${id}/status`, { status });
export const trackOrder = (id) => api.get(`/api/marketplace/orders/${id}/track`);
