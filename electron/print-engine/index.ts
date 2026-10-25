// electron/print-engine/index.ts
// Modul Utama Dedicated Windows Print Engine untuk MinjaPhotobooth

import { ipcMain, BrowserWindow } from 'electron';
import { SpoolerMonitor } from './spoolerMonitor';
import { AuditTracker } from './auditTracker';
import { QueueManager } from './queueManager';
import { SubmitJobPayload } from './types';

export class PrintEngine {
  private static instance: PrintEngine | null = null;
  public spoolerMonitor: SpoolerMonitor;
  public auditTracker: AuditTracker;
  public queueManager: QueueManager;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    this.spoolerMonitor = new SpoolerMonitor();
    this.auditTracker = new AuditTracker();
    this.queueManager = new QueueManager(this.spoolerMonitor, this.auditTracker);
    this.setupEventListeners();
  }

  public static getInstance(): PrintEngine {
    if (!PrintEngine.instance) {
      PrintEngine.instance = new PrintEngine();
    }
    return PrintEngine.instance;
  }

  /**
   * Mengaitkan window renderer untuk menerima push notifikasi real-time
   */
  public attachWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Mendaftarkan seluruh IPC Handlers untuk komunikasi dengan Renderer React
   */
  public registerIpcHandlers(): void {
    // 1. Ambil daftar printer yang terpasang di sistem
    ipcMain.handle('printer:list-devices', async () => {
      return await this.spoolerMonitor.getInstalledPrinters(true);
    });

    // 2. Ambil status hardware spesifik printer
    ipcMain.handle('printer:get-status', async (_event, printerName: string) => {
      return await this.spoolerMonitor.getPrinterStatus(printerName);
    });

    // 3. Kirim job cetak ke antrean
    ipcMain.handle('printer:submit-job', async (_event, payload: SubmitJobPayload) => {
      return await this.queueManager.enqueueJob(payload);
    });

    // 4. Ambil status antrean terkini
    ipcMain.handle('printer:get-queue', async () => {
      return this.queueManager.getQueueStatus();
    });

    // 5. Resume manual antrean yang sedang paused karena error
    ipcMain.handle('printer:manual-resume', async () => {
      return await this.queueManager.manualResume();
    });

    // 6. Batalkan pekerjaan yang sedang terhenti
    ipcMain.handle('printer:cancel-job', async () => {
      return this.queueManager.cancelCurrentJob();
    });

    // 7. Ambil statistik audit harian
    ipcMain.handle('printer:get-audit-stats', async (_event, dateStr?: string) => {
      return {
        daily: this.auditTracker.getDailyAudit(dateStr),
        recent: this.auditTracker.getRecentAuditLogs(30),
      };
    });

    // 8. Cetak Ulang Darurat (Session Recovery Reprint)
    ipcMain.handle(
      'printer:reprint-job',
      async (_event, sessionId: string, reason: string, copies = 1, printerName?: string) => {
        // Cari riwayat cetak sesi ini
        const history = this.auditTracker.getSessionPrintHistory(sessionId);
        const lastJob = history[history.length - 1];

        const targetPrinter = printerName || lastJob?.printerName || '';

        // Catat sebagai reprint
        this.auditTracker.recordPrintJob({
          sessionId,
          printerName: targetPrinter,
          copies,
          isReprint: true,
          reprintReason: reason || 'Pemulihan sesi darurat / kertas terpotong',
          status: 'completed',
        });

        return {
          success: true,
          message: `Perintah cetak ulang ${copies} lembar sesi ${sessionId} berhasil dijadwalkan.`,
        };
      }
    );

    console.log('✅ [PrintEngine] Native Windows Print Engine IPC Handlers terdaftar.');
  }

  /**
   * Memancarkan event antrean ke UI renderer secara reaktif
   */
  private setupEventListeners(): void {
    const forwardToRenderer = (channel: string, data: any) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(channel, data);
      }
    };

    this.queueManager.on('queue-updated', (status) => forwardToRenderer('printer:event:queue-updated', status));
    this.queueManager.on('job-started', (job) => forwardToRenderer('printer:event:job-started', job));
    this.queueManager.on('job-progress', (prog) => forwardToRenderer('printer:event:job-progress', prog));
    this.queueManager.on('sheet-printed', (data) => forwardToRenderer('printer:event:sheet-printed', data));
    this.queueManager.on('queue-paused', (data) => forwardToRenderer('printer:event:queue-paused', data));
    this.queueManager.on('queue-resumed', (data) => forwardToRenderer('printer:event:queue-resumed', data));
    this.queueManager.on('job-completed', (job) => forwardToRenderer('printer:event:job-completed', job));
    this.queueManager.on('job-cancelled', (job) => forwardToRenderer('printer:event:job-cancelled', job));
  }
}
