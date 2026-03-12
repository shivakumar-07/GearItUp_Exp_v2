import { api } from './client.js';

export const createInvoice = (data) => api.post('/api/billing/invoice', data);
export const getInvoices = (params) => api.get('/api/billing/invoices', params);
export const getInvoicePdfUrl = (id) => `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/billing/invoice/${id}/pdf`;
export const sendInvoiceWhatsApp = (id) => api.post(`/api/billing/invoice/${id}/send-whatsapp`, {});
