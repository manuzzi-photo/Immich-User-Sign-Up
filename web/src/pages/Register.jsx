import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

function formatBytes(bytes) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

// Give the user a moment to read the message before redirecting.
const REDIRECT_DELAY_MS = 2500;

export default function Register() {
  const { t } = useTranslation();
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

  function redirectTo(url) {
    if (!url) return;
    setTimeout(() => {
      window.location.href = url;
    }, REDIRECT_DELAY_MS);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (form.password.length < 8) {
      return setStatus({ type: 'error', message: t('register.passwordTooShort') });
    }
    if (form.password !== form.confirm) {
      return setStatus({ type: 'error', message: t('register.passwordMismatch') });
    }

    setSubmitting(true);
    try {
      const res = await api.register({
        email: form.email,
        name: form.name,
        password: form.password,
        inviteCode: form.inviteCode,
      });

      switch (res.code) {
        case 'REGISTERED_APPROVED':
          setStatus({ type: 'success', message: t('status.REGISTERED_APPROVED') });
          setForm({ email: '', name: '', password: '', confirm: '', inviteCode: '' });
          break;
        case 'REGISTRATION_PENDING':
          setStatus({ type: 'pending', message: t('status.REGISTRATION_PENDING') });
          setForm({ email: '', name: '', password: '', confirm: '', inviteCode: '' });
          break;
        case 'EXISTING_LOGIN_OK':
          setStatus({
            type: 'success',
            message: t(res.sso ? 'status.EXISTING_LOGIN_OK_SSO' : 'status.EXISTING_LOGIN_OK'),
          });
          redirectTo(res.redirectUrl);
          break;
        case 'EXISTING_LOGIN_FAILED':
          setStatus({ type: 'pending', message: t('status.EXISTING_LOGIN_FAILED') });
          redirectTo(res.redirectUrl);
          break;
        default:
          setStatus({ type: 'success', message: res.message || '' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(t, err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <h1>{t('register.title')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="subtitle">{t('register.subtitle')}</p>

        {status && <div className={`alert alert-${status.type}`}>{status.message}</div>}

        <form onSubmit={onSubmit}>
          <label>
            {t('register.name')}
            <input
              type="text"
              value={form.name}
              onChange={update('name')}
              placeholder={t('register.namePlaceholder')}
              required
            />
          </label>

          <label>
            {t('register.email')}
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder={t('register.emailPlaceholder')}
              required
            />
          </label>

          <label>
            {t('register.password')}
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder={t('register.passwordPlaceholder')}
              minLength={8}
              required
            />
          </label>

          <label>
            {t('register.confirm')}
            <input type="password" value={form.confirm} onChange={update('confirm')} required />
          </label>

          <label>
            {t('register.inviteCode')} <span className="optional">{t('register.optional')}</span>
            <input
              type="text"
              value={form.inviteCode}
              onChange={update('inviteCode')}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
            />
            <small className="hint">{t('register.inviteHint')}</small>
          </label>

          {cfg?.defaultQuotaBytes ? (
            <div className="quota-note">
              {t('register.quota', { quota: formatBytes(cfg.defaultQuotaBytes) })}
            </div>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? t('register.submitting') : t('register.submit')}
          </button>
        </form>

        {status?.type === 'success' && cfg?.immichPublicUrl ? (
          <a className="signin-link" href={cfg.immichPublicUrl}>
            {t('register.goToImmich')}
          </a>
        ) : null}

        <div className="footer-link">
          <Link to="/admin/login">{t('register.adminArea')}</Link>
        </div>
      </div>
    </div>
  );
}
