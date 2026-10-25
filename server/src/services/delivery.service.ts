// src/services/delivery.service.ts
// Service Orkestrasi Distribusi Digital (Galeri Berbatas Waktu & Email Delivery API)
// Sesuai ARCHITECTURE.md §4.2, §6.3 & THE_NEXT_STEP.md §6

import crypto from 'node:crypto';
import os from 'node:os';
import type { PrismaClient } from '@prisma/client';
import { StorageService, type SessionGalleryItem } from './storage.service.js';
import { EmailService } from './email.service.js';
import { AppError, ErrorCode } from '../types/common.types.js';
import { getEnv } from '../config/env.js';

export interface GalleryDetails {
  galleryId: string;
  sessionId: string;
  qrString: string;
  galleryUrl: string;
  token: string;
  expiresAt: string;
  accessCount: number;
}

export class DeliveryService {
  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService = new StorageService(),
    private emailService: EmailService = new EmailService()
  ) {}

  /**
   * Menentukan base URL galeri (bisa custom domain, cloudflare tunnel, atau auto-detect IP lokal)
   */
  public getBaseUrl(): string {
    const env = getEnv();
    if (env.GALLERY_BASE_URL && env.GALLERY_BASE_URL.trim().length > 0) {
      return env.GALLERY_BASE_URL.replace(/\/+$/, '');
    }

    // Auto-detect IP lokal mesin Kiosk di jaringan Wi-Fi / LAN (misal: 192.168.10.138)
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
          return `http://${net.address}:${env.PORT || 3000}`;
        }
      }
    }

    return `http://localhost:${env.PORT || 3000}`;
  }

  /**
   * Membuat atau mengambil galeri privat berbatas waktu (48 jam) untuk sebuah sesi
   */
  async getOrCreateGallery(sessionId: string): Promise<GalleryDetails> {
    const existing = await this.prisma.gallery.findUnique({
      where: { sessionId },
    });

    const settings = await this.prisma.settings.findFirst();
    const boothName = settings?.boothName || 'Minja Photobooth';

    if (existing) {
      let galleryUrl = '';
      if (this.storageService.isCloudStorageActive()) {
        try {
          galleryUrl = await this.storageService.publishCloudGallery(
            sessionId,
            sessionId.slice(-5).toUpperCase(),
            existing.expiresAt.toISOString(),
            boothName
          );
        } catch (e) {
          console.warn('[DeliveryService] Fallback ke lokal URL karena publish Cloud Gallery gagal:', e);
        }
      }

      if (!galleryUrl) {
        galleryUrl = `${this.getBaseUrl()}/s/${sessionId}?token=${existing.token}`;
      }

      return {
        galleryId: existing.id,
        sessionId: existing.sessionId,
        qrString: galleryUrl,
        galleryUrl,
        token: existing.token,
        expiresAt: existing.expiresAt.toISOString(),
        accessCount: existing.accessCount,
      };
    }

    // Pastikan session ada di database sebelum membuat Gallery (mencegah foreign key constraint error)
    const sessionExists = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionExists) {
      let pkg = await this.prisma.package.findFirst();
      if (!pkg) {
        pkg = await this.prisma.package.create({
          data: {
            name: 'Paket Photobooth Standar',
            price: 50000,
            durationSeconds: 180,
            maxShots: 6,
            maxSelections: 3,
            defaultPrints: 2,
            additionalPrintPrice: 15000,
          },
        });
      }

      await this.prisma.session.create({
        data: {
          id: sessionId,
          packageId: pkg.id,
          basePrice: pkg.price,
          totalPrice: pkg.price,
          maxShots: pkg.maxShots,
          maxSelections: pkg.maxSelections,
          totalPrints: pkg.defaultPrints,
          durationSeconds: pkg.durationSeconds,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    }

    // Buat token kriptografis unik 32 karakter (crypto-secure)
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000); // 48 jam

    const created = await this.prisma.gallery.create({
      data: {
        sessionId,
        token,
        expiresAt,
      },
    });

    let galleryUrl = '';
    if (this.storageService.isCloudStorageActive()) {
      try {
        galleryUrl = await this.storageService.publishCloudGallery(
          sessionId,
          sessionId.slice(-5).toUpperCase(),
          created.expiresAt.toISOString(),
          boothName
        );
      } catch (e) {
        console.warn('[DeliveryService] Fallback ke lokal URL karena publish Cloud Gallery gagal:', e);
      }
    }

    if (!galleryUrl) {
      galleryUrl = `${this.getBaseUrl()}/s/${sessionId}?token=${token}`;
    }

    return {
      galleryId: created.id,
      sessionId: created.sessionId,
      qrString: galleryUrl,
      galleryUrl,
      token: created.token,
      expiresAt: created.expiresAt.toISOString(),
      accessCount: created.accessCount,
    };
  }

  /**
   * Mengirimkan notifikasi tautan unduhan galeri foto via Email
   */
  async sendEmailNotification(
    sessionId: string,
    email: string
  ): Promise<{ sent: boolean; messageId: string }> {
    const gallery = await this.getOrCreateGallery(sessionId);

    // Ambil nama booth dari settings jika ada
    const settings = await this.prisma.settings.findFirst();
    const boothName = settings?.boothName || 'Minja Photobooth';

    const sendRes = await this.emailService.sendGalleryNotification(
      email,
      gallery.galleryUrl,
      boothName,
      sessionId
    );

    // Catat DeliveryJob ke database untuk audit pengiriman
    try {
      await this.prisma.deliveryJob.create({
        data: {
          sessionId,
          galleryId: gallery.galleryId,
          channel: 'email',
          email: sendRes.recipientEmail,
          status: 'sent',
          messageId: sendRes.messageId,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      console.warn('[DeliveryService] Gagal menyimpan DeliveryJob ke Prisma:', err);
    }

    return {
      sent: true,
      messageId: sendRes.messageId,
    };
  }

  /**
   * Mengunggah file foto atau video ke penyimpanan galeri
   */
  async uploadGalleryFile(
    sessionId: string,
    fileType: 'layout_4r' | 'live_video' | 'raw_photo',
    dataUrl: string,
    customName?: string
  ): Promise<{ url: string; sizeBytes: number }> {
    let ext = fileType === 'live_video' ? 'mp4' : 'jpg';
    let mimeType = fileType === 'live_video' ? 'video/mp4' : 'image/jpeg';

    if (dataUrl.startsWith('data:')) {
      const mimeMatch = dataUrl.match(/^data:([^;,]+)/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1].toLowerCase();
        if (mimeType.includes('webm')) ext = 'webm';
        else if (mimeType.includes('mp4')) ext = 'mp4';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      }
    }

    let fileName = customName;
    if (!fileName) {
      fileName = `${fileType}_${Date.now()}.${ext}`;
    } else if (fileType === 'live_video' && ext === 'webm' && fileName.endsWith('.mp4')) {
      fileName = fileName.replace(/\.mp4$/i, '.webm');
    }

    const result = await this.storageService.uploadFile(
      sessionId,
      fileName,
      dataUrl,
      mimeType
    );

    // Otomatis refresh publikasi galeri Cloudflare R2 di background agar file baru langsung muncul di HTML galeri
    if (this.storageService.isCloudStorageActive()) {
      (async () => {
        try {
          const gallery = await this.prisma.gallery.findUnique({ where: { sessionId } });
          const settings = await this.prisma.settings.findFirst();
          const boothName = settings?.boothName || 'Minja Photobooth';
          await this.storageService.publishCloudGallery(
            sessionId,
            sessionId.slice(-5).toUpperCase(),
            gallery?.expiresAt?.toISOString() || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            boothName
          );
        } catch (err) {
          console.warn('[DeliveryService] Gagal merefresh Cloud Gallery setelah upload:', err);
        }
      })();
    }

    return {
      url: result.publicUrl,
      sizeBytes: result.sizeBytes,
    };
  }

  /**
   * Akses publik untuk smartphone pelanggan mengunduh foto dari galeri
   */
  async getPublicGallery(
    sessionId: string,
    token: string
  ): Promise<{
    sessionCode: string;
    expiresAt: string;
    isExpired: boolean;
    files: string[];
    accessCount: number;
  }> {
    const gallery = await this.prisma.gallery.findUnique({
      where: { sessionId },
      include: {
        session: true,
      },
    });

    if (!gallery || gallery.token !== token) {
      throw new AppError(
        404,
        ErrorCode.GALLERY_TOKEN_INVALID,
        'Tautan galeri tidak valid atau token verifikasi salah.'
      );
    }

    const isExpired = new Date() > gallery.expiresAt;
    if (isExpired) {
      throw new AppError(
        410,
        ErrorCode.GALLERY_EXPIRED,
        'Masa aktif tautan galeri foto telah berakhir (maksimal 48 jam).'
      );
    }

    // Update access count
    await this.prisma.gallery.update({
      where: { id: gallery.id },
      data: { accessCount: { increment: 1 } },
    });

    const files = await this.storageService.listSessionFiles(sessionId);

    return {
      sessionCode: gallery.session.id.slice(-5).toUpperCase(),
      expiresAt: gallery.expiresAt.toISOString(),
      isExpired: false,
      files,
      accessCount: gallery.accessCount + 1,
    };
  }

  /**
   * Mengambil data galeri terstruktur untuk rendering template halaman web mobile
   */
  async getGalleryHtmlData(
    sessionId: string,
    token: string
  ): Promise<{
    boothName: string;
    sessionId: string;
    sessionCode: string;
    expiresAt: string;
    items: SessionGalleryItem[];
  }> {
    const gallery = await this.prisma.gallery.findUnique({
      where: { sessionId },
      include: {
        session: true,
      },
    });

    if (!gallery || gallery.token !== token) {
      throw new AppError(
        404,
        ErrorCode.GALLERY_TOKEN_INVALID,
        'Tautan galeri tidak valid atau token verifikasi salah.'
      );
    }

    if (new Date() > gallery.expiresAt) {
      throw new AppError(
        410,
        ErrorCode.GALLERY_EXPIRED,
        'Masa aktif galeri foto telah berakhir (maksimal 48 jam).'
      );
    }

    // Update access count
    await this.prisma.gallery.update({
      where: { id: gallery.id },
      data: { accessCount: { increment: 1 } },
    });

    const settings = await this.prisma.settings.findFirst();
    const boothName = settings?.boothName || 'Minja Photobooth';

    const items = await this.storageService.listSessionGalleryItems(sessionId);

    return {
      boothName,
      sessionId,
      sessionCode: gallery.session.id.slice(-5).toUpperCase(),
      expiresAt: gallery.expiresAt.toISOString(),
      items,
    };
  }
}
