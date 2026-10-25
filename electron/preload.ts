// electron/preload.ts
// Preload Script untuk Komunikasi Aman Antara Renderer (React) & Main Process (Node.js)
// Sesuai ARCHITECTURE.md §4.3 & SECURITY.md §7

import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronKioskBridge {
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

export interface ElectronPrinterBridge {
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

const kioskBridge: ElectronKioskBridge = {
  isElectron: true,
  platform: process.platform,

  exitKiosk: (pin?: string) => {
    return ipcRenderer.invoke('kiosk:exit', pin);
  },

  toggleFullscreen: () => {
    return ipcRenderer.invoke('kiosk:toggle-fullscreen');
  },

  getSystemInfo: () => {
    return ipcRenderer.invoke('kiosk:get-system-info');
  },

  onKioskEvent: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['kiosk:status', 'kiosk:admin-prompt'];
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return () => {};
  },
};

const printerBridge: ElectronPrinterBridge = {
  listDevices: () => {
    return ipcRenderer.invoke('printer:list-devices');
  },
  getStatus: (printerName: string) => {
    return ipcRenderer.invoke('printer:get-status', printerName);
  },
  submitJob: (payload: any) => {
    return ipcRenderer.invoke('printer:submit-job', payload);
  },
  getQueue: () => {
    return ipcRenderer.invoke('printer:get-queue');
  },
  manualResume: () => {
    return ipcRenderer.invoke('printer:manual-resume');
  },
  cancelJob: () => {
    return ipcRenderer.invoke('printer:cancel-job');
  },
  getAuditStats: (dateStr?: string) => {
    return ipcRenderer.invoke('printer:get-audit-stats', dateStr);
  },
  reprintJob: (sessionId: string, reason: string, copies = 1, printerName?: string) => {
    return ipcRenderer.invoke('printer:reprint-job', sessionId, reason, copies, printerName);
  },
  onPrinterEvent: (event: string, callback: (...args: any[]) => void) => {
    const validEvents = [
      'printer:event:queue-updated',
      'printer:event:job-started',
      'printer:event:job-progress',
      'printer:event:sheet-printed',
      'printer:event:queue-paused',
      'printer:event:queue-resumed',
      'printer:event:job-completed',
      'printer:event:job-cancelled',
    ];
    if (validEvents.includes(event)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(event, subscription);
      return () => {
        ipcRenderer.removeListener(event, subscription);
      };
    }
    return () => {};
  },
};

// Expose context safely into window object with contextIsolation: true
contextBridge.exposeInMainWorld('electronKiosk', kioskBridge);
contextBridge.exposeInMainWorld('electronPrinter', printerBridge);
