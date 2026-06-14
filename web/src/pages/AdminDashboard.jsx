import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    api
      .me()
      .then(setAdmin)
      .catch(() => navigate('/admin/login'));
  }, [navigate]);

  async function logout() {
    await api.logout().catch(() => {});
    navigate('/admin/login');
  }

  if (!admin) return <div className="page"><div className="loading">Loading…</div></div>;

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <strong>Immich Sign-Up</strong> — Admin
        </div>
        <div className="topbar-right">
          <span className="admin-email">{admin.email}</span>
          <button className="ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          Pending requests
        </button>
        <button className={tab === 'codes' ? 'active' : ''} onClick={() => setTab('codes')}>
          Invite codes
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
      </nav>

      <main className="dashboard-body">
        {tab === 'pending' && <PendingTab />}
        {tab === 'codes' && <CodesTab />}
        {tab === 'history' && <HistoryTab />}
      </main>
    </div>
  );
}

/* ------------------------------ Pending tab ------------------------------- */

function PendingTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api
      .listRegistrations('pending')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function act(id, action) {
    setBusy(id);
    setError(null);
    try {
      if (action === 'approve') await api.approveRegistration(id);
      else await api.rejectRegistration(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <div className="loading">Loading…</div>;
  if (rows.length === 0) return <div className="empty">No pending registrations. 🎉</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Submitted code</th>
          <th>Requested</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{r.email}</td>
            <td>{r.submitted_code ? <code className="bad-code">{r.submitted_code}</code> : '—'}</td>
            <td>{fmtDate(r.created_at)}</td>
            <td className="actions">
              <button
                className="approve"
                disabled={busy === r.id}
                onClick={() => act(r.id, 'approve')}
              >
                Approve
              </button>
              <button
                className="reject"
                disabled={busy === r.id}
                onClick={() => act(r.id, 'reject')}
              >
                Reject
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------- Codes tab -------------------------------- */

function CodesTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .listInviteCodes()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function create(e) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.createInviteCode({
        label,
        maxUses: Number(maxUses),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '',
      });
      setLabel('');
      setMaxUses(1);
      setExpiresAt('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    await api.revokeInviteCode(id).catch((e) => setError(e.message));
    load();
  }
  async function remove(id) {
    if (!window.confirm('Delete this invite code permanently?')) return;
    await api.deleteInviteCode(id).catch((e) => setError(e.message));
    load();
  }

  function copy(code) {
    navigator.clipboard?.writeText(code);
  }

  return (
    <div>
      <form className="inline-form" onSubmit={create}>
        <div className="field">
          <label>Label</label>
          <input
            type="text"
            value={label}
            placeholder="e.g. Family"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Max uses</label>
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Expires at (optional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Generate code'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {!rows ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty">No invite codes yet.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Label</th>
              <th>Uses</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              const exhausted = c.used_count >= c.max_uses;
              const state = !c.active
                ? 'revoked'
                : expired
                  ? 'expired'
                  : exhausted
                    ? 'exhausted'
                    : 'active';
              return (
                <tr key={c.id}>
                  <td>
                    <code className="invite-code" title="Click to copy" onClick={() => copy(c.code)}>
                      {c.code}
                    </code>
                  </td>
                  <td>{c.label || '—'}</td>
                  <td>
                    {c.used_count} / {c.max_uses}
                  </td>
                  <td>{c.expires_at ? fmtDate(c.expires_at) : 'Never'}</td>
                  <td>
                    <span className={`badge badge-${state}`}>{state}</span>
                  </td>
                  <td className="actions">
                    {c.active && (
                      <button className="ghost" onClick={() => revoke(c.id)}>
                        Revoke
                      </button>
                    )}
                    <button className="reject" onClick={() => remove(c.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------ History tab ------------------------------- */

function HistoryTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listRegistrations()
      .then((all) => setRows(all.filter((r) => r.status !== 'pending')))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <div className="loading">Loading…</div>;
  if (rows.length === 0) return <div className="empty">No history yet.</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Reviewed by</th>
          <th>Reviewed at</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{r.email}</td>
            <td>
              <span className={`badge badge-${r.status === 'approved' ? 'active' : 'revoked'}`}>
                {r.status}
              </span>
            </td>
            <td>{r.reviewed_by || (r.invite_code_id ? 'auto (invite code)' : '—')}</td>
            <td>{fmtDate(r.reviewed_at)}</td>
            <td>{r.note || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
