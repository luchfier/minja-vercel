// src/app.ts
// Fastify instance + plugin registration
// Sesuai ARCHITECTURE.md §6.1

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { globalErrorHandler } from './middleware/error.middleware.js';
import { systemRoutes } from './routes/system.routes.js';
import { adminAuthRoutes } from './routes/admin-auth.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { packageRoutes } from './routes/package.routes.js';
import { templateRoutes } from './routes/template.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { sessionRoutes } from './routes/session.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { printRoutes } from './routes/print.routes.js';
import { deliveryRoutes } from './routes/delivery.routes.js';
import { voucherRoutes } from './routes/voucher.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { assetRoutes } from './routes/asset.routes.js';
import { cleanupService } from './services/cleanup.service.js';

// Extend Fastify types to include prisma
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function buildApp() {
  // 1. Load & validate environment
  const env = loadEnv();

  // 2. Create Fastify instance with Pino logger and 50MB bodyLimit
  // Allows high-res 300DPI frame PNG uploads and raw camera photos
  const app = Fastify({
    bodyLimit: 50 * 1024 * 1024, // 50MB
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // 3. Register Prisma as a plugin
  const prisma = new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

  // Decorate Fastify with prisma instance
  app.decorate('prisma', prisma);

  // Lifecycle hooks: connect/disconnect Prisma & background workers
  app.addHook('onReady', async () => {
    try {
      await prisma.$connect();
      app.log.info('✅ Database connected');
    } catch (err) {
      app.log.warn({ err }, '⚠️ Database connection failed on startup, running in degraded mode');
    }

    // Mulai scheduler pembersihan file cetak otomatis (setiap 1 jam)
    cleanupService.startScheduledCleanup(1);
  });

  app.addHook('onClose', async () => {
    cleanupService.stopScheduledCleanup();
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    app.log.info('Database disconnected');
  });

  // 4. Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (Electron, curl, local tools)
      if (!origin) return cb(null, true);
      // Allow localhost, 127.0.0.1 on any port, and Electron app:// origins
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin.startsWith('app://')
      ) {
        return cb(null, true);
      }
      return cb(null, true); // Allow kiosk dev/production origins
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Booth-Key'],
    credentials: false,
  });

  // 5. Global error handler
  app.setErrorHandler(globalErrorHandler);

  // 6. Serve local storage files (Photos, prints, assets, and galleries)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const storageDir = path.resolve(__dirname, '../storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: storageDir,
    prefix: '/storage/',
    decorateReply: true,
    setHeaders: (res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.header('Cache-Control', 'public, max-age=86400');
    },
  });

  // 7. Register routes
  await app.register(systemRoutes);
  await app.register(adminAuthRoutes);
  await app.register(settingsRoutes);
  await app.register(packageRoutes);
  await app.register(templateRoutes);
  await app.register(auditRoutes);
  await app.register(sessionRoutes);
  await app.register(paymentRoutes);
  await app.register(printRoutes);
  await app.register(deliveryRoutes);
  await app.register(voucherRoutes);
  await app.register(reportRoutes);
  await app.register(assetRoutes);

  return app;
}
