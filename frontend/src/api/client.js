// Thin fetch wrapper for the S-Clearance REST API. Holds the bearer token and
// normalises server errors into Error objects with a `status` property.

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'mclears.token';

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }

let unauthorizedHandler = null;

export const getToken = () => token;
export const hasToken = () => !!token;

export function setToken(value) {
  token = value || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join('; ');
  }
  return `Request failed (${status}).`;
}

export async function apiRequest(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_URL + path, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Make sure the API is running.');
  }

  if (response.status === 401 && token) {
    setToken(null);
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch { /* non-JSON error body */ }
    const error = new Error(errorMessage(data, response.status));
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.blob();
}
