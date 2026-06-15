import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function AdminDashboard() {
  const { t } = useTranslation();
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

  if (!admin)
    return (
      <div className="page">
        <div className="loading">{t('admin.loading')}</div>
      </div>
    );

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <strong>{t('admin.brand')}</strong> — Admin
        </div>
        <div className="topbar-right">
          <LanguageSwitcher />
          <span className="admin-email">{admin.email}</span>
          <button className="ghost" onClick={logout}>
            {t('admin.logout')}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          {t('admin.tabs.pending')}
        </button>
        <button className={tab === 'codes' ? 'active' : ''} onClick={() => setTab('codes')}>
          {t('admin.tabs.codes')}
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          {t('admin.tabs.history')}
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
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api
      .listRegistrations('pending')
      .then(setRows)
      .catch((e) => setError(errorMessage(t, e)));
  }, [t]);

  useEffect(load, [load]);

  async function act(id, action) {
    setBusy(id);
    setError(null);
    try {
      if (action === 'approve') await api.approveRegistration(id);
      else await api.rejectRegistration(id);
      load();
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <div className="loading">{t('admin.loading')}</div>;
  if (rows.length === 0) return <div className="empty">{t('admin.pending.empty')}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t('admin.pending.name')}</th>
          <th>{t('admin.pending.email')}</th>
          <th>{t('admin.pending.submittedCode')}</th>
          <th>{t('admin.pending.requested')}</th>
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
              <button className="approve" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>
                {t('admin.pending.approve')}
              </button>
              <button className="reject" disabled={busy === r.id} onClick={() => act(r.id, 'reject')}>
                {t('admin.pending.reject')}
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
  const { t } = useTranslation();
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
      .catch((e) => setError(errorMessage(t, e)));
  }, [t]);

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
      setError(errorMessage(t, e));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    await api.revokeInviteCode(id).catch((e) => setError(errorMessage(t, e)));
    load();
  }
  async function remove(id) {
    if (!window.confirm(t('admin.codes.confirmDelete'))) return;
    await api.deleteInviteCode(id).catch((e) => setError(errorMessage(t, e)));
    load();
  }

  function copy(code) {
    navigator.clipboard?.writeText(code);
  }

  return (
    <div>
      <form className="inline-form" onSubmit={create}>
        <div className="field">
          <label>{t('admin.codes.label')}</label>
          <input
            type="text"
            value={label}
            placeholder={t('admin.codes.labelPlaceholder')}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('admin.codes.maxUses')}</label>
          <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('admin.codes.expiresAt')}</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <button type="submit" disabled={creating}>
          {creating ? t('admin.codes.generating') : t('admin.codes.generate')}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {!rows ? (
        <div className="loading">{t('admin.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty">{t('admin.codes.empty')}</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('admin.codes.code')}</th>
              <th>{t('admin.codes.label')}</th>
              <th>{t('admin.codes.uses')}</th>
              <th>{t('admin.codes.expires')}</th>
              <th>{t('admin.codes.status')}</th>
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
                    <code
                      className="invite-code"
                      title={t('admin.codes.copyTitle')}
                      onClick={() => copy(c.code)}
                    >
                      {c.code}
                    </code>
                  </td>
                  <td>{c.label || '—'}</td>
                  <td>
                    {c.used_count} / {c.max_uses}
                  </td>
                  <td>{c.expires_at ? fmtDate(c.expires_at) : t('admin.codes.never')}</td>
                  <td>
                    <span className={`badge badge-${state}`}>{t(`admin.codes.state.${state}`)}</span>
                  </td>
                  <td className="actions">
                    {c.active && (
                      <button className="ghost" onClick={() => revoke(c.id)}>
                        {t('admin.codes.revoke')}
                      </button>
                    )}
                    <button className="reject" onClick={() => remove(c.id)}>
                      {t('admin.codes.delete')}
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
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listRegistrations()
      .then((all) => setRows(all.filter((r) => r.status !== 'pending')))
      .catch((e) => setError(errorMessage(t, e)));
  }, [t]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <div className="loading">{t('admin.loading')}</div>;
  if (rows.length === 0) return <div className="empty">{t('admin.history.empty')}</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t('admin.history.name')}</th>
          <th>{t('admin.history.email')}</th>
          <th>{t('admin.history.status')}</th>
          <th>{t('admin.history.reviewedBy')}</th>
          <th>{t('admin.history.reviewedAt')}</th>
          <th>{t('admin.history.note')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{r.email}</td>
            <td>
              <span className={`badge badge-${r.status === 'approved' ? 'active' : 'revoked'}`}>
                {t(`admin.history.statuses.${r.status}`)}
              </span>
            </td>
            <td>{r.reviewed_by || (r.invite_code_id ? t('admin.history.auto') : '—')}</td>
            <td>{fmtDate(r.reviewed_at)}</td>
            <td>{r.note || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
