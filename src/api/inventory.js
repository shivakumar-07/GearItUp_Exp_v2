import { api } from './client.js';

export const getInventory = () => api.get('/api/shop/inventory');
export const addInventory = (data) => api.post('/api/shop/inventory', data);
export const updateInventory = (id, data) => api.put(`/api/shop/inventory/${id}`, data);
export const getMovements = (id) => api.get(`/api/shop/inventory/${id}/movements`);
export const recordPurchase = (data) => api.post('/api/shop/inventory/purchase', data);
export const recordAdjustment = (data) => api.post('/api/shop/inventory/adjust', data);
export const searchCatalog = (params) => api.get('/api/catalog/search', params);
