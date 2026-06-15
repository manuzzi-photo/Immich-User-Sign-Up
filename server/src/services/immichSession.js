import { config } from '../config.js';

// Immich issues a 400-day session cookie; mirror that here so the SSO cookie we
// set behaves like a normal Immich login.
const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

// Cookie names and the `auth_type` value are taken from Immich's source
// (ImmichCookie enum + auth.controller login). Pin the Immich version when
// relying on SSO, as these are an internal contract.
const ACCESS_TOKEN = 'immich_access_token';
const AUTH_TYPE = 'immich_auth_type';
const IS_AUTHENTICATED = 'immich_is_authenticated';

// Set the cookies Immich's auth guard recognises so the browser, once
// redirected to Immich on the shared parent domain, is already authenticated.
export function setImmichSessionCookies(req, res, accessToken) {
  const base = {
    path: '/',
    sameSite: 'lax',
    secure: req.secure || config.cookieSecure,
    domain: config.immichCookieDomain || undefined,
    maxAge: MAX_AGE_MS,
  };
  res.cookie(ACCESS_TOKEN, accessToken, { ...base, httpOnly: true });
  res.cookie(AUTH_TYPE, 'password', { ...base, httpOnly: true });
  // Read client-side by the Immich web app, so it must not be httpOnly.
  res.cookie(IS_AUTHENTICATED, 'true', { ...base, httpOnly: false });
}
