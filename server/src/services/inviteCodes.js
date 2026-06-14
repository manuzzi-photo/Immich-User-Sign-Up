import crypto from 'node:crypto';
import { db } from '../db.js';

// Human-friendly code, e.g. "K3F9-XQ2M-7TLP" (no ambiguous chars).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let part = '';
    for (let i = 0; i < 4; i++) {
      part += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    groups.push(part);
  }
  return groups.join('-');
}

export function findValidCode(rawCode) {
  if (!rawCode) return null;
  const code = rawCode.trim().toUpperCase();
  const row = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code);
  if (!row) return null;
  if (!row.active) return null;
  if (row.used_count >= row.max_uses) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export function consumeCode(id) {
  db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?').run(id);
}
