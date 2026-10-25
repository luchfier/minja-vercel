// electron/main.ts
// Electron Main Process — Desktop Kiosk Wrapper MinjaPhotobooth
// Sesuai ARCHITECTURE.md §4.2, §5.2 & THE_NEXT_STEP.md §5

import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Menu,
  shell,
  session,
} from 'electron';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { PrintEngine } from './print-engine';

// Auto-grant media stream access (camera/mic) and bypass interactive permission bubble in kiosk
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
const isKioskMode = process.env.KIOSK_MODE === 'true' || (!isDev && process.env.WINDOWED !== 'true');
const FRONTEND_DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3000/api/system/health';

let mainWindow: BrowserWindow | null = null;

// Single Instance Lock — Mencegah multiple instance berjalan bersamaan di Kiosk
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Memeriksa kesiapan Fastify Backend
 */
function checkBackendHealth(retries = 10, delayMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http
        .get(BACKEND_URL, (res) => {
          if (res.statusCode === 200) {
            console.log('✅ [Electron] Fastify Backend terhubung dan sehat.');
            resolve(true);
          } else if (attempts < retries) {
            setTimeout(check, delayMs);
          } else {
            resolve(false);
          }
        })
        .on('error', () => {
          if (attempts < retries) {
            setTimeout(check, delayMs);
          } else {
            console.warn('⚠️ [Electron] Fastify Backend belum merespons, melanjutkan dengan fallback.');
            resolve(false);
          }
        });
    };
    check();
  });
}

/**
 * Inisialisasi Kiosk Window Utama
 */
async function createMainWindow(): Promise<void> {
  // Sembunyikan default menu bar Windows
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    fullscreen: isKioskMode,
    kiosk: isKioskMode,
    frame: !isKioskMode,
    alwaysOnTop: isKioskMode,
    autoHideMenuBar: true,
    backgroundColor: '#070B14',
    show: false, // Tunggu hingga konten siap agar tidak flickering putih
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Tampilkan window saat DOM selesai dimuat
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      if (isKioskMode) {
        mainWindow.setKiosk(true);
        mainWindow.setFullScreen(true);
      }
    }
  });

  // Kiosk Security: Blokir navigasi eksternal yang tidak sah
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== 'http://localhost:5173' && parsed.protocol !== 'file:') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Kiosk Security: Cegah popup window baru
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Kiosk Security: Disable DevTools di mode produksi
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  // Load URL
  if (isDev) {
    let loaded = false;
    let attempts = 0;
    while (!loaded && attempts < 30) {
      attempts++;
      try {
        await mainWindow.loadURL(FRONTEND_DEV_URL);
        loaded = true;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!loaded) {
      console.warn('[Electron] Gagal memuat Vite dev server setelah 30 percobaan.');
    }
  } else {
    // Mode produksi: load dari build frontend
    const prodPath = path.resolve(__dirname, '../frontend/dist/index.html');
    await mainWindow.loadFile(prodPath);
  }
}

/**
 * Registrasi Shortcut Darurat untuk Operator / Admin Booth
 */
function registerAdminShortcuts(): void {
  // Shortcut darurat keluar Kiosk: Ctrl+Shift+Q
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    console.log('[Electron] Emergency exit trigger.');
    app.quit();
  });

  // Shortcut toggle fullscreen / windowed mode: Ctrl+Shift+F (berguna untuk maintenance)
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (mainWindow) {
      const isCurrentKiosk = mainWindow.isKiosk();
      mainWindow.setKiosk(!isCurrentKiosk);
      mainWindow.setFullScreen(!isCurrentKiosk);
      console.log(`[Electron] Kiosk mode toggled: ${!isCurrentKiosk}`);
    }
  });
}

/**
 * Registrasi IPC Handlers
 */
