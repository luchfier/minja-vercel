import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Printer,
  RefreshCw,
  CheckCircle2,
  Play,
  Square,
  Sparkles,
  FileCheck,
  Send,
  Zap,
  SlidersHorizontal,
  Save,
  Ruler,
  Layers,
  SunMedium,
  Maximize2,
  AlertTriangle,
  RotateCcw,
  History,
  Activity,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { cameraAdapter } from '../../adapters/cameraAdapter';
import { printerAdapter } from '../../adapters/printerAdapter';
import {
  CameraDeviceInfo,
  PrinterInfo,
  PrinterCustomConfig,
  DetailedHardwareStatus,
  PrintEngineAuditData,
  PrintQueueStatusData,
} from '../../types/hardware';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';

export const PAPER_PRESETS = [
  { id: '4R', label: 'Standar Studio (10×15 cm)', desc: '10 × 15 cm (Ukuran Foto Standar Studio)', widthMm: 100, heightMm: 150 },
  { id: '2x6', label: 'Photo Strip (5×15 cm)', desc: '5 × 15 cm (Auto Cut Strip)', widthMm: 50, heightMm: 150 },
  { id: '5R', label: '5R Medium (13×18 cm)', desc: '13 × 18 cm', widthMm: 130, heightMm: 180 },
  { id: '6R', label: '6R Large (15×20 cm)', desc: '15 × 20 cm', widthMm: 150, heightMm: 200 },
  { id: 'Square', label: 'Square (10×10 cm)', desc: '10 × 10 cm Persegi', widthMm: 100, heightMm: 100 },
  { id: 'A4', label: 'A4 Sheet (21×29.7 cm)', desc: '21 × 29.7 cm Dokumen', widthMm: 210, heightMm: 297 },
  { id: 'CUSTOM', label: '➕ Ukuran Custom (cm)', desc: 'Input Dimensi Bebas (cm)', widthMm: 100, heightMm: 150 },
];

