import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function AdminLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login({ email, password });
      navigate('/admin');
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <h1>{t('adminLogin.title')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="subtitle">{t('adminLogin.subtitle')}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <label>
            {t('adminLogin.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('adminLogin.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? t('adminLogin.submitting') : t('adminLogin.submit')}
          </button>
        </form>

        <div className="footer-link">
          <Link to="/">{t('adminLogin.back')}</Link>
        </div>
      </div>
    </div>
  );
}
