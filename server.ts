import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createPaymentRouter, createRazorpayWebhookHandler } from './server/paymentRoutes';
import { createAdminRouter } from './server/adminRoutes';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CRITICAL: Mount Razorpay Webhook with raw body parser BEFORE express.json()
  // so HMAC-SHA256 verification executes strictly against the exact raw request bytes.
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    createRazorpayWebhookHandler()
  );

  // Standard JSON parser for all other API routes
  app.use('/api', express.json({ limit: '1mb' }));

  // Phase 7 Razorpay Payment Gateway API routes
  app.use('/api/payments', createPaymentRouter());

  // Phase 8 Super Admin Dashboard & Store Management API routes
  app.use('/api/admin', createAdminRouter());

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, service: '3d-jummo-fashion-world' });
  });

  // Unmatched API routes must always return JSON 404 (never HTML SPA fallback)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Fashion World Server] Listening on http://${HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Fashion World Server] Failed to start:', err);
  process.exit(1);
});
