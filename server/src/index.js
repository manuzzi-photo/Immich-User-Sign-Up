import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import './db.js';
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
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Immich Sign-Up webapp listening on port ${config.port}`);
  console.log(`Immich API: ${config.immichApiUrl}`);
  if (!config.immichApiKey) {
    console.warn('WARNING: IMMICH_API_KEY is not set — automatic user creation will fail.');
  }
});
