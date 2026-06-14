import { config } from './config.js';

class ImmichError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ImmichError';
    this.status = status;
  }
}

async function request(pathname, { method = 'GET', body, token, useApiKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (useApiKey) headers['x-api-key'] = config.immichApiKey;

  let res;
  try {
    res = await fetch(`${config.immichApiUrl}${pathname}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ImmichError(`Cannot reach Immich at ${config.immichApiUrl}: ${err.message}`, 502);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Immich returned ${res.status}`;
    throw new ImmichError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export const immich = {
  // Authenticate an admin using their Immich credentials.
  async login(email, password) {
    return request('/api/auth/login', { method: 'POST', body: { email, password } });
  },

  // Confirm a session token is still valid and return the user (incl. isAdmin).
  async getMe(token) {
    return request('/api/users/me', { token });
  },

  // Create a new Immich user (requires the admin API key).
  async createUser({ email, password, name, quotaSizeInBytes }) {
    return request('/api/admin/users', {
      method: 'POST',
      useApiKey: true,
      body: {
        email,
        password,
        name,
        quotaSizeInBytes,
        shouldChangePassword: false,
        notify: false,
      },
    });
  },

  // Return true if an account with this email already exists in Immich.
  async emailExists(email) {
    const users = await request('/api/admin/users', { useApiKey: true });
    const list = Array.isArray(users) ? users : users?.users || [];
    return list.some((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  },
};

export { ImmichError };