export const HardwareSettingsPage: React.FC = () => {
  const { showToast } = useToast();

  // Hardware states
  const [cameras, setCameras] = useState<CameraDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Printer Customization State
  const [printerConfig, setPrinterConfig] = useState<PrinterCustomConfig>({
    printerName: '',
    displayName: '',
    paperSize: '4R',
    isDefault: true,
    isActive: true,
    settings: {
      borderless: true,
      orientation: 'portrait',
      marginTopMm: 0,
      marginBottomMm: 0,
      marginLeftMm: 0,
      marginRightMm: 0,
      colorMode: 'color',
      autoCut: true,
      dpi: 300,
      customPaperName: 'Standar Studio (10×15 cm)',
      customPaperWidthMm: 100,
      customPaperHeightMm: 150,
      printQuality: 'photo_fine',
      mediaType: 'glossy',
      sharpening: 'medium',
      brightnessOffset: 0,
      contrastOffset: 0,
    },
  });
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [isManualPrinterMode, setIsManualPrinterMode] = useState(false);
  const [manualPrinterInput, setManualPrinterInput] = useState('');

  // Live View Testing
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiveViewActive, setIsLiveViewActive] = useState(false);
  const [testCapturedUrl, setTestCapturedUrl] = useState<string | null>(null);

  // Test Print & Reprint
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [reprintSessionCode, setReprintSessionCode] = useState('');
  const [reprintReason, setReprintReason] = useState('');
  const [reprintCopies, setReprintCopies] = useState(1);
  const [isSubmittingReprint, setIsSubmittingReprint] = useState(false);

  // Real-Time Printer Telemetry & Queue States
  const [hardwareStatus, setHardwareStatus] = useState<DetailedHardwareStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<PrintQueueStatusData | null>(null);
  const [auditData, setAuditData] = useState<PrintEngineAuditData | null>(null);
  const [isResumingQueue, setIsResumingQueue] = useState(false);
  const [isCancelingJob, setIsCancelingJob] = useState(false);

  const getCategoryInfo = (category?: string) => {
    switch (category) {
      case 'inkjet':
        return {
          label: 'Inkjet Konvensional (Epson L-Series / Canon Pixma / HP)',
          shortLabel: 'Inkjet Foto',
          desc: 'Kertas lembaran 10×15 cm, dye/pigment ink tank',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'dyesub':
        return {
          label: 'Dye-Sublimation Studio (DNP DS-RX1 / Citizen / HiTi)',
          shortLabel: 'Dye-Sub Lab',
          desc: 'Roll dye-sub thermal, high-speed instant cut borderless',
          badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'selphy':
        return {
          label: 'Canon SELPHY CP-Series (CP1300 / CP1500)',
          shortLabel: 'Canon SELPHY',
          desc: 'Postcard cassette 10×15 cm, thermal transfer 4-pass',
          badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      case 'surelab':
        return {
          label: 'Dry Minilab Pro (Epson SureLab SL-D530 / D1030)',
          shortLabel: 'Epson SureLab',
          desc: 'Ultra fine studio roll & tray minilab printing',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      default:
        return {
          label: 'Windows Standard Spooler',
          shortLabel: 'Standard Spooler',
          desc: 'Spooler standar Windows OS',
          badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        };
    }
  };

  const getIssueDescription = (issue: string) => {
    switch (issue) {
      case 'paper_out':
        return {
          title: 'Kertas Habis (Paper Out)',
          desc: 'Baki kertas kosong. Masukkan kertas foto 10×15 cm lalu klik "Lanjutkan Antrean".',
        };
      case 'paper_jam':
        return {
          title: 'Kertas Macet (Paper Jam)',
          desc: 'Kertas tersangkut di jalur roller. Buka baki, tarik perlahan kertas yang tersangkut.',
        };
      case 'door_open':
        return {
          title: 'Penutup Terbuka (Door/Cover Open)',
          desc: 'Penutup cover printer terbuka. Tutup cover printer hingga terdengar bunyi klik.',
        };
      case 'toner_or_ribbon_out':
        return {
          title: 'Tinta / Ribbon Habis',
          desc: 'Cartridge tinta atau pita ribbon dye-sub habis. Ganti ribbon/tinta baru.',
        };
      case 'offline':
        return {
          title: 'Kabel USB Terputus / Printer Offline',
          desc: 'Printer tidak merespons di port USB Windows. Periksa kabel USB dan daya listrik.',
        };
      default:
        return {
          title: issue,
          desc: 'Pemeriksaan status hardware printer Windows.',
        };
    }
  };

  const loadTelemetry = async (targetPrinterName?: string) => {
    const target = targetPrinterName || (isManualPrinterMode ? manualPrinterInput : printerConfig.printerName);
    try {
      const [hw, q, audit] = await Promise.all([
        target ? printerAdapter.getHardwareStatus(target) : Promise.resolve(null),
        printerAdapter.getQueue(),
        printerAdapter.getAuditStats(),
      ]);
      setHardwareStatus(hw);
      setQueueStatus(q);
      setAuditData(audit);
    } catch (err) {
      console.warn('Gagal memuat telemetri printer:', err);
    }
  };

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const [camList, printList, activeCfg] = await Promise.all([
        cameraAdapter.listDevices(),
        printerAdapter.listPrinters(),
        printerAdapter.getActiveConfig(),
      ]);
      setCameras(camList);
      setPrinters(printList);
      if (activeCfg) {
        setPrinterConfig(activeCfg);
        if (!printList.some((p) => p.name === activeCfg.printerName)) {
          setIsManualPrinterMode(true);
          setManualPrinterInput(activeCfg.printerName);
        }
      }
      await loadTelemetry(activeCfg?.printerName);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();

    // Auto-poll telemetry every 4 seconds for live hardware checks
    const interval = setInterval(() => {
      loadTelemetry();
    }, 4000);

    // Event-driven real-time updates from PrintEngine
    const unsubs = [
      printerAdapter.onPrinterEvent('printer:event:queue-paused', () => loadTelemetry()),
      printerAdapter.onPrinterEvent('printer:event:queue-resumed', () => loadTelemetry()),
      printerAdapter.onPrinterEvent('printer:event:sheet-printed', () => loadTelemetry()),
      printerAdapter.onPrinterEvent('printer:event:job-completed', () => loadTelemetry()),
      printerAdapter.onPrinterEvent('printer:event:job-failed', () => loadTelemetry()),
    ];

    return () => {
      cameraAdapter.stopLiveView();
      clearInterval(interval);
      unsubs.forEach((u) => u && u());
    };
  }, [printerConfig.printerName, isManualPrinterMode, manualPrinterInput]);

  const handleResumeQueue = async () => {
    setIsResumingQueue(true);
    try {
      const ok = await printerAdapter.manualResume();
      if (ok) {
        showToast({
          type: 'success',
          title: 'Antrean Dilanjutkan',
          message: 'Pencetakan lembar foto berhasil dilanjutkan ke printer.',
        });
        await loadTelemetry();
      } else {
        showToast({
          type: 'error',
          title: 'Belum Siap Melanjutkan',
          message: 'Printer masih melaporkan kendala hardware atau offline. Pastikan kertas sudah terisi.',
        });
      }
    } finally {
      setIsResumingQueue(false);
    }
  };

  const handleCancelJob = async () => {
    setIsCancelingJob(true);
    try {
      const ok = await printerAdapter.cancelJob();
      if (ok) {
        showToast({
          type: 'info',
          title: 'Job Dibatalkan',
          message: 'Pekerjaan cetak yang bermasalah berhasil dibatalkan dari antrean spooler.',
        });
        await loadTelemetry();
      }
    } finally {
      setIsCancelingJob(false);
    }
  };

  const handleSetPrimaryCamera = async (camId: string) => {
    cameraAdapter.setPreferredDeviceId(camId);
    setCameras((prev) =>
      prev.map((c) => ({
        ...c,
        isDefault: c.id === camId,
      }))
    );
    showToast({
      type: 'success',
      title: 'Kamera Utama Ditetapkan',
      message: 'Perangkat terpilih akan selalu digunakan sebagai kamera utama Kiosk.',
    });
    if (isLiveViewActive && videoRef.current) {
      await cameraAdapter.startLiveView(videoRef.current, camId);
    }
  };

  const handleToggleLiveView = async () => {
    if (isLiveViewActive) {
      cameraAdapter.stopLiveView();
      setIsLiveViewActive(false);
    } else {
      if (videoRef.current) {
        const activeDev = cameras.find((c) => c.isDefault) || cameras[0];
        const success = await cameraAdapter.startLiveView(videoRef.current, activeDev?.id);
        if (success) {
          setIsLiveViewActive(true);
          showToast({
            type: 'success',
            title: 'Live View Kamera Aktif',
            message: `Stream video viewfinder ${activeDev?.name || 'Kamera'} berhasil dibuka.`,
          });
        } else {
          showToast({
            type: 'error',
            title: 'Gagal Membuka Live View',
            message: 'Perangkat kamera tidak memberikan video feed.',
          });
        }
      }
    }
  };

  const handleSetPrimaryPrinter = async (printerName: string) => {
    const matched = printers.find((p) => p.name === printerName);
    const updated: PrinterCustomConfig = {
      ...printerConfig,
      printerName,
      displayName: matched?.displayName || printerName,
      paperSize: matched?.paperSize || printerConfig.paperSize || '4R',
      isDefault: true,
      settings: {
        ...printerConfig.settings,
        ...(matched?.settings || {}),
      },
    };

    setPrinterConfig(updated);
    setIsManualPrinterMode(false);
    setPrinters((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.name === printerName,
      }))
    );

    await printerAdapter.saveConfig(updated);
    showToast({
      type: 'success',
      title: 'Printer Utama Ditetapkan',
      message: `Printer '${printerName}' dipilih sebagai printer cetak utama Kiosk.`,
    });
  };

  const handleSavePrinterCustomization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const targetName = isManualPrinterMode ? manualPrinterInput.trim() : printerConfig.printerName.trim();
    if (!targetName) {
      showToast({
        type: 'error',
        title: 'Nama Printer Wajib Diisi',
        message: 'Silakan pilih atau masukkan nama printer yang akan digunakan.',
      });
      return;
    }

    setIsSavingPrinter(true);
    try {
      const payload: PrinterCustomConfig = {
        ...printerConfig,
        printerName: targetName,
        displayName: printerConfig.displayName?.trim() || targetName,
        isDefault: true,
      };

      const saved = await printerAdapter.saveConfig(payload);
      setPrinterConfig(saved);
      setPrinters((prev) => {
        const exists = prev.some((p) => p.name === saved.printerName);
        if (!exists) {
          return [
            {
              id: `cfg-${Date.now()}`,
              name: saved.printerName,
              displayName: saved.displayName,
              isDefault: true,
              status: 'connected',
              paperSize: saved.paperSize,
              settings: saved.settings,
              supportedSizes: ['10×15 cm (Standar)', '5×15 cm Photo Strip', 'Custom cm'],
            },
            ...prev.map((p) => ({ ...p, isDefault: false })),
          ];
        }
        return prev.map((p) => ({
          ...p,
          isDefault: p.name === saved.printerName,
          displayName: p.name === saved.printerName ? saved.displayName : p.displayName,
          paperSize: p.name === saved.printerName ? saved.paperSize : p.paperSize,
          settings: p.name === saved.printerName ? saved.settings : p.settings,
        }));
      });

      showToast({
        type: 'success',
        title: 'Kustomisasi Printer Tersimpan',
        message: `Konfigurasi printer '${saved.displayName || saved.printerName}' berhasil disimpan ke sistem Kiosk.`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: 'Terjadi kendala saat menyimpan konfigurasi printer.',
      });
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleTestCapture = async () => {
    try {
      const photoUrl = await cameraAdapter.capturePhoto(true);
      setTestCapturedUrl(photoUrl);
      showToast({
        type: 'success',
        title: 'Shutter Test Sukses',
        message: 'Foto uji coba berhasil diambil dari sensor kamera.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Shutter Error',
        message: 'Gagal mengambil foto dari kamera.',
      });
    }
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      const activePrinter = isManualPrinterMode ? manualPrinterInput.trim() : printerConfig.printerName;
      const res = await printerAdapter.testPrint(activePrinter);
      showToast({
        type: 'success',
        title: 'Test Print Terkirim',
        message: res.message || 'Halaman kalibrasi warna & margin borderless berhasil diproses.',
      });
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleReprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reprintSessionCode.trim() || !reprintReason.trim()) {
      showToast({
        type: 'error',
        title: 'Formulir Belum Lengkap',
        message: 'Kode sesi dan alasan audit reprint wajib diisi.',
      });
      return;
    }

    setIsSubmittingReprint(true);
    try {
      const res = await printerAdapter.reprintJob(reprintSessionCode, reprintReason, reprintCopies);
      showToast({
        type: 'success',
        title: 'Reprint Berhasil Disubmit',
        message: res.message || 'Pekerjaan cetak ulang berhasil dikirim.',
      });
      setIsReprintModalOpen(false);
    } finally {
      setIsSubmittingReprint(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Diagnostik Hardware & Kalibrasi Cetak Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoring kamera terhubung, spooler printer Windows, live view stream, dan fasilitas reprint audit.
          </p>
        </div>

        <button
          onClick={loadDevices}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          <span>Deteksi Ulang Perangkat</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Section (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Adapter Kamera Studio</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {cameras.length} Perangkat Terdeteksi
              </span>
            </div>

            {/* Camera Devices List */}
            <div className="space-y-2">
              {cameras.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                  Tidak ada perangkat kamera yang terdeteksi. Hubungkan webcam USB atau capture card kamera ke komputer.
                </div>
              ) : (
                cameras.map((cam) => (
                  <div
                    key={cam.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
                  >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{cam.name}</span>
                        {cam.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                            Utama
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cam.resolution || '1920x1080'} • Tipe: {cam.type.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!cam.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryCamera(cam.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 hover:border-amber-400/40 active:scale-95 text-slate-300 border border-white/10 transition-all cursor-pointer"
                      >
                        Pilih
                      </button>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cam.status === 'connected'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : cam.status === 'demo'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {cam.status === 'demo' ? 'STANDBY' : cam.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))) }
            </div>

            {/* Live View Testing Screen */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Uji Live View & Shutter</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleLiveView}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isLiveViewActive
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isLiveViewActive ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Hentikan Stream</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Buka Live View</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleTestCapture}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white text-xs font-semibold border border-white/15 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Shutter</span>
                  </button>
                </div>
              </div>

              {/* Viewport Box */}
              <div className="w-full aspect-video bg-slate-950 rounded-xl border border-white/10 overflow-hidden relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isLiveViewActive ? 'block' : 'hidden'}`}
                />

                {!isLiveViewActive && (
                  <div className="text-center p-4">
                    <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Live view standby</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Klik "Buka Live View" untuk menguji streaming kamera langsung.
                    </p>
                  </div>
                )}

                {/* Shutter test thumbnail overlay */}
                {testCapturedUrl && (
                  <div className="absolute bottom-2 right-2 p-1 bg-slate-950/80 rounded-lg border border-white/20">
                    <img
                      src={testCapturedUrl}
                      alt="Captured Test"
                      className="w-16 h-12 object-cover rounded"
                    />
                    <span className="block text-[8px] text-center text-emerald-400 font-mono mt-0.5">
                      OK
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Printer Section (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Printer Foto (Windows Spooler)</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {printers.length} Printer Terdeteksi
              </span>
            </div>

            {/* Printer Devices List */}
            <div className="space-y-2">
              {printers.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                  Tidak ada printer yang terdeteksi di Windows. Pastikan kabel printer terhubung ke komputer.
                </div>
              ) : (
                printers.map((ptr) => (
                  <div
                    key={ptr.id}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{ptr.name}</span>
                          {ptr.isDefault && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                              Utama
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {ptr.status === 'connected' ? 'Siap Digunakan (Online)' : 'Offline / Tidak Terhubung'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!ptr.isDefault && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetPrimaryPrinter(ptr.name);
                            loadTelemetry(ptr.name);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-sky-400/20 hover:text-sky-300 hover:border-sky-400/40 active:scale-95 text-slate-300 border border-white/10 transition-all cursor-pointer"
                        >
                          Pilih
                        </button>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ptr.status === 'connected'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {ptr.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Live Hardware Telemetry & Real-Time Sensor Health Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Telemetri Hardware & Sensor Real-Time</h4>
                    <p className="text-[10px] text-slate-400">
                      Monitoring status port USB, driver Windows, dan antrean spooler aktif.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadTelemetry()}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    title="Segarkan Telemetri"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 3 Telemetry Metric Badges */}
              {(() => {
                const selectedPrinter = printers.find((p) => p.name === printerConfig.printerName) || printers.find((p) => p.isDefault) || printers[0];
                const isOnline = hardwareStatus?.isOnline ?? (selectedPrinter?.status === 'connected');
                const hasIssues = Boolean(hardwareStatus && hardwareStatus.hardwareIssue && hardwareStatus.hardwareIssue !== 'none');
                const issueKey = hardwareStatus?.hardwareIssue || 'none';
                const queueCount = hardwareStatus?.spoolerQueueCount ?? queueStatus?.pendingCount ?? 0;
                const category = selectedPrinter?.category || hardwareStatus?.category || 'standard';
                const port = selectedPrinter?.portName || hardwareStatus?.portName || 'USB';
                const catInfo = getCategoryInfo(category);

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. Connection State */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400">Status Port USB / Spooler:</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline && !hasIssues
                                ? 'bg-emerald-400'
                                : hasIssues
                                ? 'bg-amber-400 animate-ping'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={`text-xs font-bold font-mono ${
                              isOnline && !hasIssues
                                ? 'text-emerald-300'
                                : hasIssues
                                ? 'text-amber-300'
                                : 'text-rose-400'
                            }`}
                          >
                            {isOnline
                              ? hasIssues
                                ? 'PERLU ATENSI'
                                : 'ONLINE (READY)'
                              : 'OFFLINE / DISCONNECTED'}
                          </span>
                        </div>
                      </div>

                      {/* 2. Spooler Queue Count */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400">Antrean Windows Spooler:</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold font-mono text-white">
                            {queueCount} Job
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {queueStatus?.isPaused ? 'Dijeda' : 'Normal'}
                          </span>
                        </div>
                      </div>

                      {/* 3. Printer Category */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/10 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-400">Tipe / Kategori Driver:</span>
                        <div className="mt-1">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${catInfo.badgeClass}`}>
                            {catInfo.shortLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hardware Sensors Alert Banner (Requirement 6: Deep Sensor Detection if Supported) */}
                    {hasIssues ? (
                      <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs space-y-1.5 animate-pulse">
                        <div className="flex items-center gap-2 font-bold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>Perhatian: Sensor Hardware Melaporkan Kendala</span>
                        </div>
                        <div className="text-[11px] text-slate-200 pl-6">
                          <strong className="text-amber-200">{getIssueDescription(issueKey).title}:</strong>{' '}
                          {hardwareStatus?.issueDescription || getIssueDescription(issueKey).desc}
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sensor hardware siap. Tidak ada kertas macet atau penutup terbuka terdeteksi.</span>
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">
                          Port: {port}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Queue Failure Recovery Control Panel (Requirement 3a: Paper Out Recovery) */}
              {queueStatus?.isPaused && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-rose-200">
                        Antrean Cetak Sedang Dijeda (Recovery Mode)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      PAUSED
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-200 leading-relaxed">
                    {queueStatus.currentJob?.errorMessage || 'Kertas habis saat proses cetak berlangsung.'}
                    {' '}Setelah kertas foto 10×15 cm diisi ke baki printer, sistem akan otomatis melanjutkan atau Anda dapat mengklik tombol di bawah.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResumeQueue}
                      disabled={isResumingQueue}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>{isResumingQueue ? 'Mengecek...' : 'Lanjutkan Antrean (Resume)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelJob}
                      disabled={isCancelingJob}
                      className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      <span>{isCancelingJob ? 'Membatalkan...' : 'Batalkan Job Ini'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Printer Customization Form */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Kustomisasi Bebas Printer Kiosk</h4>
                    <p className="text-[10px] text-slate-400">
                      Bebas tentukan printer utama, ukuran kertas, borderless, dan kalibrasi margin.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {printerConfig.printerName}
                </span>
              </div>

              <form onSubmit={handleSavePrinterCustomization} className="space-y-3">
                {/* 1. Target Printer Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Printer Target yang Digunakan:
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={isManualPrinterMode ? '__manual__' : printerConfig.printerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__manual__') {
                          setIsManualPrinterMode(true);
                        } else {
                          setIsManualPrinterMode(false);
                          handleSetPrimaryPrinter(val);
                        }
                      }}
                      className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400 transition-all"
                    >
                      {printers.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.isDefault ? '★ (Aktif)' : ''}
                        </option>
                      ))}
                      <option value="__manual__">➕ Ketik Nama Printer Manual / Jaringan...</option>
                    </select>

                    {isManualPrinterMode && (
                      <input
                        type="text"
                        value={manualPrinterInput}
                        onChange={(e) => setManualPrinterInput(e.target.value)}
                        placeholder="Contoh: \\SERVER\PRINTER_FOTO atau Epson_L805"
                        className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-sky-400/50 text-xs text-amber-300 font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Display Name / Alias */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nama Tampilan / Alias di Kiosk:
                  </label>
                  <input
                    type="text"
                    value={printerConfig.displayName || ''}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="Contoh: Printer Foto Utama (Studio)"
                    className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400 transition-all"
                  />
                </div>

                {/* 3. Paper Size Presets Grid */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-sky-400" />
                      <span>Preset Ukuran Kertas Cetak:</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Aktif: <strong className="text-sky-300">{printerConfig.paperSize}</strong> ({((printerConfig.settings.customPaperWidthMm || 100) / 10).toFixed(1)} × {((printerConfig.settings.customPaperHeightMm || 150) / 10).toFixed(1)} cm)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PAPER_PRESETS.map((opt) => {
                      const isSelected = printerConfig.paperSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (opt.id === 'CUSTOM') {
                              setPrinterConfig((prev) => ({
                                ...prev,
                                paperSize: 'CUSTOM',
                                settings: {
                                  ...prev.settings,
                                  customPaperName: prev.settings.customPaperName || 'Kertas Custom',
                                  customPaperWidthMm: prev.settings.customPaperWidthMm || 100,
                                  customPaperHeightMm: prev.settings.customPaperHeightMm || 150,
                                },
                              }));
                            } else {
                              setPrinterConfig((prev) => ({
                                ...prev,
                                paperSize: opt.id,
                                settings: {
                                  ...prev.settings,
                                  customPaperName: opt.label,
                                  customPaperWidthMm: opt.widthMm,
                                  customPaperHeightMm: opt.heightMm,
                                },
                              }));
                            }
                          }}
                          className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm'
                              : 'bg-white/[0.02] text-slate-400 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <span className="block text-xs font-bold text-white">{opt.label}</span>
                          <span className="block text-[9px] text-slate-400 leading-tight mt-0.5">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3b. Custom Paper Dimensions Panel (Always accessible or expanded when CUSTOM selected) */}
                {(printerConfig.paperSize === 'CUSTOM' || printerConfig.settings.customPaperWidthMm) && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                      <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Kustomisasi Dimensi Kertas (Centimeter / cm)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(printerConfig.settings.customPaperWidthMm || 100) > (printerConfig.settings.customPaperHeightMm || 150)
                          ? 'Landscape Canvas'
                          : 'Portrait Canvas'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Nama Label Preset:
                        </label>
                        <input
                          type="text"
                          value={printerConfig.settings.customPaperName || ''}
                          onChange={(e) =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, customPaperName: e.target.value },
                            }))
                          }
                          placeholder="Misal: Mini Polaroid 10×10 cm"
                          className="w-full h-8 px-2.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Lebar Kertas (Width cm):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="3"
                            max="35"
                            step="0.1"
                            value={Number(((printerConfig.settings.customPaperWidthMm || 100) / 10).toFixed(1))}
                            onChange={(e) => {
                              const cmVal = Math.max(3, Math.min(35, parseFloat(e.target.value) || 10));
                              setPrinterConfig((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, customPaperWidthMm: Math.round(cmVal * 10) },
                              }));
                            }}
                            className="w-full h-8 px-2.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white font-mono text-center"
                          />
                          <span className="text-slate-400 text-[10px]">cm</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Tinggi Kertas (Height cm):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="3"
                            max="45"
                            step="0.1"
                            value={Number(((printerConfig.settings.customPaperHeightMm || 150) / 10).toFixed(1))}
                            onChange={(e) => {
                              const cmVal = Math.max(3, Math.min(45, parseFloat(e.target.value) || 15));
                              setPrinterConfig((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, customPaperHeightMm: Math.round(cmVal * 10) },
                              }));
                            }}
                            className="w-full h-8 px-2.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white font-mono text-center"
                          />
                          <span className="text-slate-400 text-[10px]">cm</span>
                        </div>
                      </div>
                    </div>

                    {/* Live Calculated Resolution & Proportional Aspect Box */}
                    {(() => {
                      const curDpi = printerConfig.settings.dpi || 300;
                      const wMm = printerConfig.settings.customPaperWidthMm || 102;
                      const hMm = printerConfig.settings.customPaperHeightMm || 152;
                      const wPx = Math.round((wMm / 25.4) * curDpi);
                      const hPx = Math.round((hMm / 25.4) * curDpi);
                      const ratio = (wMm / hMm).toFixed(2);
                      return (
                        <div className="p-2 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="block text-[10px] text-slate-400">
                              Kalkulasi Resolusi Kanvas Cetak:
                            </span>
                            <span className="font-mono font-bold text-amber-300">
                              {wPx} × {hPx} px <span className="text-slate-400 text-[10px]">(@ {curDpi} DPI)</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300">
                              Rasio {ratio}:1
                            </span>
                            {/* Proportional preview thumbnail box */}
                            <div
                              style={{
                                width: wMm >= hMm ? '32px' : `${Math.round((wMm / hMm) * 32)}px`,
                                height: hMm >= wMm ? '32px' : `${Math.round((hMm / wMm) * 32)}px`,
                              }}
                              className="border border-sky-400/60 bg-sky-500/10 rounded-xs flex items-center justify-center text-[7px] text-sky-300"
                              title="Proporsi Kertas"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 4. Print Quality & Resolution (DPI) Section */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Resolusi Output & Kualitas Cetak:</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {printerConfig.settings.dpi || 300} DPI • {printerConfig.settings.printQuality || 'photo_fine'}
                    </span>
                  </div>

                  {/* DPI Selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { dpi: 300, label: '300 DPI', desc: 'Standar Foto Lab' },
                      { dpi: 600, label: '600 DPI', desc: 'Ultra Fine Studio' },
                      { dpi: 1200, label: '1200 DPI', desc: 'Master Pro Lab' },
                    ].map((d) => (
                      <button
                        key={d.dpi}
                        type="button"
                        onClick={() =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, dpi: d.dpi },
                          }))
                        }
                        className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                          (printerConfig.settings.dpi || 300) === d.dpi
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm'
                            : 'bg-white/[0.02] text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="block text-xs font-bold text-white">{d.label}</span>
                        <span className="block text-[9px] text-slate-400">{d.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quality Profile & Media Type Finishing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Profil Rendering Kualitas:
                      </label>
                      <select
                        value={printerConfig.settings.printQuality || 'photo_fine'}
                        onChange={(e) =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, printQuality: e.target.value as any },
                          }))
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="standard">Standard Fast (Cepat)</option>
                        <option value="high">High Definition (HD)</option>
                        <option value="photo_fine">Photo Fine Lab (Rekomendasi)</option>
                        <option value="ultra_glossy">Ultra Glossy Vivid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Jenis Kertas (Media Surface):
                      </label>
                      <select
                        value={printerConfig.settings.mediaType || 'glossy'}
                        onChange={(e) =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, mediaType: e.target.value as any },
                          }))
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="glossy">Kertas Glossy (Mengkilap)</option>
                        <option value="luster">Luster / Satin (Semi-Doff Elegan)</option>
                        <option value="matte">Matte (Doff Halus)</option>
                        <option value="plain">Kertas Biasa / Art Paper</option>
                      </select>
                    </div>
                  </div>

                  {/* Edge Sharpening Selector */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Penajaman Garis Foto (Edge Sharpening):
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: 'off', label: 'Off' },
                        { id: 'low', label: 'Lembut (+10%)' },
                        { id: 'medium', label: 'Normal (+20%)' },
                        { id: 'high', label: 'Tajam (+35%)' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, sharpening: s.id as any },
                            }))
                          }
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all text-center ${
                            (printerConfig.settings.sharpening || 'medium') === s.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                              : 'bg-white/[0.02] text-slate-400 border-white/10'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brightness & Contrast Offsets */}
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                        <SunMedium className="w-3 h-3 text-amber-400" />
                        <span>Koreksi Tone & Warna (Offset Bias):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, brightnessOffset: 0, contrastOffset: 0 },
                          }))
                        }
                        className="text-[9px] text-sky-400 hover:underline"
                      >
                        Reset 0%
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>Kecerahan (Brightness):</span>
                          <span className="font-mono text-white">
                            {(printerConfig.settings.brightnessOffset || 0) > 0 ? '+' : ''}
                            {printerConfig.settings.brightnessOffset || 0}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="1"
                          value={printerConfig.settings.brightnessOffset || 0}
                          onChange={(e) =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, brightnessOffset: parseInt(e.target.value) || 0 },
                            }))
                          }
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>Kontras (Contrast):</span>
                          <span className="font-mono text-white">
                            {(printerConfig.settings.contrastOffset || 0) > 0 ? '+' : ''}
                            {printerConfig.settings.contrastOffset || 0}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="1"
                          value={printerConfig.settings.contrastOffset || 0}
                          onChange={(e) =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, contrastOffset: parseInt(e.target.value) || 0 },
                            }))
                          }
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Borderless & Auto Cut Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Borderless Toggle */}
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-white">Cetak Borderless</span>
                      <span className="block text-[10px] text-slate-400">Full bleed tanpa margin putih</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPrinterConfig((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            borderless: !prev.settings.borderless,
                          },
                        }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 relative ${
                        printerConfig.settings.borderless ? 'bg-sky-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          printerConfig.settings.borderless ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto-Cut Toggle */}
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-white">Auto Cutter Pisau</span>
                      <span className="block text-[10px] text-slate-400">Potong otomatis kertas strip</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPrinterConfig((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            autoCut: !prev.settings.autoCut,
                          },
                        }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 relative ${
                        printerConfig.settings.autoCut ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          printerConfig.settings.autoCut ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 6. Orientation & Color Profile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Orientasi Kertas:
                    </label>
                    <div className="flex gap-1">
                      {[
                        { id: 'portrait', label: 'Tegak (Portrait)' },
                        { id: 'landscape', label: 'Mendatar' },
                        { id: 'auto', label: 'Auto' },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                orientation: o.id as any,
                              },
                            }))
                          }
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                            printerConfig.settings.orientation === o.id
                              ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                              : 'bg-white/[0.02] text-slate-400 border-white/10'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Profil Warna & Finishing:
                    </label>
                    <div className="flex gap-1">
                      {[
                        { id: 'color', label: 'Studio Alami' },
                        { id: 'vivid', label: 'Vivid' },
                        { id: 'grayscale', label: 'B&W' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setPrinterConfig((prev) => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                colorMode: c.id as any,
                              },
                            }))
                          }
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                            printerConfig.settings.colorMode === c.id
                              ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                              : 'bg-white/[0.02] text-slate-400 border-white/10'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 7. Calibration Margin Offsets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-300">
                      Kalibrasi Margin Presisi (Offset Geser cm):
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Atas: {((printerConfig.settings.marginTopMm || 0) / 10).toFixed(2)} cm • Kiri: {((printerConfig.settings.marginLeftMm || 0) / 10).toFixed(2)} cm
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/10 text-xs">
                      <span className="text-slate-400 text-[10px]">Geser Atas:</span>
                      <input
                        type="number"
                        min="-2"
                        max="2"
                        step="0.05"
                        value={Number(((printerConfig.settings.marginTopMm || 0) / 10).toFixed(2))}
                        onChange={(e) =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              marginTopMm: Math.round((parseFloat(e.target.value) || 0) * 10),
                            },
                          }))
                        }
                        className="w-16 h-7 px-2 rounded bg-slate-900 border border-white/20 text-white font-mono text-center text-xs"
                      />
                      <span className="text-slate-400 text-[10px]">cm</span>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/10 text-xs">
                      <span className="text-slate-400 text-[10px]">Geser Kiri:</span>
                      <input
                        type="number"
                        min="-2"
                        max="2"
                        step="0.05"
                        value={Number(((printerConfig.settings.marginLeftMm || 0) / 10).toFixed(2))}
                        onChange={(e) =>
                          setPrinterConfig((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              marginLeftMm: Math.round((parseFloat(e.target.value) || 0) * 10),
                            },
                          }))
                        }
                        className="w-16 h-7 px-2 rounded bg-slate-900 border border-white/20 text-white font-mono text-center text-xs"
                      />
                      <span className="text-slate-400 text-[10px]">cm</span>
                    </div>
                  </div>
                </div>

                {/* Submit Customization Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingPrinter}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingPrinter ? 'Menyimpan ke Sistem...' : 'Simpan Kustomisasi Printer'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Test Print Calibration Pattern */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Kalibrasi Warna & Margin Cetak</h4>
                  <p className="text-[11px] text-slate-400">
                    Cetak halaman tes pola RGB/CMYK dan batas borderless presisi ke printer terpilih.
                  </p>
                </div>

                <button
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isTestPrinting ? 'Mengirim ke Spooler...' : 'Test Print Kalibrasi'}</span>
                </button>
              </div>

              {/* Calibration Graphic Mockup Preview */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* RGB/CMYK strip visual */}
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <div className="w-4 h-3 bg-red-500 rounded-xs" />
                      <div className="w-4 h-3 bg-green-500 rounded-xs" />
                      <div className="w-4 h-3 bg-blue-500 rounded-xs" />
                      <div className="w-4 h-3 bg-cyan-400 rounded-xs" />
                      <div className="w-4 h-3 bg-fuchsia-500 rounded-xs" />
                      <div className="w-4 h-3 bg-yellow-400 rounded-xs" />
                    </div>
                    <div className="flex gap-1">
                      <div className="w-4 h-2 bg-white rounded-xs" />
                      <div className="w-4 h-2 bg-slate-400 rounded-xs" />
                      <div className="w-4 h-2 bg-slate-600 rounded-xs" />
                      <div className="w-4 h-2 bg-slate-800 rounded-xs" />
                      <div className="w-4 h-2 bg-slate-900 rounded-xs" />
                      <div className="w-4 h-2 bg-black rounded-xs" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Pola Uji sRGB & Grayscale 10-Step
                    </span>
                    <span className="block text-[10px] text-slate-400 font-mono">
                      Target: {printerConfig.displayName || printerConfig.printerName} • {printerConfig.paperSize} ({((printerConfig.settings.customPaperWidthMm || 100) / 10).toFixed(1)} × {((printerConfig.settings.customPaperHeightMm || 150) / 10).toFixed(1)} cm @ {printerConfig.settings.dpi || 300} DPI)
                    </span>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Reprint Special Tool (PRD 4.5) */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Fasilitas Reprint Khusus Admin</span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Cetak ulang foto sesi pelanggan akibat paper jam atau tinta bermasalah.
                </p>
              </div>

              <button
                onClick={() => setIsReprintModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-sm"
              >
                Buka Form Reprint
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* AUDIT & LOG CETAK HARIAN & SESSION RECOVERY TOOL (M9/M14) */}
      {/* ========================================================= */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Audit & Log Cetak Harian (Session Recovery & Counter)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Hari Ini: {auditData?.daily.date || new Date().toISOString().slice(0, 10)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Lacak jumlah lembar keluar per hari, deteksi reprint counter, dan pemulihan sesi cetak darurat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setReprintSessionCode('');
              setReprintReason('');
              setReprintCopies(1);
              setIsReprintModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Cetak Ulang Manual</span>
          </button>
        </div>

        {/* 4 Audit Statistics Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Total Prints */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Total Lembar Keluar:</span>
              <div className="text-xl font-black font-mono text-white mt-0.5">
                {auditData?.daily.totalPrints || 0} <span className="text-xs font-normal text-slate-400">lembar</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>

          {/* 2. Successful Prints */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Cetak Sukses:</span>
              <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                {auditData?.daily.successfulPrints || 0} <span className="text-xs font-normal text-slate-400">lembar</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* 3. Failed Prints */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Kendala / Gagal:</span>
              <div className="text-xl font-black font-mono text-rose-400 mt-0.5">
                {auditData?.daily.failedPrints || 0} <span className="text-xs font-normal text-slate-400">job</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          {/* 4. Reprint Counter */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Reprint Counter:</span>
              <div className="text-xl font-black font-mono text-amber-400 mt-0.5">
                {auditData?.daily.reprintCount || 0} <span className="text-xs font-normal text-slate-400">kali</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Breakdown per Printer if exists */}
        {auditData?.daily.printerBreakdown && Object.keys(auditData.daily.printerBreakdown).length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Distribusi per Printer:</span>
            {Object.entries(auditData.daily.printerBreakdown).map(([pName, count]) => (
              <span
                key={pName}
                className="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 font-mono border border-white/10"
              >
                {pName}: <strong className="text-amber-300">{count}</strong> lembar
              </span>
            ))}
          </div>
        )}

        {/* Recent Print Jobs & Quick Recovery Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300">
              Riwayat Transaksi Cetak Terkini & Fasilitas Pemulihan Sesi (Recovery)
            </h4>
            <span className="text-[10px] text-slate-500">
              Menampilkan {auditData?.recent.length || 0} aktivitas cetak terbaru
            </span>
          </div>

          {(!auditData?.recent || auditData.recent.length === 0) ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
              Belum ada riwayat cetak hari ini. Aktivitas cetak sesi dan lembar foto akan tercatat otomatis di sini.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden">
              {auditData.recent.slice(0, 8).map((rec) => {
                const timeStr = rec.timestamp
                  ? new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '-';
                return (
                  <div
                    key={rec.id}
                    className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          rec.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : rec.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {rec.isReprint ? (
                          <RotateCcw className="w-3.5 h-3.5" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">
                            {rec.sessionId}
                          </span>
                          {rec.isReprint && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              REPRINT
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              rec.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : rec.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {rec.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{timeStr}</span>
                          <span>•</span>
                          <span>Target: {rec.printerName}</span>
                          <span>•</span>
                          <span>
                            {rec.completedCopies ?? rec.copies}/{rec.copies} Lembar
                          </span>
                          {rec.reprintReason && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300/80 italic">Alasan: {rec.reprintReason}</span>
                            </>
                          )}
                          {rec.errorMessage && (
                            <>
                              <span>•</span>
                              <span className="text-rose-400">{rec.errorMessage}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setReprintSessionCode(rec.sessionId);
                          setReprintCopies(rec.copies || 1);
                          setReprintReason(rec.errorMessage ? `Pemulihan: ${rec.errorMessage}` : 'Cetak ulang sesi pelanggan');
                          setIsReprintModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                        title="Cetak ulang sesi ini untuk pemulihan kegagalan cetak"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Cetak Ulang (Recovery)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reprint Modal */}
      <Modal
        isOpen={isReprintModalOpen}
        onClose={() => setIsReprintModalOpen(false)}
        maxWidth="sm"
        title="Formulir Reprint Khusus Admin"
      >
        <form onSubmit={handleReprintSubmit} className="space-y-4">
          <p className="text-xs text-slate-300">
            Seluruh tindakan pencetakan ulang dicatat dalam audit log sistem demi akuntabilitas pemakaian bahan cetak.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Kode Sesi Pelanggan (Contoh: MJ-8921)
            </label>
            <input
              type="text"
              value={reprintSessionCode}
              onChange={(e) => setReprintSessionCode(e.target.value.toUpperCase())}
              placeholder="MJ-XXXX"
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-amber-300 font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Jumlah Lembar Reprint</label>
            <input
              type="number"
              min="1"
              max="5"
              value={reprintCopies}
              onChange={(e) => setReprintCopies(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Alasan Pencetakan Ulang (Audit Log)
            </label>
            <textarea
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
              rows={2}
              placeholder="Contoh: Paper jam terselesaikan, kertas tersangkut..."
              className="w-full p-3 rounded-xl glass-input text-xs text-white resize-none"
              required
            />
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReprintModalOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-300 text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingReprint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 active:scale-95 text-slate-950 text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingReprint ? 'Memproses...' : 'Kirim Reprint'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
