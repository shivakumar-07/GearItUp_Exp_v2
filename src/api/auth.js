import { api, setTokens, clearTokens } from './client.js';

export const requestOtp = (phone) => api.post('/api/auth/request-otp', { phone });

export const verifyOtp = async (phone, otp) => {
  const data = await api.post('/api/auth/verify-otp', { phone, otp });
  setTokens(data.accessToken, data.refreshToken);
  return data;
};

export const logout = async (refreshToken) => {
  await api.post('/api/auth/logout', { refreshToken }).catch(() => {});
  clearTokens();
};

export const getMe = () => api.get('/api/auth/me');

export const registerShop = (shopData) => api.post('/api/auth/register-shop', shopData);
