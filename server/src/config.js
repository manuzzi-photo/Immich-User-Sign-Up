import 'dotenv/config';

function required(name, value) {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.example for the full list of configuration values.`
    );
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT || 2284),

  // Base URL of the Immich server reachable from this container.
  // On the shared Docker network this is typically http://immich-server:2283
  immichApiUrl: (process.env.IMMICH_API_URL || 'http://immich-server:2283').replace(/\/+$/, ''),

  // Admin API key generated inside Immich (Account Settings -> API Keys).
  // Needed to create users automatically and to look up existing accounts.
  immichApiKey: isProd
    ? required('IMMICH_API_KEY', process.env.IMMICH_API_KEY)
    : process.env.IMMICH_API_KEY || '',

  // Default disk quota assigned to every new user (5 GiB by default).
  defaultQuotaBytes: Number(process.env.DEFAULT_QUOTA_BYTES || 5 * 1024 * 1024 * 1024),

  // Public URL of the Immich web app, shown to users after a successful
  // sign-up so they know where to log in (optional).
  immichPublicUrl: (process.env.IMMICH_PUBLIC_URL || '').replace(/\/+$/, ''),

  // Secret used to sign admin session cookies AND to derive the encryption
  // key that protects pending registration passwords at rest.
  sessionSecret: isProd
    ? required('SESSION_SECRET', process.env.SESSION_SECRET)
    : process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',

  // SQLite database file location (mount a volume here in Docker).
  databasePath: process.env.DATABASE_PATH || './data/app.db',

  // Admin session lifetime.
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS || 12 * 60 * 60),

  // Set to '1' when served over HTTPS so the session cookie gets the Secure flag.
  cookieSecure: process.env.COOKIE_SECURE === '1',

  // When an already-existing user submits correct credentials:
  //  - ssoEnabled = true  -> set Immich's session cookies so the browser lands
  //                          already authenticated (requires a shared parent
  //                          domain, see immichCookieDomain).
  //  - ssoEnabled = false -> only validate the credentials and redirect to
  //                          immichPublicUrl.
  ssoEnabled: process.env.SSO_ENABLED === 'true' || process.env.SSO_ENABLED === '1',

  // Parent domain (eTLD+1) shared by the webapp and Immich, used as the cookie
  // Domain for SSO. Required when ssoEnabled is true. Example: ".example.com".
  immichCookieDomain: (process.env.IMMICH_COOKIE_DOMAIN || '').trim(),

  // Immich version this build is verified against. User creation and especially
  // SSO rely on Immich internals (cookie names, API shapes), so the app checks
  // the connected server at startup and warns on a mismatch.
  supportedImmichVersion: (process.env.IMMICH_REQUIRED_VERSION || '2.7.5').trim(),

  isProd,
};

// SSO needs a cookie domain shared with Immich; without it the session cookie
// would be host-only on the sign-up subdomain and never reach Immich. Degrade
// gracefully to redirect-only mode instead of failing silently.
if (config.ssoEnabled && !config.immichCookieDomain) {
  console.warn(
    'WARNING: SSO_ENABLED is set but IMMICH_COOKIE_DOMAIN is empty — ' +
      'falling back to redirect-only mode. Set IMMICH_COOKIE_DOMAIN (e.g. ".example.com") to enable SSO.'
  );
  config.ssoEnabled = false;
}
