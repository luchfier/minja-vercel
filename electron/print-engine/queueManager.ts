// electron/print-engine/queueManager.ts
// Manajer Antrean Cetak & Pemulihan Kendala Fisik (Failure Recovery)
// Menangani jeda otomatis saat kertas habis / macet dan melanjutkan kembali setelah normal

import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { SpoolerMonitor } from './spoolerMonitor';
import { AuditTracker } from './auditTracker';
import {
  PrintQueueItem,
  QueueJobState,
  DetectedHardwareIssue,
  SubmitJobPayload,
} from './types';

const execFileAsync = promisify(execFile);

export class QueueManager extends EventEmitter {
  private queue: PrintQueueItem[] = [];
  private isProcessing = false;
  private currentJob: PrintQueueItem | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private spoolerMonitor: SpoolerMonitor;
  private auditTracker: AuditTracker;
  private scriptPath: string;

  constructor(spoolerMonitor: SpoolerMonitor, auditTracker: AuditTracker) {
    super();
    this.spoolerMonitor = spoolerMonitor;
    this.auditTracker = auditTracker;

    const isPackaged = typeof app !== 'undefined' && app.isPackaged;
    const prodScript = path.join(process.resourcesPath || '', 'scripts', 'silent-print.ps1');
    const devScript = path.resolve(__dirname, '../../server/scripts/silent-print.ps1');
    this.scriptPath = isPackaged && fs.existsSync(prodScript) ? prodScript : devScript;
  }

  /**
   * Menambahkan pekerjaan cetak baru ke dalam antrean
   */
  async enqueueJob(payload: SubmitJobPayload): Promise<PrintQueueItem> {
    const job: PrintQueueItem = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: payload.sessionId,
      printerName: payload.printerName || '',
      filePath: payload.layoutImageUrl,
      totalCopies: Math.max(1, payload.copies || 1),
      completedCopies: 0,
      currentCopyIndex: 1,
      state: 'queued',
      createdAt: new Date().toISOString(),
      paperWidthCm: payload.customPaperWidthCm || 10,
      paperHeightCm: payload.customPaperHeightCm || 15,
      marginTopCm: payload.marginTopCm || 0,
      marginLeftCm: payload.marginLeftCm || 0,
      orientation: payload.orientation || 'portrait',
    };

    this.queue.push(job);
    this.emit('queue-updated', this.getQueueStatus());

    // Picu pemrosesan antrean
    this.processNextJob();

