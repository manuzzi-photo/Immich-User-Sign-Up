import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { immich, ImmichError } from '../immich.js';
import {
  issueSession,
  clearSession,
  requireAdmin,
  SESSION_COOKIE,
} from '../middleware/adminAuth.js';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Admin login: authenticate against Immich and require isAdmin.
router.post('/login', loginLimiter, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const { email, password } = parsed.data;
  try {
    const result = await immich.login(email, password);
    if (!result?.isAdmin) {
      return res.status(403).json({ message: 'This account is not an Immich administrator' });
    }
    issueSession(res, {
      immichToken: result.accessToken,
      email: result.userEmail || email,
      name: result.name,
    });
    return res.json({ email: result.userEmail || email, name: result.name });
  } catch (err) {
    if (err instanceof ImmichError && err.status === 401) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// Lightweight session check used by the frontend on load.
router.get('/me', async (req, res) => {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const payload = jwt.verify(raw, config.sessionSecret);
    const me = await immich.getMe(payload.immichToken);
    if (!me?.isAdmin) {
      clearSession(res);
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    return res.json({ email: me.email, name: me.name });
  } catch {
    clearSession(res);
    return res.status(401).json({ message: 'Not authenticated' });
  }
});

export default router;
export { requireAdmin };
