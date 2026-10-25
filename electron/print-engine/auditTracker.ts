// electron/print-engine/auditTracker.ts
// Pelacak Audit Cetak, Penghitung Lembar Harian, dan Manajer Cetak Ulang (Reprint Recovery)

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { PrintAuditRecord, PrintEngineDailyAudit } from './types';

export class AuditTracker {
  private auditFilePath: string;
  private records: PrintAuditRecord[] = [];

  constructor() {
    // Simpan di direktori data aplikasi Electron pengguna
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    const dir = path.join(userDataPath, 'print-engine');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    this.auditFilePath = path.join(dir, 'print-audit.json');
    this.loadRecords();
  }

  /**
   * Memuat riwayat catatan cetak dari disk
   */
  private loadRecords(): void {
    try {
      if (fs.existsSync(this.auditFilePath)) {
        const raw = fs.readFileSync(this.auditFilePath, 'utf-8');
        this.records = JSON.parse(raw);
        if (!Array.isArray(this.records)) this.records = [];
      }
    } catch (err) {
      console.warn('[AuditTracker] Gagal memuat audit log:', err);
      this.records = [];
    }
  }

  /**
   * Menyimpan riwayat catatan cetak ke disk
   */
  private saveRecords(): void {
    try {
      // Simpan maksimal 3000 record terakhir agar hemat disk
      if (this.records.length > 3000) {
        this.records = this.records.slice(-3000);
      }
      fs.writeFileSync(this.auditFilePath, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AuditTracker] Gagal menyimpan audit log:', err);
    }
  }

  /**
   * Merekam satu pekerjaan cetak ke audit log
   */
  recordPrintJob(record: Omit<PrintAuditRecord, 'id' | 'timestamp'>): PrintAuditRecord {
    const fullRecord: PrintAuditRecord = {
      ...record,
      id: `print-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.records.push(fullRecord);
    this.saveRecords();
    return fullRecord;
  }

  /**
   * Mengambil ringkasan statistik cetak harian (Hari Ini)
   */
  getDailyAudit(dateStr?: string): PrintEngineDailyAudit {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const dayRecords = this.records.filter((r) => r.timestamp.startsWith(targetDate));

    let totalPrints = 0;
    let successfulPrints = 0;
    let failedPrints = 0;
    let reprintCount = 0;
    const printerBreakdown: Record<string, number> = {};

    for (const r of dayRecords) {
      const copies = Number(r.copies) || 1;
      totalPrints += copies;

      if (r.status === 'completed') {
        successfulPrints += copies;
      } else {
        failedPrints += copies;
      }

      if (r.isReprint) {
        reprintCount += copies;
      }

      const pName = r.printerName || 'Default';
      printerBreakdown[pName] = (printerBreakdown[pName] || 0) + copies;
    }

    return {
      date: targetDate,
      totalPrints,
      successfulPrints,
      failedPrints,
      reprintCount,
      printerBreakdown,
    };
  }

  /**
   * Mengambil riwayat cetak berdasarkan sessionId tertentu (untuk kebutuhan reprint recovery)
   */
  getSessionPrintHistory(sessionId: string): PrintAuditRecord[] {
    return this.records.filter((r) => r.sessionId === sessionId);
  }

  /**
   * Mengambil riwayat cetak terbaru
   */
  getRecentAuditLogs(limit = 50): PrintAuditRecord[] {
    return [...this.records].reverse().slice(0, limit);
  }
}
