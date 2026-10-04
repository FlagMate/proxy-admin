// Shared API client for ProxyCeptor Admin
// Resolves the backend base URL from VITE_SERVER_BASE_URL and always
// returns the parsed JSON envelope: { success, data, total, page, totalPages, error }

const RAW_BASE = (import.meta.env.VITE_SERVER_BASE_URL || '').trim();
// Normalize: strip trailing slash. Empty base => same-origin (dev proxy).
const API_BASE = RAW_BASE.replace(/\/+$/, '');

function buildUrl(path) {
  // path always starts with /admin
  const clean = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${clean}` : clean;
}

export function getToken() {
  return localStorage.getItem('admin_token');
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

/**
 * Core request. Returns the full parsed envelope on success.
 * Throws ApiError on network failure, non-2xx, or { success:false }.
 */
export async function apiRequest(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(buildUrl(path), {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError('Unable to reach the server. Please check that the backend is running.', 0);
  }

  if (res.status === 401) {
    if (unauthorizedHandler) unauthorizedHandler();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    throw new ApiError('The server returned an unexpected response.', res.status);
  }

  if (!res.ok || !json || json.success === false) {
    const msg = (json && json.error) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  return json;
}

export const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiRequest(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
};