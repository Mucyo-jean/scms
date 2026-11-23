// REST client for the S-Clearance FastAPI backend.
//
// The exported names mirror the original mock API so the pages stay unchanged;
// every mutation now goes through an authenticated endpoint and refreshes the
// shared read cache in ./store.

import { apiRequest, getToken, setToken } from './client';
import { getState, refresh, resetState, setState } from './store';

export const CURRENCY = 'RWF';
export const ALLOWED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_FILES = 5;
export const CLEARANCE_REASONS = ['Graduation', 'Transfer', 'Withdrawal', 'End of programme', 'Deferral'];

// ---------- Workflow helpers (shared with the UI) ----------

export const TASK_STATUS = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
export const OVERALL_STATUS = { IN_PROGRESS: 'In Progress', ATTENTION: 'Requires Attention', CLEARED: 'Cleared' };

export function overallStatus(request) {
  const statuses = (request?.tasks ?? []).map((task) => task.status);
  if (statuses.length && statuses.every((status) => status === TASK_STATUS.APPROVED)) return OVERALL_STATUS.CLEARED;
  if (statuses.includes(TASK_STATUS.REJECTED)) return OVERALL_STATUS.ATTENTION;
  return OVERALL_STATUS.IN_PROGRESS;
}

export const progressOf = (request) => {
  const tasks = request?.tasks ?? [];
  const done = tasks.filter((task) => task.status === TASK_STATUS.APPROVED).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
};

// ---------- Auth ----------

export async function login(email, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
  setToken(data.access_token);
  await refresh();
  return getState().me;
}

export async function register(data) {
  const payload = {
    name: data.name,
    email: data.email,
    studentNumber: data.studentNumber,
    programme: data.programme,
    faculty: data.faculty,
    yearOfStudy: data.yearOfStudy,
    phone: data.phone,
    password: data.password,
  };
  const response = await apiRequest('/auth/register', { method: 'POST', body: payload });
  setToken(response.access_token);
  await refresh();
  return getState().me;
}

export const getUser = (id) => getState().users.find((user) => user.id === id) ?? null;

export async function updateProfile(_userId, patch) {
  await apiRequest('/auth/profile', { method: 'PATCH', body: patch });
  await refresh();
  return getState().me;
}

export async function changePassword(_userId, current, next) {
  await apiRequest('/auth/change-password', { method: 'POST', body: { current, next } });
}

// ---------- Documents ----------

export function validateFile(file) {
  if (!ALLOWED_FILE_TYPES[file.type]) return `${file.name}: only ${Object.values(ALLOWED_FILE_TYPES).join(', ')} files are allowed.`;
  if (file.size > MAX_FILE_SIZE) return `${file.name}: file is larger than ${MAX_FILE_SIZE / 1024 / 1024} MB.`;
  return null;
}

// Returns a local descriptor that keeps the native File for the upload.
export const readFile = async (file) => ({
  id: `local_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  name: file.name,
  type: file.type,
  size: file.size,
  file,
  uploadedAt: new Date().toISOString(),
});

export async function fetchDocumentBlob(document) {
  const path = document.url?.startsWith('/api/') ? document.url.slice(4) : document.url;
  const blob = await apiRequest(path);
  // The API streams PDFs as octet-stream (Chrome blocks PDF fetches); put the
  // real MIME type back so the blob previews correctly.
  return new Blob([blob], { type: document.type || blob.type });
}

// ---------- Clearance requests ----------

function documentsForm(documents) {
  const form = new FormData();
  documents.forEach((document) => {
    if (document.file) form.append('files', document.file, document.name);
  });
  return form;
}

export async function submitRequest(_studentId, form, documents) {
  const body = new FormData();
  body.append('payload', JSON.stringify(form));
  documents.forEach((document) => {
    if (document.file) body.append('files', document.file, document.name);
  });
  const created = await apiRequest('/requests', { method: 'POST', form: body });
  await refresh();
  return getState().requests.find((request) => request.id === created.id) ?? created;
}

export async function addDocuments(_studentId, requestId, documents) {
  const body = documentsForm(documents);
  await apiRequest(`/requests/${requestId}/documents`, { method: 'POST', form: body });
  await refresh();
}

export async function resubmitTask(_studentId, requestId, departmentId, note) {
  await apiRequest(`/requests/${requestId}/resubmit`, {
    method: 'POST',
    body: { departmentId, note },
  });
  await refresh();
}

export async function payClearanceFee(_studentId, requestId, method, details) {
  const payment = await apiRequest(`/requests/${requestId}/payment`, {
    method: 'POST',
    body: { method, details },
  });
  await refresh();
  return payment;
}

export async function decideTask(_officerId, requestId, decision, comment) {
  await apiRequest(`/requests/${requestId}/decisions`, {
    method: 'POST',
    body: { decision, comment },
  });
  await refresh();
}

// ---------- Notifications ----------

export function markNotificationRead(_userId, id) {
  setState({
    notifications: getState().notifications.map((item) =>
      item.id === id ? { ...item, read: true } : item,
    ),
  });
  return apiRequest(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
}

export function markAllNotificationsRead(_userId) {
  setState({
    notifications: getState().notifications.map((item) => ({ ...item, read: true })),
  });
  return apiRequest('/notifications/read-all', { method: 'POST' }).catch(() => {});
}

// ---------- Certificate verification (public) ----------

export async function verifyCertificate(code) {
  try {
    return await apiRequest(`/verify/${encodeURIComponent(code.trim())}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// ---------- Administration ----------

export async function adminCreateUser(_adminId, data) {
  const user = await apiRequest('/users', {
    method: 'POST',
    body: {
      role: data.role,
      name: data.name,
      email: data.email,
      departmentId: data.role === 'officer' ? data.departmentId : null,
      password: data.password,
    },
  });
  await refresh();
  return user;
}

export async function adminUpdateUser(_adminId, userId, patch) {
  const user = await apiRequest(`/users/${userId}`, { method: 'PATCH', body: patch });
  await refresh();
  return user;
}

export async function adminSaveDepartment(_adminId, data) {
  const payload = {
    code: data.code,
    name: data.name,
    description: data.description ?? '',
    requiresPayment: !!data.requiresPayment,
    fee: data.requiresPayment ? Number(data.fee) || 0 : 0,
    ...(data.active === undefined ? {} : { active: data.active }),
  };
  const department = data.id
    ? await apiRequest(`/departments/${data.id}`, { method: 'PATCH', body: payload })
    : await apiRequest('/departments', { method: 'POST', body: payload });
  await refresh();
  return department;
}

// ---------- Demo reset ----------

export async function resetDemoData() {
  await apiRequest('/dev/reset', { method: 'POST' });
  resetState();
  if (getToken()) {
    try { await refresh(); } catch { setToken(null); resetState(); }
  }
}
