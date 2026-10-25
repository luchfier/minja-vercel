// src/services/settings.service.ts
// Service pengelolaan konfigurasi & branding booth
// Sesuai API_CONTRACT.md §3.2, §3.3

import type { PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import type { updateSettingsSchema } from '../schemas/admin.schema.js';
import { logAuditEvent } from './audit.service.js';

export class SettingsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Konfigurasi publik untuk tampilan booth / pelanggan
   * GET /api/settings
   */
  async getPublicSettings() {
    let settings = await this.prisma.settings.findFirst();

    if (!settings) {
      // Inisialisasi default jika belum ada
      settings = await this.prisma.settings.create({
        data: {
          boothName: 'MinjaPhotobooth',
          brandTitle: 'Minja Photobooth',
          welcomeText: 'Selamat datang!',
          primaryColor: '#6C5CE7',
          secondaryColor: '#A29BFE',
        },
      });
    }

    return {
      boothName: settings.boothName,
      brandTitle: settings.brandTitle,
      welcomeText: settings.welcomeText,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      logoUrl: settings.logoUrl,
      wallpaperUrl: settings.wallpaperUrl,
      attractVideoUrl: settings.attractVideoUrl,
      maintenanceMode: settings.maintenanceMode,
      emailDeliveryEnabled: settings.emailDeliveryEnabled,
      galleryEnabled: settings.galleryEnabled,
      paymentTimeoutSeconds: settings.paymentTimeoutSeconds,
      autoResetSeconds: settings.autoResetSeconds,
    };
  }

  /**
   * Seluruh konfigurasi sistem untuk Admin
   * GET /api/admin/settings
   */
  async getAllSettings() {
    let settings = await this.prisma.settings.findFirst();

    if (!settings) {
      settings = await this.prisma.settings.create({
        data: {},
      });
    }

    return settings;
  }

  /**
   * Memperbarui konfigurasi sistem
   * PUT /api/admin/settings
   */
  async updateSettings(
    data: z.infer<typeof updateSettingsSchema>,
    adminId?: string,
    ipAddress?: string
  ) {
    let settings = await this.prisma.settings.findFirst();

    if (!settings) {
      settings = await this.prisma.settings.create({
        data: {},
      });
    }

    const updated = await this.prisma.settings.update({
      where: { id: settings.id },
      data,
    });

    await logAuditEvent(this.prisma, {
      action: 'SETTINGS_UPDATED',
      adminId,
      ipAddress,
      details: { changedFields: Object.keys(data) },
    });

    return updated;
  }
}
