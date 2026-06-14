import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { immich, ImmichError } from '../immich.js';
import { decrypt } from '../crypto.js';
import { generateCode } from '../services/inviteCodes.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();
router.use(requireAdmin);

/* ------------------------------ invite codes ------------------------------ */

router.get('/invite-codes', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM invite_codes ORDER BY created_at DESC')
    .all();
  res.json(rows);
});

const createCodeSchema = z.object({
  label: z.string().trim().max(120).optional().or(z.literal('')),
  maxUses: z.coerce.number().int().min(1).max(100000).default(1),
  expiresAt: z.string().datetime().optional().nullable().or(z.literal('')),
});

router.post('/invite-codes', (req, res) => {
  const parsed = createCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { label, maxUses, expiresAt } = parsed.data;

  // Generate a unique code (retry on the unlikely collision).
  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const clash = db.prepare('SELECT 1 FROM invite_codes WHERE code = ?').get(code);
    if (!clash) break;
    code = null;
  }
  if (!code) return res.status(500).json({ message: 'Could not generate a unique code' });

  const info = db
    .prepare(
      `INSERT INTO invite_codes (code, label, max_uses, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(code, label || null, maxUses, expiresAt || null, req.admin.email);

  const row = db.prepare('SELECT * FROM invite_codes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Revoke (deactivate) a code without deleting its history.
router.post('/invite-codes/:id/revoke', (req, res) => {
  const info = db
    .prepare('UPDATE invite_codes SET active = 0 WHERE id = ?')
    .run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ message: 'Code not found' });
  res.json({ ok: true });
});

router.delete('/invite-codes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM invite_codes WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ message: 'Code not found' });
  res.json({ ok: true });
});

/* ----------------------------- registrations ------------------------------ */

router.get('/registrations', (req, res) => {
  const status = req.query.status;
  const valid = ['pending', 'approved', 'rejected'];
  let rows;
  if (status && valid.includes(status)) {
    rows = db
      .prepare(
        `SELECT id, email, name, status, submitted_code, invite_code_id,
                created_at, reviewed_by, reviewed_at, note
         FROM registrations WHERE status = ? ORDER BY created_at DESC`
      )
      .all(status);
  } else {
    rows = db
      .prepare(
        `SELECT id, email, name, status, submitted_code, invite_code_id,
                created_at, reviewed_by, reviewed_at, note
         FROM registrations ORDER BY created_at DESC`
      )
      .all();
  }
  res.json(rows);
});

// Approve a pending registration: create the user in Immich, then clear the
// stored password.
router.post('/registrations/:id/approve', async (req, res, next) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ message: 'Registration not found' });
  if (row.status !== 'pending') {
    return res.status(409).json({ message: `Registration is already ${row.status}` });
  }
  if (!row.password_enc) {
    return res.status(409).json({ message: 'Stored password is no longer available' });
  }

  try {
    if (await immich.emailExists(row.email)) {
      db.prepare(
        `UPDATE registrations SET status = 'rejected', password_enc = NULL,
         reviewed_by = ?, reviewed_at = datetime('now'),
         note = 'Email already exists in Immich' WHERE id = ?`
      ).run(req.admin.email, id);
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const password = decrypt(row.password_enc);
    await immich.createUser({
      email: row.email,
      password,
      name: row.name,
      quotaSizeInBytes: config.defaultQuotaBytes,
    });

    db.prepare(
      `UPDATE registrations SET status = 'approved', password_enc = NULL,
       reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(req.admin.email, id);

    res.json({ ok: true, status: 'approved' });
  } catch (err) {
    if (err instanceof ImmichError) {
      return res.status(err.status === 502 ? 502 : 400).json({ message: err.message });
    }
    next(err);
  }
});

router.post('/registrations/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ message: 'Registration not found' });
  if (row.status !== 'pending') {
    return res.status(409).json({ message: `Registration is already ${row.status}` });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null;
  db.prepare(
    `UPDATE registrations SET status = 'rejected', password_enc = NULL,
     reviewed_by = ?, reviewed_at = datetime('now'), note = ? WHERE id = ?`
  ).run(req.admin.email, note, id);
  res.json({ ok: true, status: 'rejected' });
});

export default router;