    return job;
  }

  /**
   * Mengambil status antrean terkini
   */
  getQueueStatus(): {
    queue: PrintQueueItem[];
    currentJob: PrintQueueItem | null;
    isPaused: boolean;
    pendingCount: number;
  } {
    return {
      queue: this.queue,
      currentJob: this.currentJob,
      isPaused: this.currentJob?.state === 'paused_error',
      pendingCount: this.queue.filter((j) => j.state === 'queued').length,
    };
  }

  /**
   * Pemrosesan pekerjaan antrean secara berurutan
   */
  private async processNextJob(): Promise<void> {
    if (this.isProcessing) return;

    const nextJob = this.queue.find((j) => j.state === 'queued');
    if (!nextJob) {
      this.currentJob = null;
      return;
    }

    this.isProcessing = true;
    this.currentJob = nextJob;
    nextJob.state = 'preparing';
    nextJob.startedAt = new Date().toISOString();
    this.emit('job-started', nextJob);

    // Dapatkan nama printer aktif jika tidak ditentukan
    if (!nextJob.printerName) {
      const printers = await this.spoolerMonitor.getInstalledPrinters();
      const defaultP = printers.find((p) => p.isDefault) || printers[0];
      nextJob.printerName = defaultP ? defaultP.name : '';
    }

    await this.executeJobWithRecovery(nextJob);
  }

  /**
   * Mengeksekusi pekerjaan cetak dengan Failure Recovery per lembar
   */
  private async executeJobWithRecovery(job: PrintQueueItem): Promise<void> {
    // Pastikan file gambar ada di disk lokal
    let targetFilePath = job.filePath;
    if (targetFilePath.startsWith('data:image/')) {
      targetFilePath = this.saveBase64ToTemp(targetFilePath, job.sessionId);
      job.filePath = targetFilePath;
    }

    while (job.completedCopies < job.totalCopies) {
      job.currentCopyIndex = job.completedCopies + 1;

      // 1. Cek kesehatan printer sebelum mencetak lembar ini
      const status = await this.spoolerMonitor.getPrinterStatus(job.printerName);
      if (status && !status.isReadyToPrint) {
        // Terjadi kendala fisik (Kertas habis, macet, pintu terbuka, atau offline)
        await this.pauseForRecovery(job, status.hardwareIssue, status.issueDescription || status.statusText);
        return; // Hentikan eksekusi sementara sampai kertas/printer siap
      }

      // 2. Kirim 1 lembar ke spooler Windows
      job.state = 'printing';
      this.emit('job-progress', {
        jobId: job.id,
        currentCopy: job.currentCopyIndex,
        totalCopies: job.totalCopies,
        percent: Math.round((job.completedCopies / job.totalCopies) * 100),
      });

      try {
        await this.sendSilentPrintSheet(job);
        job.completedCopies++;
        this.emit('sheet-printed', {
          jobId: job.id,
          completedCopies: job.completedCopies,
          totalCopies: job.totalCopies,
        });

        // Beri jeda 800ms antar lembar cetak agar buffer spooler lancar
        await new Promise((r) => setTimeout(r, 800));
      } catch (err: any) {
        console.error(`[QueueManager] Gagal mencetak lembar ${job.currentCopyIndex}:`, err);
        await this.pauseForRecovery(job, 'paper_problem', err.message || 'Kendala spooler Windows');
        return;
      }
    }

    // Pekerjaan selesai penuh
    job.state = 'completed';
    job.completedAt = new Date().toISOString();
    this.emit('job-completed', job);

    this.auditTracker.recordPrintJob({
      sessionId: job.sessionId,
      printerName: job.printerName,
      copies: job.totalCopies,
      isReprint: false,
      status: 'completed',
    });

    this.isProcessing = false;
    this.processNextJob();
  }

  /**
   * Menjeda antrean untuk Failure Recovery dan memulai pemantauan aktif
   */
  private async pauseForRecovery(
    job: PrintQueueItem,
    issue: DetectedHardwareIssue,
    message: string
  ): Promise<void> {
    job.state = 'paused_error';
    job.hardwareIssue = issue;
    job.errorMessage = message;

    this.emit('queue-paused', {
      job,
      issue,
      message,
      promptText: this.getFriendlyPrompt(issue, job.currentCopyIndex, job.totalCopies),
    });

    // Mulai polling aktif setiap 2 detik untuk memeriksa apakah masalah telah diselesaikan (misal kertas diisi)
    if (this.recoveryInterval) clearInterval(this.recoveryInterval);

    this.recoveryInterval = setInterval(async () => {
      try {
        const freshStatus = await this.spoolerMonitor.getPrinterStatus(job.printerName);
        if (freshStatus && freshStatus.isReadyToPrint) {
          console.log(`[QueueManager] Printer '${job.printerName}' kembali siap! Melanjutkan antrean...`);
          if (this.recoveryInterval) clearInterval(this.recoveryInterval);
          this.recoveryInterval = null;

          job.state = 'preparing';
          job.hardwareIssue = 'none';
          job.errorMessage = undefined;

          this.emit('queue-resumed', {
            jobId: job.id,
            resumedAtCopy: job.currentCopyIndex,
          });

          // Lanjutkan mencetak sisa lembar yang tertunda
          await this.executeJobWithRecovery(job);
        }
      } catch (e) {
        console.warn('[QueueManager] Polling recovery error:', e);
      }
    }, 2000);
  }

  /**
   * Resume manual dari Admin Panel
   */
  async manualResume(): Promise<boolean> {
    if (this.currentJob && this.currentJob.state === 'paused_error') {
      if (this.recoveryInterval) clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;

      const job = this.currentJob;
      job.state = 'preparing';
      this.emit('queue-resumed', { jobId: job.id, resumedAtCopy: job.currentCopyIndex });
      this.executeJobWithRecovery(job);
      return true;
    }
    return false;
  }

  /**
   * Batalkan pekerjaan yang sedang terhenti
   */
  cancelCurrentJob(): boolean {
    if (this.currentJob) {
      if (this.recoveryInterval) clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;

      this.currentJob.state = 'cancelled';
      this.emit('job-cancelled', this.currentJob);
      this.isProcessing = false;
      this.processNextJob();
      return true;
    }
    return false;
  }

  /**
   * Menjalankan skrip PowerShell silent printing untuk 1 lembar
   */
  private async sendSilentPrintSheet(job: PrintQueueItem): Promise<void> {
    if (!fs.existsSync(this.scriptPath)) {
      console.warn('[QueueManager] silent-print.ps1 tidak ditemukan, mode simulasi.');
      await new Promise((r) => setTimeout(r, 1200));
      return;
    }

    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-FilePath',
      job.filePath,
      '-PrinterName',
      job.printerName,
      '-Copies',
      '1', // Selalu kirim per 1 lembar untuk pelacakan presisi
      '-PaperWidthCm',
      String(job.paperWidthCm || 10),
      '-PaperHeightCm',
      String(job.paperHeightCm || 15),
      '-MarginTopCm',
      String(job.marginTopCm || 0),
      '-MarginLeftCm',
      String(job.marginLeftCm || 0),
      '-Orientation',
      job.orientation || 'portrait',
    ];

    await execFileAsync('powershell', args, { timeout: 25000 });
  }

  /**
   * Simpan base64 data URL ke file gambar sementara
   */
  private saveBase64ToTemp(dataUrl: string, sessionId: string): string {
    const tmpDir = path.resolve(process.cwd(), 'server/storage/prints');
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {}

    const fileName = `${sessionId}_${Date.now()}.jpg`;
    const fullPath = path.join(tmpDir, fileName);
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    return fullPath;
  }

  /**
   * Pesan pemandu ramah pelanggan & admin
   */
  private getFriendlyPrompt(issue: DetectedHardwareIssue, currentCopy: number, totalCopies: number): string {
    switch (issue) {
      case 'paper_out':
        return `Kertas printer habis saat memproses lembar ${currentCopy} dari ${totalCopies}. Silakan masukkan kertas ke baki printer untuk melanjutkan otomatis.`;
      case 'paper_jam':
        return `Terdeteksi kertas macet (Paper Jam) pada printer. Silakan buka penutup printer dan bersihkan sisa kertas.`;
      case 'door_open':
        return `Penutup printer sedang terbuka. Silakan tutup kembali baki/penutup printer.`;
      case 'toner_or_ribbon_out':
        return `Ribbon atau tinta printer habis. Silakan ganti ribbon/isi tinta.`;
      case 'offline':
        return `Printer terputus (Offline). Pastikan kabel USB dan power printer terpasang dengan baik.`;
      default:
        return `Printer sedang mengalami kendala teknis. Antrean cetak dijeda sementara.`;
    }
  }
}
