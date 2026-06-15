import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = ['en', 'it'];

export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();
  const current = LANGS.includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';

  return (
    <select
      className={`lang-switcher ${className}`}
      aria-label={t('lang.label')}
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      {LANGS.map((lng) => (
        <option key={lng} value={lng}>
          {t(`lang.${lng}`)}
        </option>
      ))}
    </select>
  );
}