function registerIpcHandlers(): void {
  // IPC: Keluar dari aplikasi (Membutuhkan verifikasi PIN admin aktif)
  ipcMain.handle('kiosk:exit', async (_event, pin?: string) => {
    if (!pin || pin.trim().length === 0) {
      return { success: false, message: 'PIN admin wajib dimasukkan.' };
    }

    // 1. Coba verifikasi ke backend Fastify via HTTP POST /api/admin/login
    try {
      const authRes = await new Promise<{ ok: boolean; status: number }>((resolve) => {
        const req = http.request(
          'http://localhost:3000/api/admin/login',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 2500,
          },
          (res) => {
            resolve({ ok: res.statusCode === 200, status: res.statusCode || 500 });
          }
        );
        req.on('error', () => resolve({ ok: false, status: 0 }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ ok: false, status: 0 });
        });
        req.write(JSON.stringify({ pin }));
        req.end();
      });

      if (authRes.ok) {
        setTimeout(() => app.quit(), 300);
        return { success: true, message: 'PIN admin terverifikasi. Kiosk ditutup.' };
      }

      if (authRes.status > 0) {
        return { success: false, message: 'PIN admin tidak valid atau akses sedang terkunci.' };
      }
    } catch {
      // Backend Fastify offline
    }

    // 2. Fallback offline darurat jika backend tidak dapat dihubungi
    if (pin === '123456') {
      setTimeout(() => app.quit(), 300);
      return { success: true, message: 'Kiosk ditutup via PIN darurat offline.' };
    }

    return { success: false, message: 'PIN admin tidak valid.' };
  });

  // IPC: Toggle fullscreen
  ipcMain.handle('kiosk:toggle-fullscreen', async () => {
    if (mainWindow) {
      const current = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!current);
      mainWindow.setKiosk(!current);
      return !current;
    }
    return false;
  });

  // IPC: Diagnostik sistem hardware & memori
  ipcMain.handle('kiosk:get-system-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      osVersion: `${os.type()} ${os.release()}`,
      memory: {
        totalMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMB: Math.round(os.freemem() / 1024 / 1024),
      },
      kioskMode: mainWindow ? mainWindow.isKiosk() : isKioskMode,
    };
  });
}

/**
 * Watchdog pemantau kesehatan memori Kiosk
 * Mencegah Chromium Renderer out-of-memory pada operasional 24/7
 */
function startMemoryWatchdog(): void {
  setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const memoryInfo = await process.getProcessMemoryInfo();
      const rssMB = Math.round(memoryInfo.residentSet / 1024);
      if (rssMB > 1200) {
        console.warn(`[Watchdog] Pemakaian RAM tinggi (${rssMB} MB). Memeriksa status idle untuk reload aman.`);
        mainWindow.webContents.executeJavaScript('window.location.hash || window.location.pathname').then((path) => {
          if (!path || path === '/' || path.includes('welcome')) {
            console.log('[Watchdog] Melakukan auto-refresh di attract screen untuk membebaskan memori.');
            mainWindow?.reload();
          }
        }).catch(() => {});
      }
    } catch {
      // Abaikan error watchdog
    }
  }, 5 * 60 * 1000);
}

// App Lifecycle
app.whenReady().then(async () => {
  // Otomatis izinkan seluruh akses hardware (kamera, mikrofon, media) untuk antarmuka Kiosk mandiri
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details: any) => {
    const allowed = ['media', 'camera', 'microphone', 'fullscreen', 'pointerLock', 'notifications'];
    if (
      allowed.includes(permission) ||
      (details && details.mediaTypes && (details.mediaTypes.includes('video') || details.mediaTypes.includes('audio')))
    ) {
      return callback(true);
    }
    return callback(true); // Standalone kiosk selalu izinkan akses
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return true; // Standalone kiosk selalu izinkan akses camera/media
  });

  registerIpcHandlers();
  registerAdminShortcuts();
  startMemoryWatchdog();

  // Inisialisasi Dedicated Windows Print Engine
  const printEngine = PrintEngine.getInstance();
  printEngine.registerIpcHandlers();

  // Tunggu Fastify backend siap sebentar (tidak blocking jika offline)
  checkBackendHealth(5, 1000).catch(() => {});

  await createMainWindow();

  if (mainWindow) {
    printEngine.attachWindow(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
