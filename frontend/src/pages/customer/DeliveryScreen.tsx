import React, { useEffect, useState, useMemo } from 'react';
import {
  Printer,
  QrCode,
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Check,
  ZoomIn,
  X,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { photoboothApi } from '../../services/photoboothApi';
import { printerAdapter } from '../../adapters/printerAdapter';
import { Button } from '../../components/common/Button';
import { VirtualEmailKeyboard } from '../../components/common/VirtualEmailKeyboard';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
function downloadFile(urlOrBlob: string | Blob, filename: string): void {
  const link = document.createElement('a');
  if (typeof urlOrBlob === 'string') {
    link.href = urlOrBlob;
  } else {
    link.href = URL.createObjectURL(urlOrBlob);
  }
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
import {
  generateLivePhotoVideo,
  LivePhotoResult,
} from '../../services/livePhotoService';
import { playButtonSound } from '../../services/soundEffects';
import { SelectedPrintItem } from '../../contexts/SessionContext';

export interface DeliveryScreenProps {
  sessionId: string;
  copies: number;
  capturedPhotos?: string[];
  finalLayoutUrl?: string | null;
  selectedPrintItems?: SelectedPrintItem[];
  onFinishAndReset: () => void;
}

export const DeliveryScreen: React.FC<DeliveryScreenProps> = ({
  sessionId,
  copies,
  capturedPhotos = [],
  finalLayoutUrl = null,
  selectedPrintItems = [],
  onFinishAndReset,
}) => {
  const { showToast } = useToast();

  const [galleryData, setGalleryData] = useState<{
    qrString: string;
    galleryUrl: string;
    expiresAt: string;
  } | null>(null);

  // Printing State
  const [printStatus, setPrintStatus] = useState<'queued' | 'printing' | 'completed' | 'failed'>('printing');
  const [printProgress, setPrintProgress] = useState<number>(30);
  const [pausedState, setPausedState] = useState<{
    issue: string;
    reason: string;
    currentCopy: number;
    totalCopies: number;
  } | null>(null);
  const [currentSheetInfo, setCurrentSheetInfo] = useState<{
    current: number;
    total: number;
  }>({ current: 1, total: copies });

  // Live Photo (Motion Video) State
  const [isGeneratingLive, setIsGeneratingLive] = useState<boolean>(true);
  const [liveResult, setLiveResult] = useState<LivePhotoResult | null>(null);
  const [isLiveStripActive, setIsLiveStripActive] = useState<boolean>(false);
  const [liveFrameIndex, setLiveFrameIndex] = useState<number>(0);

  // Modal zoom on image
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [zoomTitle, setZoomTitle] = useState<string>('Pratinjau Foto');
  const [zoomType, setZoomType] = useState<'image' | 'live'>('image');

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  // Auto Reset Countdown: 1 Menit (60 Detik)
  const [autoResetSeconds, setAutoResetSeconds] = useState(60);

  // 1. Generate Live Photo (Motion Video) in background with smooth cinematic crossfade
  useEffect(() => {
    let isMounted = true;

    const createLive = async () => {
      if (!capturedPhotos || capturedPhotos.length === 0) {
        if (isMounted) setIsGeneratingLive(false);
        return;
      }

      try {
        setIsGeneratingLive(true);
        const result = await generateLivePhotoVideo(capturedPhotos, {
          maxDimension: 720,
          fps: 30,
          frameHoldMs: 650,
          transitionMs: 200,
        });

        if (isMounted) {
          setLiveResult(result);
          setIsGeneratingLive(false);
          if (photoboothApi.uploadGalleryFile && result.videoBlob && result.videoBlob.size > 0) {
            const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
            const fileName = `live-motion.${ext}`;
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result && typeof reader.result === 'string' && reader.result.length > 100) {
                photoboothApi.uploadGalleryFile!(sessionId, 'live_video', reader.result, fileName).catch((err) => {
                  console.warn('[DeliveryScreen] Gagal upload video live motion:', err);
                });
              }
            };
            reader.readAsDataURL(result.videoBlob);
          }
        }
      } catch (err) {
        console.warn('[DeliveryScreen] Gagal generate Live Photo video:', err);
        if (isMounted) setIsGeneratingLive(false);
      }
    };

    createLive();

    return () => {
      isMounted = false;
    };
  }, [capturedPhotos]);

  // Client-side real-time live photo loop for instant real-time live preview
  useEffect(() => {
    if (!capturedPhotos || capturedPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setLiveFrameIndex((prev) => (prev + 1) % capturedPhotos.length);
    }, 600);

    return () => clearInterval(interval);
  }, [capturedPhotos]);

  // Total physical prints count calculation
  const totalPhysicalPrints = useMemo(() => {
    if (selectedPrintItems && selectedPrintItems.length > 0) {
      return selectedPrintItems.reduce((acc, it) => acc + (it.copies || 0), 0);
    }
    return copies;
  }, [selectedPrintItems, copies]);

  useEffect(() => {
    setCurrentSheetInfo({ current: 1, total: totalPhysicalPrints });
  }, [totalPhysicalPrints]);

  // 2. Subscribe to real-time Print Engine IPC events (Queue, Paused, Resumed, Sheet Done)
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // Job progress (0-100%)
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:job-progress', (data: any) => {
        if (typeof data?.percent === 'number') {
          setPrintProgress(data.percent);
        }
      })
    );

    // Sheet printed event (sheet-by-sheet)
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:sheet-printed', (data: any) => {
        if (data?.currentCopy && data?.totalCopies) {
          setCurrentSheetInfo({ current: data.currentCopy, total: data.totalCopies });
          const calculated = Math.round((data.currentCopy / data.totalCopies) * 100);
          setPrintProgress(calculated);
        }
      })
    );

    // Queue paused event (e.g. Paper Out on copy #2, Jam, Door open)
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:queue-paused', (data: any) => {
        console.warn('[DeliveryScreen] Print queue paused:', data);
        setPausedState({
          issue: data?.issue || 'paper_out',
          reason: data?.reason || 'Kertas printer habis. Silakan hubungi operator.',
          currentCopy: data?.currentCopy || 1,
          totalCopies: data?.totalCopies || totalPhysicalPrints,
        });
      })
    );

    // Queue resumed event (automatically recovered once paper is inserted)
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:queue-resumed', () => {
        console.info('[DeliveryScreen] Print queue resumed!');
        setPausedState(null);
        showToast({
          type: 'info',
          title: 'Kertas Terpasang',
          message: 'Pencetakan lembar foto otomatis dilanjutkan.',
        });
      })
    );

    // Job completed event
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:job-completed', () => {
        setPrintProgress(100);
        setPrintStatus('completed');
        setPausedState(null);
        playButtonSound('success');
        showToast({
          type: 'success',
          title: 'Foto Selesai Dicetak!',
          message: `Silakan ambil ${totalPhysicalPrints} lembar foto fisik di baki printer.`,
        });
      })
    );

    // Job failed event
    unsubs.push(
      printerAdapter.onPrinterEvent('printer:event:job-failed', (data: any) => {
        setPrintStatus('failed');
        showToast({
          type: 'error',
          title: 'Kendala Pencetakan',
          message: data?.error || 'Pekerjaan cetak mengalami kendala pada printer.',
        });
      })
    );

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [totalPhysicalPrints, showToast]);

  // 2b. Initiate gallery URL loading & submit job to print engine
  useEffect(() => {
    let isMounted = true;

    const initDelivery = async () => {
      // 1. Upload hasil cetak & desain frame ke local storage booth & cloud
      if (selectedPrintItems && selectedPrintItems.length > 0) {
        for (const item of selectedPrintItems) {
          if (item.copies > 0 && item.url) {
            await printerAdapter.submitJob({
              sessionId,
              copies: item.copies,
              layoutImageUrl: item.url,
            });
            if (photoboothApi.uploadGalleryFile) {
              await photoboothApi.uploadGalleryFile(sessionId, item.type === 'frame' ? 'print_strip' : 'single_photo', item.url, `${item.id}.jpg`).catch(() => {});
            }
          }
        }
      } else {
        if (photoboothApi.uploadGalleryFile && finalLayoutUrl) {
          await photoboothApi.uploadGalleryFile(sessionId, 'print_strip', finalLayoutUrl, 'print-strip.jpg').catch(() => {});
        }

        await printerAdapter.submitJob({
          sessionId,
          copies,
          layoutImageUrl: finalLayoutUrl || '',
        });
      }

      // 2. Upload semua pose foto asli kamera (HD) ke local storage & cloud
      if (photoboothApi.uploadGalleryFile && capturedPhotos && capturedPhotos.length > 0) {
        for (let idx = 0; idx < capturedPhotos.length; idx++) {
          const photoUrl = capturedPhotos[idx];
          await photoboothApi.uploadGalleryFile(sessionId, 'single_photo', photoUrl, `pose_${idx + 1}.jpg`).catch(() => {});
        }
      }

      // 3. Ambil tautan galeri QR setelah seluruh foto tersimpan di penyimpanan
      const galRes = await photoboothApi.getGalleryUrl(sessionId);
      if (galRes.success && isMounted) {
        setGalleryData(galRes.data);
      }

      // Fallback timer for browser/mock environments without native Electron PrintEngine
      const isElectron = typeof window !== 'undefined' && Boolean(window.electronPrinter);
      if (!isElectron) {
        setTimeout(() => {
          if (isMounted) setPrintProgress(70);
        }, 3000);

        setTimeout(() => {
          if (isMounted) {
            setPrintProgress(100);
            setPrintStatus('completed');
            playButtonSound('success');
            showToast({
              type: 'success',
              title: 'Foto Selesai Dicetak!',
              message: `Silakan ambil ${totalPhysicalPrints} lembar foto fisik di baki printer.`,
            });
          }
        }, 7000);
      }
    };

    initDelivery();

    return () => {
      isMounted = false;
    };
  }, [sessionId, copies, finalLayoutUrl, selectedPrintItems, totalPhysicalPrints, showToast]);

  // 3. Countdown timer 1 menit
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoResetSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinishAndReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onFinishAndReset]);

  // Handle Email soft-file submission
  const handleSendEmail = async () => {
    const cleanEmail = emailAddress.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      showToast({
        type: 'error',
        title: 'Email Tidak Valid',
        message: 'Masukkan format alamat email yang valid (contoh: user@gmail.com).',
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await photoboothApi.sendEmail(sessionId, cleanEmail);
      if (res.success) {
        setIsEmailSent(true);
        setIsEmailModalOpen(false);
        playButtonSound('success');
        showToast({
          type: 'success',
          title: 'Soft File Terkirim!',
          message: `Tautan galeri telah dikirim ke alamat email ${cleanEmail}.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Pengiriman Gagal',
          message: res.error.message,
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-screen h-screen flex flex-col justify-between p-8 md:p-10 select-none bg-background overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Terima Kasih! Sesi Anda Telah Selesai
            </h2>
            <p className="text-xs text-slate-400">
              Silakan ambil hasil cetakan di baki printer dan scan QR untuk soft file digital
            </p>
          </div>
        </div>

        {/* 1-Minute Auto Reset Capsule & Finish Button */}
        <div className="flex items-center gap-3">
          <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2 text-xs text-slate-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Sisa Waktu:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {formatTimer(autoResetSeconds)}
            </span>
          </div>

          <Button
            variant="gold"
            size="md"
            onClick={onFinishAndReset}
            className="shadow-glow-primary"
          >
            Selesai Sesi
          </Button>
        </div>
      </div>

      {/* Main 2-Column Minimalist Display (Centered & Balanced) */}
      <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto w-full my-auto items-stretch">
        {/* ========================================================= */}
        {/* LEFT COLUMN: ANIMASI PROSES PRINT & HASIL (FOTO & GIF)    */}
        {/* ========================================================= */}
        <div className="glass-panel-elevated rounded-3xl p-6 flex flex-col justify-between text-center border-amber-500/20 shadow-2xl">
          <div>
            {/* Animated Printer Icon */}
            <div className="relative w-18 h-18 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
              {printStatus === 'completed' ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-400 stroke-[2.2]" />
              ) : (
                <Printer className="w-9 h-9 stroke-[2.2] animate-pulse" />
              )}
            </div>

            <h3 className="text-xl font-extrabold text-white mb-0.5">
              Cetak Foto Fisik
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Sedang memproses <strong>{totalPhysicalPrints} lembar</strong> cetak foto fisik
            </p>

            {/* Paused State Recovery Alert (When paper is empty mid-job) */}
            {pausedState && (
              <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-3.5 mb-3 text-left animate-pulse">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Kertas Sedang Diisi Ulang</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  {pausedState.reason || 'Kertas printer habis.'} Mencetak lembar ke-{pausedState.currentCopy} dari {pausedState.totalCopies}.
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-amber-300/90 border-t border-amber-500/20 pt-1.5">
                  <span>Antrean dijeda sementara & otomatis lanjut saat kertas diisi</span>
                  <button
                    type="button"
                    onClick={() => printerAdapter.manualResume()}
                    className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-white font-bold cursor-pointer transition-all"
                  >
                    Cek Status
                  </button>
                </div>
              </div>
            )}

            {/* Printing Progress Bar */}
            <div className="bg-slate-900/80 rounded-2xl p-3 border border-white/10 mb-3 text-left">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  {printStatus === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : pausedState ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  <span>
                    {printStatus === 'completed'
                      ? 'Pencetakan Selesai'
                      : pausedState
                      ? `Menunggu Kertas (Lembar ${pausedState.currentCopy}/${pausedState.totalCopies})...`
                      : currentSheetInfo.total > 1
                      ? `Mencetak Lembar ${currentSheetInfo.current} dari ${currentSheetInfo.total}...`
                      : 'Mencetak Foto Lab...'}
                  </span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-xs">
                  {printProgress}%
                </span>
              </div>

              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 rounded-full ${
                    pausedState
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${printProgress}%` }}
                />
              </div>
            </div>

            {/* Compact Results Showcase: Cetak Foto, (◎) Live Photo, Animasi GIF, & Foto Asli */}
            <div className="bg-slate-900/60 rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 px-1">
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">
                  Hasil Cetak & Format Digital:
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Fitur Live Aktif</span>
                </span>
              </div>

              <div className="flex items-center justify-center gap-3">
                {/* 1. Print Card (with Interactive LIVE toggle) */}
                {finalLayoutUrl && (
                  <div
                    onClick={() => {
                      setZoomPhotoUrl(
                        isLiveStripActive
                          ? (liveResult?.videoUrl || capturedPhotos[liveFrameIndex] || finalLayoutUrl)
                          : finalLayoutUrl
                      );
                      setZoomType(isLiveStripActive ? 'live' : 'image');
                      setZoomTitle(isLiveStripActive ? 'Foto (Mode Live Motion)' : 'Hasil Cetak Fisik');
                    }}
                    className="relative group cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-22 h-32 rounded-xl bg-white p-1 shadow-md border border-white/80 overflow-hidden group-hover:scale-105 transition-transform relative">
                      <img
                        src={
                          isLiveStripActive
                            ? (capturedPhotos[liveFrameIndex] || finalLayoutUrl)
                            : finalLayoutUrl
                        }
                        alt="Hasil Cetak"
                        className="w-full h-full object-cover rounded-lg transition-all duration-300"
                      />

                      {/* Interactive LIVE toggle switch right on card */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playButtonSound('secondary');
                          setIsLiveStripActive(!isLiveStripActive);
                        }}
                        title="Klik untuk beralih mode Live Photo"
                        className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[7.5px] font-black tracking-wider flex items-center gap-1 transition-all shadow-md cursor-pointer ${
                          isLiveStripActive
                            ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                            : 'bg-black/80 text-amber-300 hover:bg-black'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLiveStripActive ? 'bg-slate-950 animate-ping' : 'bg-amber-400'
                          }`}
                        />
                        <span>LIVE</span>
                      </button>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 mt-1 flex items-center gap-1">
                      <span>Cetak Foto</span>
                      <ZoomIn className="w-2.5 h-2.5 opacity-70" />
                    </span>
                  </div>
                )}

                {/* 2. Dedicated Live Photo / Motion Clip Card */}
                <div
                  onClick={() => {
                    setZoomPhotoUrl(liveResult?.videoUrl || capturedPhotos[liveFrameIndex] || finalLayoutUrl || '');
                    setZoomType('live');
                    setZoomTitle('Live Photo (Motion Clip)');
                  }}
                  className="relative group cursor-pointer flex flex-col items-center"
                >
                  <div className="w-26 h-32 rounded-xl bg-black p-1 shadow-md border border-amber-400/50 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform relative">
                    {liveResult ? (
                      <video
                        src={liveResult.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : isGeneratingLive && capturedPhotos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-spin mb-1" />
                        <span className="text-[8px] font-semibold text-slate-300">Menyiapkan Live...</span>
                      </div>
                    ) : capturedPhotos.length > 0 ? (
                      <img
                        src={capturedPhotos[liveFrameIndex]}
                        alt="Live Photo"
                        className="w-full h-full object-cover rounded-lg transition-opacity duration-300"
                      />
                    ) : (
                      <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                    )}

                    {/* Apple-style pulsing LIVE badge */}
                    <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-amber-400/50 flex items-center gap-1 shadow-md">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
                      </span>
                      <span className="text-[8px] font-black tracking-wider text-amber-300">LIVE</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 mt-1 flex items-center gap-1">
                    <span>Live Photo</span>
                    <ZoomIn className="w-2.5 h-2.5 opacity-70" />
                  </span>
                </div>
              </div>

              {/* Mini Photos Strip */}
              {capturedPhotos.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-center gap-1.5 overflow-x-auto custom-scrollbar">
                  {capturedPhotos.slice(0, 6).map((url, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setZoomPhotoUrl(url);
                        setZoomTitle(`Foto Pose #${i + 1}`);
                      }}
                      className="w-9 h-7 rounded bg-slate-950 overflow-hidden border border-white/15 cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
                      title={`Foto #${i + 1}`}
                    >
                      <img src={url} alt={`#${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {capturedPhotos.length > 6 && (
                    <span className="text-[9px] text-slate-400 font-bold px-1">
                      +{capturedPhotos.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Tray Status Notice */}
          <div className="p-3 mt-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            {printStatus === 'completed'
              ? '✓ Cetakan Anda telah keluar di baki printer. Selamat menikmati!'
              : 'Harap menunggu mesin printer mengeluarkan lembar cetakan secara otomatis.'}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: DIGITAL SOFT-FILE (QR CODE & EMAIL)         */}
        {/* ========================================================= */}
        <div className="glass-panel-elevated rounded-3xl p-6 flex flex-col justify-between text-center border-white/10 shadow-2xl">
          <div>
            <div className="w-16 h-16 rounded-full bg-sky-500/15 text-sky-400 flex items-center justify-center mx-auto mb-3 border border-sky-500/30">
              <QrCode className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-white mb-1">
              Soft File Digital (HD)
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Scan QR code dengan kamera HP Anda untuk mengunduh semua foto & GIF
            </p>

            {/* QR Code Container */}
            {galleryData ? (
              <div className="p-3 bg-white rounded-2xl inline-block shadow-xl my-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    galleryData.galleryUrl
                  )}`}
                  alt="QR Galeri Privat"
                  className="w-34 h-34 object-contain"
                />
              </div>
            ) : (
              <div className="w-34 h-34 mx-auto my-1 rounded-2xl bg-white/5 border border-dashed border-white/15 flex flex-col items-center justify-center p-3 text-slate-400">
                <Sparkles className="w-6 h-6 text-sky-400 animate-spin mb-1" />
                <span className="text-[10px] font-semibold text-slate-300">Menyiapkan QR...</span>
              </div>
            )}

            {/* Included Content Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-300 mt-2">
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" /> Cetak Foto Fisik
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                <span>Live Photo</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" /> Animasi GIF
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" /> Foto HD
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Tautan galeri privat berlaku selama <strong>48 jam</strong>.
            </p>
          </div>

          {/* Email Share Button */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <Button
              variant={isEmailSent ? 'glass' : 'primary'}
              size="md"
              className="w-full"
              onClick={() => {
                playButtonSound('primary');
                setIsEmailModalOpen(true);
              }}
              leftIcon={<Mail className="w-4 h-4 text-amber-400" />}
            >
              {isEmailSent ? 'Terkirim ke Email ✓' : 'Kirim Soft File ke Email'}
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Session ID */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10 flex-shrink-0 text-xs text-slate-400">
        <span>MinjaPhotobooth • Sesi ID: <strong className="text-amber-400 font-mono">{sessionId}</strong></span>
        <span>Terima Kasih atas Kunjungan Anda</span>
      </div>

      {/* Modal Zoom Preview */}
      <AnimatePresence>
        {zoomPhotoUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
            onClick={() => setZoomPhotoUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel-elevated p-5 rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl flex flex-col items-center gap-3"
            >
              <div className="w-full flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  {zoomTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPhotoUrl(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full max-h-[55vh] rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                {zoomType === 'live' && liveResult?.videoUrl ? (
                  <video
                    src={liveResult.videoUrl}
                    autoPlay
                    loop
                    controls
                    playsInline
                    className="w-full max-h-[55vh] object-contain"
                  />
                ) : (
                  <img
                    src={zoomPhotoUrl}
                    alt={zoomTitle}
                    className="w-full max-h-[55vh] object-contain"
                  />
                )}

                {zoomType === 'live' && (
                  <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-400/50 flex items-center gap-1.5 shadow-lg pointer-events-none">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                    </span>
                    <span className="text-[9px] font-black tracking-wider text-amber-300">
                      LIVE PHOTO
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (zoomType === 'live' && liveResult) {
                      const ext = liveResult.mimeType.includes('mp4') ? 'mp4' : 'webm';
                      downloadFile(liveResult.videoUrl, `minja-live-photo-${sessionId}.${ext}`);
                    } else if (zoomPhotoUrl) {
                      downloadFile(zoomPhotoUrl, `minja-photo-${sessionId}-${Date.now()}.jpg`);
                    }
                    showToast({
                      type: 'success',
                      title: 'File Diunduh',
                      message: zoomType === 'live' ? 'Video Live Photo berhasil diunduh.' : 'Foto berhasil diunduh.',
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{zoomType === 'live' ? 'Unduh Video Live' : 'Unduh Foto Ini'}</span>
                </button>

                <Button
                  variant="gold"
                  size="md"
                  onClick={() => setZoomPhotoUrl(null)}
                >
                  Tutup
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Input Email Menggunakan Touch Virtual Keyboard */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title="Kirim Soft File ke Email"
        maxWidth="lg"
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-slate-300 text-center">
            Masukkan alamat email Anda untuk menerima tautan unduhan galeri digital privat (berisi strip foto, foto HD, dan video Live Photo).
          </p>

          <div className="w-full h-13 rounded-2xl glass-input px-4 flex items-center justify-between border border-amber-500/30">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-transparent text-white font-mono text-base outline-none placeholder:text-slate-500"
              />
            </div>
            {emailAddress && (
              <button
                type="button"
                onClick={() => setEmailAddress('')}
                className="w-6 h-6 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <VirtualEmailKeyboard
            value={emailAddress}
            onChange={setEmailAddress}
            submitLabel={isSendingEmail ? 'Mengirim...' : 'Kirim Email'}
            onSubmit={handleSendEmail}
            isSubmitDisabled={isSendingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())}
          />
        </div>
      </Modal>
    </div>
  );
};
