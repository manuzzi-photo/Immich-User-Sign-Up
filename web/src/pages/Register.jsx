import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function formatBytes(bytes) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export default function Register() {
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    confirm: '',
    inviteCode: '',
  });
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null); // { type, message }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getPublicConfig().then(setCfg).catch(() => {});
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (form.password.length < 8) {
      return setStatus({ type: 'error', message: 'Password must be at least 8 characters long.' });
    }
    if (form.password !== form.confirm) {
      return setStatus({ type: 'error', message: 'Passwords do not match.' });
    }

    setSubmitting(true);
    try {
      const res = await api.register({
        email: form.email,
        name: form.name,
        password: form.password,
        inviteCode: form.inviteCode,
      });
      setStatus({ type: res.status === 'approved' ? 'success' : 'pending', message: res.message });
      setForm({ email: '', name: '', password: '', confirm: '', inviteCode: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Create your account</h1>
        <p className="subtitle">Request access to the Immich photo library.</p>

        {status && <div className={`alert alert-${status.type}`}>{status.message}</div>}

        <form onSubmit={onSubmit}>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={update('name')}
              placeholder="Jane Doe"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="jane@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          <label>
            Confirm password
            <input
              type="password"
              value={form.confirm}
              onChange={update('confirm')}
              required
            />
          </label>

          <label>
            Invite code <span className="optional">(optional)</span>
            <input
              type="text"
              value={form.inviteCode}
              onChange={update('inviteCode')}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
            />
            <small className="hint">
              With a valid invite code your account is activated immediately. Without one,
              your request will be reviewed by an administrator.
            </small>
          </label>

          {cfg?.defaultQuotaBytes ? (
            <div className="quota-note">Storage quota: {formatBytes(cfg.defaultQuotaBytes)}</div>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Register'}
          </button>
        </form>

        {status?.type === 'success' && cfg?.immichPublicUrl ? (
          <a className="signin-link" href={cfg.immichPublicUrl}>
            Go to Immich to sign in →
          </a>
        ) : null}

        <div className="footer-link">
          <Link to="/admin/login">Administrator area</Link>
        </div>
      </div>
    </div>
  );
}
