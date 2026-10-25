// electron/print-engine/types.ts
// Kontrak Antarmuka & Tipe Data Dedicated Windows Print Engine

export type PrinterCategory = 'inkjet' | 'dyesub' | 'selphy' | 'surelab' | 'standard';

export type HardwareConnectionState = 'connected' | 'offline' | 'disconnected' | 'error';

export type DetectedHardwareIssue =
  | 'none'
  | 'paper_out'
  | 'paper_jam'
  | 'door_open'
  | 'toner_or_ribbon_out'
  | 'paper_problem'
  | 'user_intervention'
  | 'offline'
  | 'busy'
  | 'unknown';

export interface DetailedHardwareStatus {
  isOnline: boolean;
  statusText: string;
  hardwareIssue: DetectedHardwareIssue;
  issueDescription: string | null;
  spoolerQueueCount: number;
  isReadyToPrint: boolean;
  // Sensor lanjutan (hanya ada jika didukung driver printer)
  hasExtendedSensors: boolean;
  rawPrinterStatus?: number;
  rawExtendedStatus?: number;
  rawDetectedErrorState?: number;
}

export interface DetailedPrinterInfo {
  name: string;
  displayName: string;
  driverName: string;
  portName: string;
  isDefault: boolean;
  isNetwork: boolean;
  category: PrinterCategory;
  connectionState: HardwareConnectionState;
  hardwareStatus: DetailedHardwareStatus;
  supportedSizes: string[];
  paperSize?: string;
  settings?: any;
}

export type QueueJobState =
  | 'queued'
  | 'preparing'
  | 'printing'
  | 'paused_error'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PrintQueueItem {
  id: string;
  sessionId: string;
  printerName: string;
  filePath: string;
  totalCopies: number;
  completedCopies: number;
  currentCopyIndex: number;
  state: QueueJobState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  hardwareIssue?: DetectedHardwareIssue;
  errorMessage?: string;
  paperSizeName?: string;
  paperWidthCm?: number;
  paperHeightCm?: number;
  marginTopCm?: number;
  marginLeftCm?: number;
  orientation?: 'portrait' | 'landscape' | 'auto';
}

export interface PrintEngineDailyAudit {
  date: string; // YYYY-MM-DD
  totalPrints: number;
  successfulPrints: number;
  failedPrints: number;
  reprintCount: number;
  printerBreakdown: Record<string, number>;
}

export interface PrintAuditRecord {
  id: string;
  sessionId: string;
  printerName: string;
  copies: number;
  isReprint: boolean;
  reprintReason?: string;
  status: 'completed' | 'failed';
  timestamp: string;
  errorMessage?: string;
}

export interface SubmitJobPayload {
  sessionId: string;
  copies: number;
  layoutImageUrl: string;
  printerName?: string;
  customPaperWidthCm?: number;
  customPaperHeightCm?: number;
  marginTopCm?: number;
  marginLeftCm?: number;
  orientation?: 'portrait' | 'landscape' | 'auto';
}
