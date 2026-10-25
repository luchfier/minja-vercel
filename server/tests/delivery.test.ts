// tests/delivery.test.ts
// Test suite untuk Distribusi Digital (Galeri S3/R2 & Pengiriman Soft File Email)
// Sesuai ARCHITECTURE.md §4.2, §5.1 & THE_NEXT_STEP.md §6

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/minjaphotobooth';
process.env['JWT_SECRET'] = 'test-secret-key-that-is-at-least-32-chars-long';
process.env['BOOTH_API_KEY'] = 'test-booth-key';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

let app: FastifyInstance;

describe('Digital Delivery & Email Distribution Endpoints', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const testSessionId = `test_delivery_session_${Date.now()}`;
  let generatedToken = '';

  it('rejects gallery creation without booth authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${testSessionId}/gallery`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/sessions/:sessionId/gallery creates and returns a 48-hour secure gallery token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${testSessionId}/gallery`,
      headers: {
        'x-booth-key': 'test-booth-key',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('galleryId');
    expect(body.data).toHaveProperty('token');
    expect(body.data).toHaveProperty('galleryUrl');
    expect(body.data).toHaveProperty('qrString');
    expect(body.data).toHaveProperty('expiresAt');
    expect(body.data.sessionId).toBe(testSessionId);

    generatedToken = body.data.token;
    expect(generatedToken.length).toBeGreaterThanOrEqual(16);
  });

  it('repeated GET /api/sessions/:sessionId/gallery returns the same gallery details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${testSessionId}/gallery`,
      headers: {
        'x-booth-key': 'test-booth-key',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.token).toBe(generatedToken);
  });

  it('POST /api/sessions/:sessionId/gallery/upload uploads a file into the session gallery', async () => {
    const mockImageBase64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAPAA8BAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/gallery/upload`,
      headers: {
        'x-booth-key': 'test-booth-key',
      },
      payload: {
        fileType: 'layout_4r',
        dataUrl: mockImageBase64,
        fileName: 'strip_final.jpg',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('url');
    expect(body.data).toHaveProperty('sizeBytes');
    expect(body.data.sizeBytes).toBeGreaterThan(0);
  });

  it('POST /api/sessions/:sessionId/email sends soft-file link to valid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/email`,
      headers: {
        'x-booth-key': 'test-booth-key',
      },
      payload: {
        email: 'pelanggan@gmail.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.sent).toBe(true);
    expect(body.data).toHaveProperty('messageId');
  });

  it('POST /api/sessions/:sessionId/email rejects invalid email address', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/email`,
      headers: {
        'x-booth-key': 'test-booth-key',
      },
      payload: {
        email: 'not-an-email',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it('GET /api/public/gallery/:sessionId requires token parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/gallery/${testSessionId}`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('TOKEN_REQUIRED');
  });

  it('GET /api/public/gallery/:sessionId rejects invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/gallery/${testSessionId}?token=invalid-token-12345`,
    });

    expect(res.statusCode).toBe(404);
  });

  it('GET /api/public/gallery/:sessionId succeeds with valid token and lists files', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/gallery/${testSessionId}?token=${generatedToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('sessionCode');
    expect(body.data).toHaveProperty('expiresAt');
    expect(body.data.isExpired).toBe(false);
    expect(Array.isArray(body.data.files)).toBe(true);
    expect(body.data.files.length).toBeGreaterThan(0);
    expect(body.data.accessCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /s/:sessionId renders mobile HTML gallery page successfully', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/s/${testSessionId}?token=${generatedToken}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Cetak 4R');
    expect(res.body).toContain('Unduh Foto');
  });

  it('GET /storage/galleries/:sessionId/:fileName serves file directly from local storage with 200 OK', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/storage/galleries/${testSessionId}/strip_final.jpg`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('GET /api/public/gallery/:sessionId/download/:fileName downloads file with attachment Content-Disposition', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/gallery/${testSessionId}/download/strip_final.jpg`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('strip_final.jpg');
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });
});
