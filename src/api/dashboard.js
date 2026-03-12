import { api } from './client.js';

export const getDashboard = (period = 'today') => api.get('/api/shop/dashboard', { period });
