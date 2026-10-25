import React, { useState } from 'react';
import { CameraDeviceInfo } from '../../types/hardware';
import { DeviceStatusBadge } from '../common/DeviceStatusBadge';
import { FlipHorizontal2, Grid3X3, Crop, ChevronDown, Check, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CameraViewportProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  activeDevice?: CameraDeviceInfo | null;
  devices?: CameraDeviceInfo[];
  photoCount: number;
  maxPhotos: number;
  showGrid?: boolean;
  isMirrored?: boolean;
  showSafeZone?: boolean;
  isSimulated?: boolean;
  capturedPhotoPreview?: string | null;
  onToggleGrid?: () => void;
  onToggleMirror?: () => void;
  onToggleSafeZone?: () => void;
  onSelectDevice?: (deviceId: string) => void;
  onRetryConnect?: () => void;
  children?: React.ReactNode;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  videoRef,
  activeDevice,
  devices = [],
  photoCount,
  maxPhotos,
  showGrid = true,
  isMirrored = true,
  showSafeZone = true,
  isSimulated = false,
  capturedPhotoPreview,
  onToggleGrid,
  onToggleMirror,
  onToggleSafeZone,
  onSelectDevice,
  onRetryConnect,
  children,
}) => {
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center select-none group">
      {/* Live Video Preview Element with Mirror Support */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        className="w-full h-full object-cover transition-transform duration-300 bg-black"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.paused) v.play().catch(() => {});
        }}
        onCanPlay={(e) => {
          const v = e.currentTarget;
          if (v.paused) v.play().catch(() => {});
        }}
      />

      {/* Instant Capture Freeze Preview Overlay */}
      <AnimatePresence>
        {capturedPhotoPreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-25 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none"
          >
            <div className="relative max-w-[85%] max-h-[85%] rounded-3xl overflow-hidden border-4 border-amber-400 shadow-2xl">
              <img
                src={capturedPhotoPreview}
                alt="Captured Snapshot"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/80 px-3.5 py-1.5 rounded-full border border-amber-400/50 text-amber-300 font-black text-xs flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Pose Berhasil Diambil!</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Studio Viewfinder Corner Brackets */}
      <div className="absolute inset-5 pointer-events-none z-10 opacity-40 group-hover:opacity-60 transition-opacity">
        {/* Top-Left */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-400 rounded-tl-sm" />
        {/* Top-Right */}
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-400 rounded-tr-sm" />
        {/* Bottom-Left */}
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-400 rounded-bl-sm" />
        {/* Bottom-Right */}
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-400 rounded-br-sm" />
      </div>

      {/* Center Viewfinder Crosshair */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-20">
        <div className="relative w-8 h-8">
          <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-amber-400 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-amber-400 -translate-x-1/2" />
          <div className="absolute inset-1.5 rounded-full border border-amber-400" />
        </div>
      </div>

      {/* Posing Guide Grid (Rule of Thirds) */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none opacity-20 z-10 transition-opacity">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div />
          </div>
        </div>
      )}

      {/* Safe Zone Guide Overlay (Visual Boundary for 10×15 cm Print Aspect Ratio) */}
      {showSafeZone && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          {/* 3:2 / 2:3 Safe boundary container */}
          <div className="relative w-[85%] h-[88%] border-2 border-dashed border-amber-400/40 rounded-2xl flex flex-col justify-between p-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-amber-300/70 uppercase tracking-widest px-1">
              <span>Batas Foto Aman</span>
              <span>Studio Quality</span>
            </div>
            <div className="flex justify-between items-center text-[9px] font-medium text-amber-300/50 px-1">
              <span>Posisi wajah dalam garis</span>
              <span>Minja Studio</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Stream Alert Banner */}
      {isSimulated && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-400/50 backdrop-blur-md shadow-xl text-amber-200 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">Mode Simulasi (Kamera belum terhubung / dibuka aplikasi lain)</span>
          {onRetryConnect && (
            <button
              type="button"
              onClick={onRetryConnect}
              className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] hover:bg-amber-300 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Hubungkan Ulang</span>
            </button>
          )}
        </div>
      )}

      {/* Top Overlay Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
        {/* Active Camera Device Indicator & Quick Switcher */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => devices.length > 1 && setIsDeviceMenuOpen((prev) => !prev)}
            className={`glass-panel px-3.5 py-1.5 rounded-2xl flex items-center gap-2 backdrop-blur-md transition-all ${
              devices.length > 1 ? 'cursor-pointer hover:bg-white/10 active:scale-95' : 'cursor-default'
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-300 max-w-[160px] truncate">
              {activeDevice?.name || 'Kamera Utama'}
            </span>
            <DeviceStatusBadge
              status={isSimulated ? 'demo' : activeDevice?.status || 'connected'}
              label={isSimulated ? 'Simulasi' : activeDevice?.status === 'connected' ? 'Aktif' : 'Siap'}
            />
            {devices.length > 1 && (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 -ml-0.5" />
            )}
          </button>

          {/* Quick Camera Dropdown Selection */}
          {isDeviceMenuOpen && devices.length > 1 && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-slate-900/95 border border-white/15 p-2 shadow-2xl backdrop-blur-xl z-50 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Kamera Aktif:
              </div>
              {devices.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    if (onSelectDevice) onSelectDevice(d.id);
                    setIsDeviceMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                    d.id === activeDevice?.id
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{d.name}</span>
                  {d.id === activeDevice?.id && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Floating Viewport Quick Controls (Mirror, Grid, Safe Zone Toggles) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {onToggleMirror && (
            <button
              type="button"
              onClick={onToggleMirror}
              title={isMirrored ? 'Mode Cermin Aktif (Klik untuk matikan)' : 'Mode Normal (Klik untuk cermin)'}
              className={`px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all backdrop-blur-md cursor-pointer ${
                isMirrored
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'glass-panel text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Cermin</span>
            </button>
          )}

          {onToggleGrid && (
            <button
              type="button"
              onClick={onToggleGrid}
              title="Garis Bantu Komposisi (Rule of Thirds)"
              className={`px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all backdrop-blur-md cursor-pointer ${
                showGrid
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'glass-panel text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          )}

          {onToggleSafeZone && (
            <button
              type="button"
              onClick={onToggleSafeZone}
              title="Panduan Area Cetak Aman (Safe Zone)"
              className={`px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all backdrop-blur-md cursor-pointer ${
                showSafeZone
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'glass-panel text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Area Cetak</span>
            </button>
          )}

          {/* Photo Counter Capsule */}
          <div className="glass-panel-elevated px-3.5 py-1.5 rounded-2xl flex items-center gap-2 border-amber-500/30 shadow-md">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Foto:
            </span>
            <span className="text-sm font-black font-mono text-amber-400">
              {photoCount} / {maxPhotos}
            </span>
          </div>
        </div>
      </div>


      {/* Center/Child Content (Countdown Overlay, etc.) */}
      {children}
    </div>
  );
};
