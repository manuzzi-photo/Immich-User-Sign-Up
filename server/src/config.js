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

  isProd,
};
