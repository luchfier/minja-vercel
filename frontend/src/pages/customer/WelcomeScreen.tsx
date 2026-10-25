import React, { useState } from 'react';
import { Sparkles, Camera, ArrowRight, Shield } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { KioskBackground } from '../../components/common/KioskBackground';

export interface WelcomeScreenProps {
  onStartSession: () => void;
  onAdminTrigger?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartSession,
  onAdminTrigger,
}) => {
  const { branding } = useTheme();
  const [tapCount, setTapCount] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  // Hidden admin gesture: 5 taps within 3 seconds
  const handleLogoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapTime > 3000) {
      setTapCount(1);
    } else {
      const nextCount = tapCount + 1;
      setTapCount(nextCount);
      if (nextCount >= 5) {
        setTapCount(0);
        if (onAdminTrigger) onAdminTrigger();
      }
    }
    setLastTapTime(now);
  };

  const handleStartSession = () => {
    onStartSession();
  };

  return (
    <div
      onClick={handleStartSession}
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between p-12 select-none bg-background cursor-pointer"
    >
      {/* Dynamic Background Wallpaper / Ambient Glow / Live Blur & Dimming */}
      <KioskBackground />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div
          onClick={handleLogoTap}
          className="flex items-center gap-4 cursor-pointer touch-manipulation active:scale-95 transition-transform"
          title="Ketuk 5x untuk menu admin"
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.boothName}
              style={{ height: `${branding.logoHeight ?? 64}px` }}
              className="w-auto object-contain rounded-2xl drop-shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-glow-primary font-black text-3xl">
              M
            </div>
          )}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              {branding.boothName}
            </h2>
            <p className="text-xs text-slate-400 font-semibold">{branding.tagline}</p>
          </div>
        </div>

        {/* Header Right: Admin Tap Feedback */}
        <div className="flex items-center gap-3">
          {/* Secret tap feedback dot (subtle) */}
          {tapCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 text-xs text-amber-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Verifikasi: {tapCount}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Center Hero Attraction Section */}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center my-auto">
        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border-amber-500/30 text-amber-300 text-sm font-bold mb-6 shadow-md">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Self-Service Photobooth Kiosk</span>
        </div>

        {/* Dynamic Welcome Headlines from Config */}
        <h1 className="text-6xl font-black text-white tracking-tight leading-tight mb-6 drop-shadow-md">
          {branding.welcomeHeadline}
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl font-medium leading-relaxed mb-10">
          {branding.welcomeSubheadline}
        </p>

        {/* Primary Start Session CTA Button (Touch target 68px) */}
        <div className="w-full max-w-md">
          <Button
            variant="gold"
            size="xl"
            onClick={handleStartSession}
            rightIcon={<ArrowRight className="w-6 h-6 stroke-[2.5]" />}
            className="w-full text-2xl py-6 shadow-2xl"
          >
            {branding.startSessionButtonText}
          </Button>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>Kamera Studio High Definition</span>
          </span>
          <span>•</span>
          <span>Cetak Instan Kualitas Studio (Lab Quality)</span>
          <span>•</span>
          <span>Soft File QR & Email Otomatis</span>
        </div>

        <div>
          <span>Sentuh layar di mana saja untuk memulai</span>
        </div>
      </div>
    </div>
  );
};
