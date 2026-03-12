// API client — thin wrapper around fetch with auth token handling
// Rule: access token in MEMORY only, refresh token in httpOnly cookie
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// In-memory token store (NOT localStorage — XSS protection)
let accessToken = null;

export const setTokens = (access, refresh) => {
  if (access) accessToken = access;
  // Backwards compat: if refresh is passed, store in localStorage
  // until httpOnly cookies are fully deployed
  if (refresh) {
    try { localStorage.setItem('as_refresh_token', refresh); } catch {}
  }
};

export const clearTokens = () => {
  accessToken = null;
  try { localStorage.removeItem('as_refresh_token'); } catch {}
};

export const getAccessToken = () => accessToken;

// Try to refresh the access token silently
async function refreshAccessToken() {
  // First try httpOnly cookie (server reads it automatically via credentials: include)
  // Fall back to localStorage refresh token for backwards compat
  const fallbackToken = (() => {
    try { return localStorage.getItem('as_refresh_token'); } catch { return null; }
  })();

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // CRITICAL: sends the httpOnly cookie
    body: JSON.stringify({ refreshToken: fallbackToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Session expired. Please login again.');
  }

  const data = await res.json();
  // Server returns new access token; cookie is auto-updated by Set-Cookie header
  accessToken = data.accessToken || data.data?.accessToken;
  // Backwards compat: store new refresh token if returned in body
  if (data.refreshToken) {
    try { localStorage.setItem('as_refresh_token', data.refreshToken); } catch {}
  }
  return accessToken;
}

export async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',  // Always send cookies
    });
  } catch (err) {
    // Network error (offline, CORS, etc.)
    throw Object.assign(new Error('Network error. Please check your connection.'), {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  // Token expired — try refresh once
  if (res.status === 401 && !options._isRetry) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code || body?.code || '';
    if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN' || code === 'NO_TOKEN') {
      try {
        const newToken = await refreshAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
          _isRetry: true,
        });
      } catch {
        throw Object.assign(new Error('Session expired. Please login again.'), {
          status: 401,
          code: 'SESSION_EXPIRED',
        });
      }
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.error || data?.message || 'Request failed';
    const errCode = data?.error?.code || data?.code || `HTTP_${res.status}`;
    throw Object.assign(new Error(errMsg), { status: res.status, code: errCode, data });
  }
  return data;
}

// Convenience methods
export const api = {
  get: (path, params) => {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path;
    return apiRequest(url);
  },
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};
