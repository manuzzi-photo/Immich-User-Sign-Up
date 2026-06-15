async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code || null;
    throw err;
  }
  return data;
}

// Translate an API error into a localized message, falling back to the
// server-provided message and finally to a generic string.
export function errorMessage(t, err) {
  if (err?.code) return t(`errors.${err.code}`, { defaultValue: err.message || t('errors.generic') });
  return err?.message || t('errors.generic');
}

export const api = {
  getPublicConfig: () => request('/api/public/config'),
  register: (body) => request('/api/register', { method: 'POST', body }),

  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  listInviteCodes: () => request('/api/admin/invite-codes'),
  createInviteCode: (body) => request('/api/admin/invite-codes', { method: 'POST', body }),
  revokeInviteCode: (id) => request(`/api/admin/invite-codes/${id}/revoke`, { method: 'POST' }),
  deleteInviteCode: (id) => request(`/api/admin/invite-codes/${id}`, { method: 'DELETE' }),

  listRegistrations: (status) =>
    request(`/api/admin/registrations${status ? `?status=${status}` : ''}`),
  approveRegistration: (id) =>
    request(`/api/admin/registrations/${id}/approve`, { method: 'POST' }),
  rejectRegistration: (id, note) =>
    request(`/api/admin/registrations/${id}/reject`, { method: 'POST', body: { note } }),
};
