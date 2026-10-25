// server/src/services/cleanup.service.ts
// Layanan Pembersihan Otomatis File Sementara & Cache Cetak
// Mencegah penumpukan file cetak di disk lokal Kiosk

import fs from 'node:fs';
import path from 'node:path';

export class CleanupService {
  private printsDir: string;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.printsDir = path.resolve(process.cwd(), 'storage/prints');
  }

  /**
   * Menghapus file gambar/PDF hasil cetak yang sudah melebihi batas usia
   * @param maxAgeHours Batas waktu file disimpan (default 24 jam)
   */
  public cleanOldPrintFiles(maxAgeHours = 24): { deleted: number; freedBytes: number } {
    let deletedCount = 0;
    let freedBytes = 0;

    if (!fs.existsSync(this.printsDir)) {
      return { deleted: 0, freedBytes: 0 };
    }

    try {
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const files = fs.readdirSync(this.printsDir);

      for (const file of files) {
        const fullPath = path.join(this.printsDir, file);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            const ageMs = now - stats.mtimeMs;
            // Hapus file kalibrasi & tes lebih cepat (2 jam), file sesi normal (24 jam)
            const threshold = file.includes('calib') || file.includes('test_') ? 2 * 3600 * 1000 : maxAgeMs;

            if (ageMs > threshold) {
              freedBytes += stats.size;
              fs.unlinkSync(fullPath);
              deletedCount++;
            }
          }
        } catch {
          // File mungkin sedang diakses proses lain
        }
      }

      if (deletedCount > 0) {
        const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
        console.log(`🧹 [CleanupService] Menghapus ${deletedCount} file cetak kedaluwarsa (${freedMB} MB dibebaskan).`);
      }
    } catch (err) {
      console.warn('[CleanupService] Error saat membersihkan storage/prints:', err);
    }

    return { deleted: deletedCount, freedBytes };
  }

  /**
   * Memulai background scheduler pembersihan berkala
   * @param intervalHours Frekuensi pemeriksaan (default setiap 1 jam)
   */
  public startScheduledCleanup(intervalHours = 1): void {
    // Jalankan segera saat server pertama kali start
    this.cleanOldPrintFiles(24);

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.intervalTimer = setInterval(() => {
      this.cleanOldPrintFiles(24);
    }, intervalHours * 60 * 60 * 1000);
  }

  public stopScheduledCleanup(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

export const cleanupService = new CleanupService();
