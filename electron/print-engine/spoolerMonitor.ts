// electron/print-engine/spoolerMonitor.ts
// Windows Spooler & Hardware Inspector
// Mendeteksi printer aktif, offline, status antrean spooler, dan sensor hardware

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DetailedPrinterInfo,
  DetailedHardwareStatus,
  DetectedHardwareIssue,
  PrinterCategory,
} from './types';

const execFileAsync = promisify(execFile);

export class SpoolerMonitor {
  private cachedPrinters: DetailedPrinterInfo[] = [];
  private lastScanTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 2500; // Cache 2.5 detik untuk efisiensi sistem

  /**
   * Mengambil daftar printer Windows lengkap dengan telemetry hardware
   */
  async getInstalledPrinters(forceFresh = false): Promise<DetailedPrinterInfo[]> {
    const now = Date.now();
    if (!forceFresh && this.cachedPrinters.length > 0 && now - this.lastScanTimestamp < this.CACHE_TTL_MS) {
      return this.cachedPrinters;
    }

    try {
      // Skrip PowerShell untuk mengambil data printer & antrean spooler Windows sekaligus
      const psCommand = `
        $printers = Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default, WorkOffline, PrinterStatus, ExtendedPrinterStatus, DetectedErrorState, PrinterState, Network;
        $jobs = Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Select-Object Name, JobId, JobStatus, Document;
        [PSCustomObject]@{
          Printers = @($printers);
          Jobs = @($jobs);
        } | ConvertTo-Json -Depth 3 -Compress
      `;

      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
        { timeout: 7000 }
      );

      const parsed = JSON.parse(stdout.trim() || '{"Printers":[],"Jobs":[]}');
      const rawPrinters = Array.isArray(parsed.Printers) ? parsed.Printers : parsed.Printers ? [parsed.Printers] : [];
      const rawJobs = Array.isArray(parsed.Jobs) ? parsed.Jobs : parsed.Jobs ? [parsed.Jobs] : [];

      const result: DetailedPrinterInfo[] = rawPrinters.map((p: any) => {
        const name = p.Name || 'Unknown Printer';
        const driverName = p.DriverName || '';
        const portName = p.PortName || '';
        const isOffline = p.WorkOffline === true;
        const category = this.detectPrinterCategory(name, driverName);

        // Hitung berapa pekerjaan cetak yang sedang mengantre di printer ini
        const activeQueueCount = rawJobs.filter((j: any) => {
          const jName = (j.Name || '').toLowerCase();
          return jName.startsWith(name.toLowerCase());
        }).length;

        // Analisis status hardware & sensor printer
        const hardwareStatus = this.analyzeHardwareStatus(p, isOffline, activeQueueCount);

        // Standar ukuran yang didukung berdasarkan jenis printer
        const supportedSizes = this.determineSupportedSizes(category);

        return {
          name,
          displayName: name,
          driverName,
          portName,
          isDefault: p.Default === true,
          isNetwork: p.Network === true,
          category,
          connectionState: isOffline
            ? 'offline'
            : hardwareStatus.hardwareIssue === 'paper_out' || hardwareStatus.hardwareIssue === 'paper_jam'
            ? 'error'
            : 'connected',
          hardwareStatus,
          supportedSizes,
          paperSize: '10×15 cm',
        };
      });

      this.cachedPrinters = result;
      this.lastScanTimestamp = now;
      return result;
    } catch (err) {
      console.warn('[SpoolerMonitor] Warning saat scan printer Windows:', err);
      return this.cachedPrinters;
    }
  }

  /**
   * Mengambil status hardware printer tertentu secara spesifik
   */
  async getPrinterStatus(printerName: string): Promise<DetailedHardwareStatus | null> {
    const list = await this.getInstalledPrinters(true);
    const target = list.find((p) => p.name.toLowerCase() === printerName.toLowerCase());
    return target ? target.hardwareStatus : null;
  }

  /**
   * Mengklasifikasikan kategori printer (Inkjet vs Selphy vs Dye-Sub vs SureLab)
   */
  private detectPrinterCategory(name: string, driver: string): PrinterCategory {
    const combined = `${name} ${driver}`.toLowerCase();

    if (combined.includes('selphy') || combined.includes('cp1300') || combined.includes('cp1500') || combined.includes('cp1000')) {
      return 'selphy';
    }
    if (
      combined.includes('dnp') ||
      combined.includes('rx1') ||
      combined.includes('qw410') ||
      combined.includes('ds620') ||
      combined.includes('citizen') ||
      combined.includes('cy-02') ||
      combined.includes('cx-02') ||
      combined.includes('hiti') ||
      combined.includes('p525') ||
      combined.includes('sinfonia')
    ) {
      return 'dyesub';
    }
    if (combined.includes('surelab') || combined.includes('sl-d5') || combined.includes('sl-d1') || combined.includes('d530') || combined.includes('d1030')) {
      return 'surelab';
    }
    if (
      combined.includes('epson') ||
      combined.includes('l805') ||
      combined.includes('l1805') ||
      combined.includes('l31') ||
      combined.includes('l32') ||
      combined.includes('pixma') ||
      combined.includes('canon g') ||
      combined.includes('deskjet') ||
      combined.includes('smart tank')
    ) {
      return 'inkjet';
    }

    return 'standard';
  }

  /**
   * Menganalisis status hardware dari data WMI Win32_Printer
   */
  private analyzeHardwareStatus(p: any, isOffline: boolean, queueCount: number): DetailedHardwareStatus {
    const detectedErr = Number(p.DetectedErrorState) || 0;
    const printerStatus = Number(p.PrinterStatus) || 0;
    const extStatus = Number(p.ExtendedPrinterStatus) || 0;

    let issue: DetectedHardwareIssue = 'none';
    let issueText: string | null = null;
    let hasExtended = false;

    // 1. Periksa apakah perangkat offline (kabel USB terputus / printer mati)
    if (isOffline) {
      issue = 'offline';
      issueText = 'Printer Offline (Kabel USB terputus atau printer mati)';
    }
    // 2. Periksa sensor error Windows spesifik (Win32_Printer.DetectedErrorState)
    else if (detectedErr === 4) {
      issue = 'paper_out';
      issueText = 'Kertas Habis (Out of Paper)';
      hasExtended = true;
    } else if (detectedErr === 8) {
      issue = 'paper_jam';
      issueText = 'Kertas Macet (Paper Jam)';
      hasExtended = true;
    } else if (detectedErr === 7) {
      issue = 'door_open';
      issueText = 'Penutup Printer Terbuka (Cover / Door Open)';
      hasExtended = true;
    } else if (detectedErr === 6 || detectedErr === 5) {
      issue = 'toner_or_ribbon_out';
      issueText = 'Ribbon / Tinta Habis';
      hasExtended = true;
    } else if (detectedErr === 11) {
      issue = 'paper_problem';
      issueText = 'Kendala Penarikan Kertas';
      hasExtended = true;
    } else if (detectedErr === 13) {
      issue = 'user_intervention';
      issueText = 'Memerlukan Intervensi Pengguna';
      hasExtended = true;
    }
    // 3. Periksa ExtendedPrinterStatus jika belum ada error spesifik
    else if (extStatus === 7) {
      issue = 'offline';
      issueText = 'Printer Tidak Siap (Offline)';
    } else if (extStatus === 9) {
      issue = 'unknown';
      issueText = 'Status Driver Melaporkan Kendala / Error';
    } else if (extStatus === 10 || printerStatus === 4) {
      issue = 'busy';
      issueText = 'Printer Sedang Sibuk Memproses';
    }

    const isReady = !isOffline && (issue === 'none' || issue === 'busy');

    let statusText = 'Siap Mencetak (Ready)';
    if (isOffline) statusText = 'Offline';
    else if (issueText) statusText = issueText;
    else if (queueCount > 0) statusText = `Memproses (${queueCount} antrean spooler)`;

    return {
      isOnline: !isOffline,
      statusText,
      hardwareIssue: issue,
      issueDescription: issueText,
      spoolerQueueCount: queueCount,
      isReadyToPrint: isReady,
      hasExtendedSensors: hasExtended,
      rawPrinterStatus: printerStatus,
      rawExtendedStatus: extStatus,
      rawDetectedErrorState: detectedErr,
    };
  }

  /**
   * Menentukan preset ukuran kertas yang cocok berdasarkan kategori printer
   */
  private determineSupportedSizes(cat: PrinterCategory): string[] {
    switch (cat) {
      case 'selphy':
        return ['10×15 cm (Postcard)', '5×15 cm Strip', 'Card 5.4×8.6 cm'];
      case 'dyesub':
        return ['10×15 cm (Standar Studio)', '5×15 cm (Auto Cut Strip)', '13×18 cm (5R)'];
      case 'surelab':
        return ['10×15 cm (Roll/Cut)', '13×18 cm (5R)', '15×20 cm (6R)', '20×30 cm (A4)'];
      case 'inkjet':
        return ['10×15 cm (Glossy Photo)', '21×29.7 cm (A4)', '5×15 cm Strip', '13×18 cm'];
      default:
        return ['10×15 cm (Standar)', '5×15 cm Strip', 'A4 Sheet'];
    }
  }
}
