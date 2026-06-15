import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import './db.js';
import { immich } from './immich.js';
import authRoutes from './routes/auth.js';
import registerRoutes from './routes/register.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

// Public runtime configuration consumed by the frontend.
app.get('/api/public/config', (req, res) => {
  res.json({
    defaultQuotaBytes: config.defaultQuotaBytes,
    immichPublicUrl: config.immichPublicUrl,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/admin', adminRoutes);

// Serve the built React frontend (SPA fallback for client-side routing).
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Centralised error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Immich Sign-Up webapp listening on port ${config.port}`);
  console.log(`Immich API: ${config.immichApiUrl}`);
  console.log(
    `Existing-user mode: ${
      config.ssoEnabled ? `SSO (cookie domain ${config.immichCookieDomain})` : 'redirect-only'
    }`
  );
  if (!config.immichApiKey) {
    console.warn('WARNING: IMMICH_API_KEY is not set — automatic user creation will fail.');
  }
  verifyImmichVersion();
});

// This build is verified against a specific Immich version (config.supportedImmichVersion).
// User provisioning and SSO depend on Immich internals, so warn loudly on a mismatch.
async function verifyImmichVersion() {
  try {
    const v = await immich.getServerVersion();
    const running = `${v.major}.${v.minor}.${v.patch}`;
    if (running === config.supportedImmichVersion) {
      console.log(`Immich version ${running} matches the supported version.`);
    } else {
      console.warn(
        `WARNING: connected Immich is ${running} but this build is verified against ` +
          `${config.supportedImmichVersion}. User creation/SSO rely on Immich internals and may behave differently.`
      );
    }
  } catch (err) {
    console.warn(`Could not determine the Immich version: ${err.message}`);
  }
}
