import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { immich, ImmichError } from '../immich.js';
import { encrypt } from '../crypto.js';
import { findValidCode, consumeCode } from '../services/inviteCodes.js';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts, please try again later.' },
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
    const first = parsed.error.issues[0];
    return res.status(400).json({ message: first?.message || 'Invalid input' });
  }
  const { email, name, password, inviteCode } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    // Reject if the email already exists in Immich or is already queued.
    if (await immich.emailExists(normalizedEmail)) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    const existing = db
      .prepare("SELECT id FROM registrations WHERE email = ? AND status = 'pending'")
      .get(normalizedEmail);
    if (existing) {
      return res
        .status(409)
        .json({ message: 'A registration request with this email is already pending review' });
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
        status: 'approved',
        message: 'Your account has been created. You can now sign in to Immich.',
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
      status: 'pending',
      message:
        'Your registration was received and is pending administrator approval. ' +
        'You will be able to sign in once it is approved.',
    });
  } catch (err) {
    if (err instanceof ImmichError) {
      return res.status(err.status === 502 ? 502 : 400).json({ message: err.message });
    }
    next(err);
  }
});

export default router;
