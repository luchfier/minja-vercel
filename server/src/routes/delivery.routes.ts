// src/routes/delivery.routes.ts
// Route handler untuk Distribusi Digital (Galeri S3/R2 & Pengiriman Soft File Email)
// Sesuai ARCHITECTURE.md §4.2, §5.1 & THE_NEXT_STEP.md §6

import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { DeliveryService } from '../services/delivery.service.js';
import {
  sendEmailSchema,
  uploadGalleryFileSchema,
} from '../schemas/delivery.schema.js';
import { requireBoothAuth } from '../middleware/auth.middleware.js';
import { sendSuccess } from '../middleware/error.middleware.js';
import { renderMobileGalleryHtml } from '../templates/mobileGalleryPage.js';

export async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  const deliveryService = new DeliveryService(app.prisma);

  /**
   * GET /api/sessions/:sessionId/gallery
   * Mengambil tautan galeri privat berbatas waktu (48 jam) & QR code string
   */
  app.get(
    '/api/sessions/:sessionId/gallery',
    { preHandler: [requireBoothAuth] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const gallery = await deliveryService.getOrCreateGallery(sessionId);
      sendSuccess(reply, gallery);
    }
  );

  /**
   * POST /api/sessions/:sessionId/email
   * Mengirimkan tautan galeri foto langsung ke alamat email pelanggan
   */
  app.post(
    '/api/sessions/:sessionId/email',
    { preHandler: [requireBoothAuth] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const body = sendEmailSchema.parse(request.body);
      const result = await deliveryService.sendEmailNotification(
        sessionId,
        body.email
      );
      sendSuccess(reply, result);
    }
  );

  /**
   * POST /api/sessions/:sessionId/gallery/upload
   * Mengunggah file foto atau video ke galeri sesi
   */
  app.post(
    '/api/sessions/:sessionId/gallery/upload',
    { preHandler: [requireBoothAuth] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const body = uploadGalleryFileSchema.parse(request.body);
      const uploaded = await deliveryService.uploadGalleryFile(
        sessionId,
        body.fileType,
        body.dataUrl,
        body.fileName
      );
      sendSuccess(reply, uploaded, 201);
    }
  );

  /**
   * GET /api/public/gallery/:sessionId
   * Akses publik untuk smartphone pelanggan mengunduh foto (JSON format)
   */
  app.get('/api/public/gallery/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { token } = (request.query as { token?: string }) || {};

    if (!token) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Parameter token verifikasi galeri wajib disertakan.',
        },
      });
    }

    const galleryData = await deliveryService.getPublicGallery(sessionId, token);
    sendSuccess(reply, galleryData);
  });

  /**
   * GET /s/:sessionId & GET /gallery/:sessionId
   * Halaman web galeri mobile interaktif untuk smartphone pelanggan
   */
  const handleHtmlGallery = async (request: any, reply: any) => {
    const { sessionId } = request.params as { sessionId: string };
    const { token } = (request.query as { token?: string }) || {};

    if (!token) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html><head><title>Akses Ditolak</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:sans-serif; background:#070B14; color:#FFF; display:flex; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px;">
          <div>
            <h1 style="color:#F59E0B; font-size:24px; margin-bottom:8px;">Akses Galeri Ditolak</h1>
            <p style="color:#94A3B8; font-size:14px;">Token verifikasi galeri tidak ditemukan pada tautan QR.</p>
          </div>
        </body></html>
      `);
    }

    try {
      const data = await deliveryService.getGalleryHtmlData(sessionId, token);
      const html = renderMobileGalleryHtml(data);
      reply.type('text/html').send(html);
    } catch (err: any) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html><head><title>Galeri Tidak Ditemukan</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:sans-serif; background:#070B14; color:#FFF; display:flex; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px;">
          <div>
            <h1 style="color:#EF4444; font-size:24px; margin-bottom:8px;">Galeri Tidak Ditemukan</h1>
            <p style="color:#94A3B8; font-size:14px;">${err.message || 'Tautan galeri tidak valid atau masa berlaku 48 jam telah berakhir.'}</p>
          </div>
        </body></html>
      `);
    }
  };

  app.get('/s/:sessionId', handleHtmlGallery);
  app.get('/gallery/:sessionId', handleHtmlGallery);

  /**
   * GET /api/public/gallery/:sessionId/download/:fileName
   * Endpoint unduh soft file langsung dari local storage booth dengan header Content-Disposition attachment
   */
  app.get('/api/public/gallery/:sessionId/download/:fileName', async (request, reply) => {
    const { sessionId, fileName } = request.params as { sessionId: string; fileName: string };
    const safeSessionId = path.basename(sessionId);
    const safeFileName = path.basename(fileName);
    const relativePath = `galleries/${safeSessionId}/${safeFileName}`;

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}"`);
    reply.header('Access-Control-Allow-Origin', '*');

    // Gunakan reply.sendFile dari @fastify/static
    try {
      return (reply as any).sendFile(relativePath);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Berkas tidak ditemukan di penyimpanan lokal.' },
      });
    }
  });
}
