import React from 'react';
import { Clock, Printer, CheckCircle2, Sparkles } from 'lucide-react';
import { PackageItem } from '../../types/package';
import { Button } from '../common/Button';

export interface PackageCardProps {
  pkg: PackageItem;
  isSelected?: boolean;
  onSelect: (pkg: PackageItem) => void;
  isLoading?: boolean;
}

export const PackageCard: React.FC<PackageCardProps> = ({
  pkg,
  isSelected = false,
  onSelect,
  isLoading = false,
}) => {
  const formatPrice = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins} Menit ${secs} Dtk`;
    if (mins > 0) return `${mins} Menit`;
    return `${secs} Detik`;
  };

  return (
    <div
      onClick={() => onSelect(pkg)}
      className={`group relative flex flex-col justify-between p-7 rounded-3xl cursor-pointer select-none touch-manipulation transition-all duration-300 active:scale-[0.98] ${
        isSelected
          ? 'bg-amber-500/[0.08] border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
          : 'bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-amber-400/40 hover:bg-white/[0.06] shadow-lg'
      }`}
    >
      {/* Top Badge */}
      {pkg.badge && (
        <div className="absolute -top-3 left-6 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20">
          <Sparkles className="w-3 h-3 fill-current" />
          <span>{pkg.badge}</span>
        </div>
      )}

      {/* Package Header & Price */}
      <div>
        <div className="flex items-start justify-between mb-4 mt-1">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-amber-200 transition-colors">
              {pkg.name}
            </h3>
            {pkg.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {pkg.description}
              </p>
            )}
          </div>
          {isSelected && (
            <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0 animate-in fade-in zoom-in">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
            </div>
          )}
        </div>

        {/* Minimalist Price Display */}
        <div className="py-5 my-2 border-y border-white/10 flex items-baseline gap-2">
          <span className="text-4xl font-black text-amber-400 tracking-tight">
            {formatPrice(pkg.price)}
          </span>
          <span className="text-xs text-slate-400 font-medium">/ sesi</span>
        </div>

        {/* Core Specs: Hanya Berapa Lama Sesi & Jumlah Cetak */}
        <div className="grid grid-cols-2 gap-3 my-5">
          {/* Sesi Durasi */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Lama Sesi
              </span>
            </div>
            <span className="text-base font-extrabold text-white">
              {formatDuration(pkg.durationSeconds)}
            </span>
          </div>

          {/* Jumlah Cetak */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Jumlah Cetak
              </span>
            </div>
            <span className="text-base font-extrabold text-white">
              {pkg.printCopies} Lembar Cetak
            </span>
          </div>
        </div>
      </div>

      {/* Select CTA Button */}
      <div className="mt-4 pt-1">
        <Button
          variant={isSelected ? 'gold' : 'secondary'}
          size="lg"
          className="w-full text-sm font-bold tracking-wide"
          isLoading={isLoading && isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(pkg);
          }}
        >
          {isSelected ? 'Paket Terpilih ✓' : 'Pilih Paket'}
        </Button>
      </div>
    </div>
  );
};
