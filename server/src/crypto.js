import crypto from 'node:crypto';
import { config } from './config.js';

// Pending registrations store the password the user chose so that, once an
// admin approves the request, we can provision the very same credentials into
// Immich. A one-way hash (bcrypt) cannot be used because Immich needs the
// plaintext at creation time. We therefore encrypt the password at rest with
// AES-256-GCM using a key derived from SESSION_SECRET.

const KEY = crypto.scryptSync(config.sessionSecret, 'immich-signup-pwd-enc', 32);

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
