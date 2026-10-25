// frontend/src/types/electron.d.ts
// Typed declaration for window.electronKiosk & window.electronPrinter injected by Electron preload

export interface ElectronKioskAPI {
  isElectron: boolean;
  platform: string;
  exitKiosk: (pin?: string) => Promise<{ success: boolean; message?: string }>;
  toggleFullscreen: () => Promise<boolean>;
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    osVersion: string;
    memory: { totalMB: number; freeMB: number };
    kioskMode: boolean;
  }>;
  onKioskEvent: (channel: string, callback: (...args: any[]) => void) => () => void;
}

export interface ElectronPrinterAPI {
  listDevices: () => Promise<any[]>;
  getStatus: (printerName: string) => Promise<any>;
  submitJob: (payload: any) => Promise<any>;
  getQueue: () => Promise<any>;
  manualResume: () => Promise<boolean>;
  cancelJob: () => Promise<boolean>;
  getAuditStats: (dateStr?: string) => Promise<any>;
  reprintJob: (sessionId: string, reason: string, copies?: number, printerName?: string) => Promise<any>;
  onPrinterEvent: (event: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
  interface Window {
    electronKiosk?: ElectronKioskAPI;
    electronPrinter?: ElectronPrinterAPI;
  }
}

export {};
