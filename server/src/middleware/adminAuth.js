import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { immich } from '../immich.js';

export const SESSION_COOKIE = 'immich_signup_session';

export function issueSession(res, { immichToken, email, name }) {
  const token = jwt.sign({ immichToken, email, name }, config.sessionSecret, {
    expiresIn: config.sessionTtlSeconds,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionTtlSeconds * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE);
}

// Verifies the signed session cookie AND re-checks with Immich on every request
// that the underlying account is still a valid admin (handles revocation).
export async function requireAdmin(req, res, next) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return res.status(401).json({ message: 'Not authenticated' });

  let payload;
  try {
    payload = jwt.verify(raw, config.sessionSecret);
  } catch {
    clearSession(res);
    return res.status(401).json({ message: 'Session expired' });
  }

  try {
    const me = await immich.getMe(payload.immichToken);
    if (!me?.isAdmin) {
      clearSession(res);
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    req.admin = { email: me.email, name: me.name, id: me.id };
    next();
  } catch {
    clearSession(res);
    return res.status(401).json({ message: 'Immich session is no longer valid' });
  }
}
