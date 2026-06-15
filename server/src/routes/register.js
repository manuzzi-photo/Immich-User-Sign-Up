import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { immich, ImmichError } from '../immich.js';
import { encrypt } from '../crypto.js';
import { findValidCode, consumeCode } from '../services/inviteCodes.js';
import { setImmichSessionCookies } from '../services/immichSession.js';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later.' },
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(256),
  inviteCode: z.string().trim().max(64).optional().or(z.literal('')),
});

router.post('/', registerLimiter, async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid input' });
  }
  const { email, name, password, inviteCode } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const redirectUrl = config.immichPublicUrl || null;

  try {
    // The email already belongs to an Immich account: try to log the user in
    // instead of registering a duplicate.
    if (await immich.emailExists(normalizedEmail)) {
      return await handleExistingUser(req, res, normalizedEmail, password, redirectUrl);
    }

    const pending = db
      .prepare("SELECT id FROM registrations WHERE email = ? AND status = 'pending'")
      .get(normalizedEmail);
    if (pending) {
      return res.status(409).json({
        code: 'REGISTRATION_PENDING_DUPLICATE',
        message: 'A registration request with this email is already pending review',
      });
    }

    const code = inviteCode ? findValidCode(inviteCode) : null;

    if (code) {
      // Valid invite code -> provision immediately into Immich.
      await immich.createUser({
        email: normalizedEmail,
        password,
        name,
        quotaSizeInBytes: config.defaultQuotaBytes,
      });
      consumeCode(code.id);
      db.prepare(
        `INSERT INTO registrations (email, name, status, invite_code_id, submitted_code, reviewed_at)
         VALUES (?, ?, 'approved', ?, ?, datetime('now'))`
      ).run(normalizedEmail, name, code.id, inviteCode.trim().toUpperCase());

      return res.status(201).json({
        code: 'REGISTERED_APPROVED',
        message: 'Your account has been created. You can now sign in to Immich.',
        redirectUrl,
      });
    }

    // No code, or invalid/expired code -> queue for manual admin approval.
    db.prepare(
      `INSERT INTO registrations (email, name, password_enc, status, submitted_code)
       VALUES (?, ?, ?, 'pending', ?)`
    ).run(
      normalizedEmail,
      name,
      encrypt(password),
      inviteCode ? inviteCode.trim().toUpperCase() : null
    );

    return res.status(202).json({
      code: 'REGISTRATION_PENDING',
      message: 'Your registration was received and is pending administrator approval.',
    });
  } catch (err) {
    if (err instanceof ImmichError) {
      return res
        .status(err.status === 502 ? 502 : 400)
        .json({ code: err.status === 502 ? 'IMMICH_UNREACHABLE' : 'IMMICH_ERROR', message: err.message });
    }
    next(err);
  }
});

// Existing Immich account: validate the password and either set the SSO session
// cookies (when enabled) or just report success so the frontend can redirect.
async function handleExistingUser(req, res, email, password, redirectUrl) {
  let login;
  try {
    login = await immich.login(email, password);
  } catch (err) {
    if (err instanceof ImmichError && err.status === 401) {
      // Account exists but the password is wrong: not an error, an expected
      // outcome -> tell the user the profile exists and send them to Immich.
      return res.status(200).json({ code: 'EXISTING_LOGIN_FAILED', redirectUrl });
    }
    throw err;
  }

  const sso = config.ssoEnabled && Boolean(login?.accessToken);
  if (sso) {
    setImmichSessionCookies(req, res, login.accessToken);
  }
  return res.status(200).json({ code: 'EXISTING_LOGIN_OK', sso, redirectUrl });
}

export default router;
