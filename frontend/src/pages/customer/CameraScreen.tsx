import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight,
  Video,
  Sparkles,
  Hand,
  Timer,
  Camera,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraDeviceInfo } from '../../types/hardware';
import { cameraAdapter } from '../../adapters/cameraAdapter';
import { CameraViewport } from '../../components/customer/CameraViewport';
import { CountdownOverlay } from '../../components/customer/CountdownOverlay';
import { ShutterButton } from '../../components/customer/ShutterButton';
import { PhotoGalleryStrip } from '../../components/customer/PhotoGalleryStrip';
import { Button } from '../../components/common/Button';
import { SessionTimerBadge } from '../../components/customer/SessionTimerBadge';
import { useToast } from '../../components/common/Toast';
import {
  playButtonSound,
  playCountdownTick,
  playCameraShutterSound,
  playPhotoCapturedSound,
  playSmileCueSound,
} from '../../services/soundEffects';

export interface CameraScreenProps {
  maxPhotos?: number;
  durationSeconds?: number;
  sessionSecondsLeft?: number;
  photos: string[];
  onAddPhoto: (dataUrl: string) => void;
  onDeletePhoto: (index: number) => void;
  onFinishCapture: () => void;
}

export type ShutterMode = 'manual' | 'handsfree';

export const CameraScreen: React.FC<CameraScreenProps> = ({
  maxPhotos = 10,
  sessionSecondsLeft = 180,
  photos,
  onAddPhoto,
  onDeletePhoto,
  onFinishCapture,
}) => {
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  // References to prevent stale closure bugs in timers & asynchronous callbacks
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handsFreeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandsFreeRunningRef = useRef<boolean>(false);
  const photosLengthRef = useRef<number>(photos.length);

  // Synchronize photos length ref
  useEffect(() => {
    photosLengthRef.current = photos.length;
  }, [photos.length]);

  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [activeDevice, setActiveDevice] = useState<CameraDeviceInfo | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Viewport Settings (Studio Mirrors, Safe Zones & Guides)
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSafeZone, setShowSafeZone] = useState<boolean>(true);

  // Shutter Mode State
  const [shutterMode, setShutterMode] = useState<ShutterMode>('manual');
  const [isHandsFreeRunning, setIsHandsFreeRunning] = useState<boolean>(false);
  const [poseIntervalSec, setPoseIntervalSec] = useState<number>(3); // 3s or 5s
  const [poseAnnouncement, setPoseAnnouncement] = useState<string | null>(null);

  // Device selection handler
  const handleSelectDevice = useCallback(async (deviceId: string) => {
    cameraAdapter.setPreferredDeviceId(deviceId);
    const target = devices.find((d) => d.id === deviceId);
    if (target) {
      setActiveDevice(target);
      if (videoRef.current) {
        await cameraAdapter.startLiveView(videoRef.current, deviceId);
        setIsSimulated(cameraAdapter.isUsingSimulatedStream());
        showToast({
          type: 'info',
          title: 'Kamera Beralih',
          message: `Menggunakan ${target.name}.`,
        });
      }
    }
  }, [devices, showToast]);

  // Unified camera initialization & retry handler
  const initCamera = useCallback(async () => {
    try {
      const devList = await cameraAdapter.listDevices();
      setDevices(devList);

      const defaultDev = devList.find((d) => d.isDefault) || devList[0];
      setActiveDevice(defaultDev || null);

      if (videoRef.current) {
        await cameraAdapter.startLiveView(videoRef.current, defaultDev?.id);
        const usingSim = cameraAdapter.isUsingSimulatedStream();
        setIsSimulated(usingSim);
        if (usingSim) {
          showToast({
            type: 'warning',
            title: 'Kamera Fisik Belum Terhubung',
            message: 'Menggunakan mode simulasi studio. Hubungkan webcam/DroidCam lalu tekan Coba Hubungkan.',
          });
        } else if (defaultDev) {
          showToast({
            type: 'success',
            title: 'Kamera Siap 📷',
            message: `Kamera ${defaultDev.name} aktif.`,
          });
        }
      }
    } catch (err: any) {
      console.warn('Gagal inisialisasi kamera:', err);
    }
  }, [showToast]);

  // Initialize camera and listen to device changes
  useEffect(() => {
    initCamera();

    // Pastikan video element terhubung segera setelah selesai mounting di DOM
    const retryTimer = setTimeout(() => {
      if (videoRef.current && !cameraAdapter.getActiveDeviceId() && !cameraAdapter.isUsingSimulatedStream()) {
        initCamera();
      }
    }, 250);

    // Listen to USB/HDMI camera hot-plug
    const cleanupListener = cameraAdapter.onDeviceChange(async () => {
      const devList = await cameraAdapter.listDevices();
      setDevices(devList);
    });

    return () => {
      clearTimeout(retryTimer);
      cleanupListener();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (handsFreeTimeoutRef.current) {
        clearTimeout(handsFreeTimeoutRef.current);
      }
      cameraAdapter.stopLiveView();
    };
  }, [initCamera]);

  // Stop / Pause Hands-Free mode safely
  const stopHandsFree = useCallback((notify = false) => {
    isHandsFreeRunningRef.current = false;
    setIsHandsFreeRunning(false);
    setPoseAnnouncement(null);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (handsFreeTimeoutRef.current) {
      clearTimeout(handsFreeTimeoutRef.current);
      handsFreeTimeoutRef.current = null;
    }

    setCountdown(null);
    setIsCapturing(false);

    if (notify) {
      playButtonSound('secondary');
      showToast({
        type: 'info',
        title: 'Hands-Free Dijeda',
        message: 'Tekan tombol Mulai lagi saat Anda sudah siap.',
      });
    }
  }, [showToast]);

  // Execute single snapshot with authentic studio shutter sound & flash
  const executeSingleShot = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);
    setIsFlashActive(true);
    playCameraShutterSound();

    setTimeout(() => setIsFlashActive(false), 300);

    try {
      const photoDataUrl = await cameraAdapter.capturePhoto(isMirrored);
      onAddPhoto(photoDataUrl);
      playPhotoCapturedSound();

      // Tampilkan preview instan foto yang baru dijepret selama 1.2 detik
      setCapturedPhotoPreview(photoDataUrl);
      setTimeout(() => {
        setCapturedPhotoPreview(null);
      }, 1200);

      return true;
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Gagal Mengambil Foto',
        message: 'Terjadi kendala pada adapter kamera.',
      });
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, [isMirrored, onAddPhoto, showToast]);

  // Sequential hands-free loop runner
  const runNextHandsFreeShot = useCallback(() => {
    if (!isHandsFreeRunningRef.current) return;

    const currentCount = photosLengthRef.current;
    if (currentCount >= maxPhotos) {
      stopHandsFree();
      playButtonSound('success');
      showToast({
        type: 'success',
        title: 'Sesi Foto Selesai! 🎉',
        message: `Semua ${maxPhotos} pose berhasil diambil. Silakan lanjut ke editor foto.`,
      });
      return;
    }

    const nextPoseNumber = currentCount + 1;
    setPoseAnnouncement(null);

    let count = poseIntervalSec;
    setCountdown(count);
    playCountdownTick(Math.min(count, 3));

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(async () => {
      if (!isHandsFreeRunningRef.current) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        return;
      }

      count--;
      if (count > 0) {
        setCountdown(count);
        playCountdownTick(Math.min(count, 3));
        if (count === 1) {
          playSmileCueSound();
        }
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);

        const success = await executeSingleShot();
        if (!success) {
          stopHandsFree();
          return;
        }

        showToast({
          type: 'success',
          title: 'Pose Tersimpan!',
          message: `Pose #${nextPoseNumber} berhasil diambil.`,
        });

        const newTotal = photosLengthRef.current + 1;
        if (newTotal >= maxPhotos) {
          stopHandsFree();
          playButtonSound('success');
          showToast({
            type: 'success',
            title: 'Sesi Foto Selesai! 🎉',
            message: `Semua ${maxPhotos} pose berhasil diambil. Silakan lanjut ke editor foto.`,
          });
        } else if (isHandsFreeRunningRef.current) {
          // Announce pose change transition
          setPoseAnnouncement(`✨ Pose #${nextPoseNumber} Selesai! Siap Pose #${newTotal + 1}...`);
          handsFreeTimeoutRef.current = setTimeout(() => {
            setPoseAnnouncement(null);
            if (isHandsFreeRunningRef.current) {
              runNextHandsFreeShot();
            }
          }, 1500);
        }
      }
    }, 1000);
  }, [maxPhotos, poseIntervalSec, executeSingleShot, stopHandsFree, showToast]);

  // Start Hands-Free shooting sequence
  const startHandsFree = useCallback(() => {
    if (photos.length >= maxPhotos) {
      showToast({
        type: 'info',
        title: 'Batas Tercapai',
        message: `Kuota maksimal ${maxPhotos} foto sudah terpenuhi.`,
      });
      return;
    }

    playButtonSound('primary');
    isHandsFreeRunningRef.current = true;
    setIsHandsFreeRunning(true);
    showToast({
      type: 'info',
      title: 'Mode Hands-Free Dimulai',
      message: `Foto akan diambil otomatis setiap jeda ${poseIntervalSec} detik.`,
    });

    runNextHandsFreeShot();
  }, [photos.length, maxPhotos, poseIntervalSec, runNextHandsFreeShot, showToast]);

  // Trigger Manual Shutter with 3-second countdown
  const handleTriggerManualShutter = useCallback(() => {
    if (photos.length >= maxPhotos || isCapturing || countdown !== null) return;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    let count = 3;
    setCountdown(count);
    playCountdownTick(3);

    const interval = setInterval(async () => {
      count--;
      if (count > 0) {
        setCountdown(count);
        playCountdownTick(count);
        if (count === 1) {
          playSmileCueSound();
        }
      } else {
        clearInterval(interval);
        countdownIntervalRef.current = null;
        setCountdown(null);

        const success = await executeSingleShot();
        if (success) {
          showToast({
            type: 'success',
            title: 'Foto Tersimpan!',
            message: `Foto #${photos.length + 1} berhasil diambil.`,
          });
        }
      }
    }, 1000);

    countdownIntervalRef.current = interval;
  }, [photos.length, maxPhotos, isCapturing, countdown, executeSingleShot, showToast]);

  // Unified Shutter Trigger based on current mode
  const handleShutterAction = useCallback(() => {
    if (shutterMode === 'handsfree') {
      if (isHandsFreeRunningRef.current) {
        stopHandsFree(true);
      } else {
        startHandsFree();
      }
    } else {
      handleTriggerManualShutter();
    }
  }, [shutterMode, stopHandsFree, startHandsFree, handleTriggerManualShutter]);

  // Switch between Manual and Hands-Free
  const handleModeChange = (mode: ShutterMode) => {
    if (mode === shutterMode) return;
    playButtonSound('secondary');
    if (isHandsFreeRunningRef.current) {
      stopHandsFree(false);
    }
    setShutterMode(mode);
  };


  const isLimitReached = photos.length >= maxPhotos;

  return (
    <div className="w-screen h-screen flex flex-col justify-between p-6 md:p-8 select-none bg-background">
      {/* Top Header Status & Action Bar */}
      <header className="flex items-center justify-between pb-3.5 border-b border-white/10">
        {/* Left: Studio Branding & Camera Device Switch */}
        <div className="flex items-center gap-3">
          <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            <span className="text-xs font-black tracking-widest text-slate-200 uppercase">
              MINJA PRO STUDIO
            </span>
          </div>

          <div className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={activeDevice?.id || ''}
              onChange={(e) => {
                handleSelectDevice(e.target.value);
              }}
              className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer"
            >
              {devices.length === 0 ? (
                <option value="" className="bg-slate-900 text-slate-400">
                  Kamera Studio
                </option>
              ) : (
                devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Center: Dynamic Session Timer Capsule */}
        <SessionTimerBadge secondsLeft={sessionSecondsLeft} />

        {/* Right: Next Step CTA Button */}
        <div>
          <Button
            variant="gold"
            size="md"
            disabled={photos.length === 0}
            onClick={onFinishCapture}
            rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            className={`shadow-lg transition-transform ${
              isLimitReached ? 'animate-pulse shadow-glow-primary scale-105' : ''
            }`}
          >
            Selesai Foto ({photos.length}/{maxPhotos})
          </Button>
        </div>
      </header>

      {/* Main Center Area: Camera Viewport + Luxury Touch Console */}
      <div className="flex-1 flex gap-6 my-4 min-h-0">
        {/* Left/Center: Hero Camera Viewport */}
        <div className="flex-1 relative h-full">
          <CameraViewport
            videoRef={videoRef}
            activeDevice={activeDevice}
            devices={devices}
            onSelectDevice={handleSelectDevice}
            photoCount={photos.length}
            maxPhotos={maxPhotos}
            isMirrored={isMirrored}
            onToggleMirror={() => setIsMirrored((m) => !m)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((g) => !g)}
            showSafeZone={showSafeZone}
            onToggleSafeZone={() => setShowSafeZone((s) => !s)}
            isSimulated={isSimulated}
            capturedPhotoPreview={capturedPhotoPreview}
            onRetryConnect={initCamera}
          >
            {/* Cinematic Studio Countdown Overlay */}
            <CountdownOverlay
              count={countdown}
              isFlashActive={isFlashActive}
              modeBadge={
                countdown !== null
                  ? shutterMode === 'handsfree'
                    ? '✨ MODE HANDS-FREE'
                    : 'MODE MANUAL'
                  : null
              }
              subMessage={
                countdown !== null
                  ? `Pose #${photos.length + 1} dari ${maxPhotos} — Bersiap!`
                  : null
              }
            />

            {/* Transition Announcement Banner between Hands-Free shots */}
            <AnimatePresence>
              {poseAnnouncement && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none select-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -15 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="glass-panel-elevated px-8 py-5 rounded-3xl border-2 border-amber-400/60 shadow-2xl flex items-center gap-4 text-amber-300 font-black text-xl tracking-wide backdrop-blur-xl"
                  >
                    <Sparkles className="w-7 h-7 text-amber-400 animate-spin" />
                    <span>{poseAnnouncement}</span>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </CameraViewport>
        </div>

        {/* Right Side: Luxury Studio Control Console */}
        <div className="w-72 flex flex-col items-center justify-between glass-panel-elevated rounded-3xl p-5 flex-shrink-0 border border-white/15 shadow-2xl">
          {/* Top: Modern Mode Switcher */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                PILIH MODE SHUTTER
              </span>
              <span className="text-[10px] text-amber-400/80 font-bold uppercase">
                {shutterMode === 'handsfree' ? 'Otomatis' : 'Manual'}
              </span>
            </div>

            {/* Segmented Mode Selector Cards */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => handleModeChange('manual')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  shutterMode === 'manual'
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black ring-2 ring-amber-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Hand className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-xs font-black">Manual</span>
                </div>
                <span className="text-[9px] opacity-80 font-semibold">Klik Sendiri</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('handsfree')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  shutterMode === 'handsfree'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-md font-black ring-2 ring-amber-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-black">Hands-Free</span>
                </div>
                <span className="text-[9px] opacity-80 font-semibold">Otomatis</span>
              </button>
            </div>

            {/* Mode-specific Option Drawer */}
            <div className="mt-3">
              {shutterMode === 'handsfree' ? (
                <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center shadow-inner">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-300 mb-2">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Jeda Waktu Antar Pose:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isHandsFreeRunning}
                      onClick={() => {
                        playButtonSound('secondary');
                        setPoseIntervalSec(3);
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        poseIntervalSec === 3
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-black/30 border border-white/10 text-slate-300 hover:text-white'
                      } disabled:opacity-40`}
                    >
                      ⏱️ 3 Detik
                    </button>
                    <button
                      type="button"
                      disabled={isHandsFreeRunning}
                      onClick={() => {
                        playButtonSound('secondary');
                        setPoseIntervalSec(5);
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        poseIntervalSec === 5
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-black/30 border border-white/10 text-slate-300 hover:text-white'
                      } disabled:opacity-40`}
                    >
                      ⏱️ 5 Detik
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center shadow-inner">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-bold mb-1">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Shutter Sekali Tekan</span>
                  </div>
                  <span className="text-[11px] text-slate-300">
                    Hitung mundur 3 detik setiap jepretan
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center: The Master Shutter Trigger */}
          <div className="flex flex-col items-center gap-3.5 my-3">
            <ShutterButton
              onCapture={handleShutterAction}
              disabled={isLimitReached || (shutterMode === 'manual' && isCapturing)}
              isCountingDown={countdown !== null}
              mode={shutterMode}
              isRunning={isHandsFreeRunning}
            />

            <div className="text-center px-1">
              <p className="text-xs font-black text-amber-400 uppercase tracking-wide min-h-[1.25rem]">
                {countdown !== null
                  ? `Hitung Mundur: ${countdown}s`
                  : isLimitReached
                  ? 'Batas Kuota Tercapai'
                  : shutterMode === 'handsfree'
                  ? isHandsFreeRunning
                    ? 'Ketuk untuk Jeda (Pause)'
                    : 'Mulai Sesi Otomatis'
                  : 'Ambil Foto Sekarang'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {shutterMode === 'handsfree'
                  ? isHandsFreeRunning
                    ? 'Foto berlanjut otomatis...'
                    : 'Kamera memotret hingga selesai'
                  : 'Bisa tekan tombol Spasi / Remote'}
              </p>
            </div>
          </div>

          {/* Bottom: Progress & Quota Card */}
          <div className="w-full bg-black/40 rounded-2xl p-3.5 border border-white/10 text-center shadow-inner">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Kuota Pose</span>
              </span>
              <span className="text-amber-400 font-mono font-black text-sm">
                {photos.length} / {maxPhotos}
              </span>
            </div>

            {/* Glowing Segmented Progress Bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.min(100, (photos.length / maxPhotos) * 100)}%` }}
              />
            </div>

            {isHandsFreeRunning && (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-300 animate-pulse font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Hands-Free Sedang Aktif...
              </div>
            )}

            {isLimitReached && (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-black">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                Semua pose siap!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Cinematic Thumbnail Gallery Strip */}
      <PhotoGalleryStrip
        photos={photos}
        maxPhotos={maxPhotos}
        onDelete={(index) => {
          playButtonSound('delete');
          onDeletePhoto(index);
        }}
      />
    </div>
  );
};
