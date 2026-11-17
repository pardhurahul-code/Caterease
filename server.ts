import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './src/server/routes/authRoutes.ts';
import catalogRoutes from './src/server/routes/catalogRoutes.ts';
import bookingRoutes from './src/server/routes/bookingRoutes.ts';
import paymentRoutes from './src/server/routes/paymentRoutes.ts';
import opsRoutes from './src/server/routes/opsRoutes.ts';
import communityRoutes from './src/server/routes/communityRoutes.ts';
import aiRoutes from './src/server/routes/aiRoutes.ts';
import { resolveUserFromToken } from './src/server/middleware/auth.ts';
import { registerSseClient } from './src/server/services/realtimeService.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  app.use(
    cors({
      origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'] : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'CaterEase API',
      timestamp: new Date().toISOString(),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      mapsConfigured: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      paymentMode: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'RAZORPAY_LIVE' : 'DEMO_PAYMENT_MODE',
    });
  });

  // Safe Public Maps Key Config (HTTP-referrer restricted Maps JS browser key)
  app.get('/api/maps/client-config', (_req, res) => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ success: true, data: { apiKey } });
  });

  // Real-Time Server-Sent Events Stream (Kitchen & Event Live Updates)
  app.get('/api/realtime/stream', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '') ||
      (typeof req.query.token === 'string' ? req.query.token.trim() : '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Stream authentication required.' });
    }
    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired stream token.' });
    }
    registerSseClient(user, req, res);
  });

  // Modular API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api', paymentRoutes);
  app.use('/api', opsRoutes);
  app.use('/api', communityRoutes);
  app.use('/api/ai', aiRoutes);

  // Vite Dev Middleware or Production Static Bundle
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: isProd ? 'An unexpected server error occurred.' : err.message || 'Server error',
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CaterEase server listening on http://localhost:${PORT}`);
  });
}

startServer();
