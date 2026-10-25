// frontend/src/types/hardware.ts
// Tipe Perangkat Keras Kamera & Dedicated Windows Print Engine

export type DeviceConnectionStatus = 'connected' | 'demo' | 'disconnected' | 'busy' | 'error';

export interface CameraDeviceInfo {
  id: string;
  name: string;
  type: 'webcam' | 'virtual' | 'dslr' | 'external';
  status: DeviceConnectionStatus;
  isDefault: boolean;
  resolution?: string;
}

export interface PrinterSettingsConfig {
  borderless: boolean;
  orientation: 'portrait' | 'landscape' | 'auto';
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  colorMode: 'color' | 'grayscale' | 'vivid';
  autoCut: boolean;
  dpi: number;
  customPaperName?: string;
  customPaperWidthMm?: number;
  customPaperHeightMm?: number;
  printQuality?: 'standard' | 'high' | 'photo_fine' | 'ultra_glossy';
  mediaType?: 'glossy' | 'luster' | 'matte' | 'plain';
  sharpening?: 'off' | 'low' | 'medium' | 'high';
  brightnessOffset?: number;
  contrastOffset?: number;
}

export interface PrinterCustomConfig {
  printerName: string;
  displayName?: string;
  paperSize: string;
  isDefault: boolean;
  isActive: boolean;
  settings: PrinterSettingsConfig;
}

export type PrinterCategory = 'inkjet' | 'dyesub' | 'selphy' | 'surelab' | 'standard';

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
  hardwareIssue: string;
  issueDescription: string | null;
  spoolerQueueCount: number;
  isReadyToPrint: boolean;
  hasExtendedSensors: boolean;
  rawPrinterStatus?: number;
  rawExtendedStatus?: number;
  rawDetectedErrorState?: number;
  category?: PrinterCategory;
  portName?: string;
  connectionState?: string;
  detectedIssues?: string[];
}

export interface PrinterInfo {
  id: string;
  name: string;
  displayName?: string;
  driverName?: string;
  portName?: string;
  category?: PrinterCategory;
  isDefault: boolean;
  status: DeviceConnectionStatus;
  hardwareStatus?: DetailedHardwareStatus;
  paperStatus?: 'ready' | 'low' | 'empty';
  ribbonStatus?: 'ready' | 'low' | 'empty';
  supportedSizes?: string[];
  paperSize?: string;
  settings?: PrinterSettingsConfig;
}

export interface PrintJobParams {
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

export interface PrintJobResult {
  jobId: string;
  status: 'queued' | 'preparing' | 'printing' | 'paused_error' | 'completed' | 'failed' | 'cancelled';
  message?: string;
}

export interface PrintEngineDailyAudit {
  date: string;
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
  completedCopies?: number;
  isReprint: boolean;
  reprintReason?: string;
  status: 'completed' | 'failed';
  timestamp: string;
  errorMessage?: string;
  errorReason?: string;
}

export interface PrintEngineAuditData {
  daily: PrintEngineDailyAudit;
  recent: PrintAuditRecord[];
}

export interface PrintQueueItem {
  id: string;
  sessionId: string;
  printerName: string;
  filePath: string;
  totalCopies: number;
  completedCopies: number;
  currentCopyIndex: number;
  state: 'queued' | 'preparing' | 'printing' | 'paused_error' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  hardwareIssue?: string;
  errorMessage?: string;
}

export interface PrintQueueStatusData {
  queue: PrintQueueItem[];
  currentJob: PrintQueueItem | null;
  isPaused: boolean;
  pendingCount: number;
}
