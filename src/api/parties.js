import { api } from './client.js';

export const getParties = (type) => api.get('/api/shop/parties', type ? { type } : undefined);
export const createParty = (data) => api.post('/api/shop/parties', data);
export const getPartyLedger = (id) => api.get(`/api/shop/parties/${id}/ledger`);
export const recordPayment = (id, data) => api.post(`/api/shop/parties/${id}/payment`, data);
