import React from 'react';
import { Layout } from 'lucide-react';
import { TemplateItem } from '../../types/template';

export interface TemplateSelectorProps {
  templates: TemplateItem[];
  selectedTemplateId: string;
  onSelectTemplate: (template: TemplateItem) => void;
  slotPhotoMap?: Record<number, string>;
  previewPhotos?: string[];
  className?: string;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  slotPhotoMap = {},
  previewPhotos = [],
  className = '',
}) => {
  return (
    <div className={`glass-panel rounded-2xl p-4 border border-white/10 select-none ${className}`}>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Layout className="w-4 h-4 text-amber-400" />
          <span>Pilihan Desain Bingkai & Susunan Foto</span>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold">
          {templates.length} Pilihan Desain
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto p-3 rounded-2xl bg-black/40 border border-white/10 custom-scrollbar">
        {templates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          const isLandscape =
            tpl.layoutType === '4R_LANDSCAPE' ||
            (tpl as any).orientation === 'landscape' ||
            (tpl.width && tpl.height && tpl.width > tpl.height);
          const isStrip =
            tpl.layoutType === 'STRIP_2x6' ||
            (tpl as any).orientation === 'strip' ||
            (tpl.width && tpl.height && tpl.width / tpl.height < 0.5);

          const tplWidth = tpl.width || (isLandscape ? 1800 : isStrip ? 600 : 1200);
          const tplHeight = tpl.height || (isLandscape ? 1200 : isStrip ? 1800 : 1800);

          // Dimensi thumbnail kartu yang proporsional dan jelas terlihat
          const thumbWidth = isLandscape ? 180 : isStrip ? 68 : 120;
          const thumbHeight = isLandscape ? 120 : isStrip ? 204 : 180;
          const buttonWidth = thumbWidth + 24;

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelectTemplate(tpl)}
              style={{ width: buttonWidth }}
              className={`flex-shrink-0 flex flex-col items-center gap-2.5 p-3 rounded-2xl transition-all duration-150 touch-manipulation active:scale-95 ${
                isSelected
                  ? 'bg-amber-500/20 border-2 border-amber-400 shadow-glow-primary scale-102 ring-2 ring-white/30'
                  : 'glass-panel hover:bg-white/5 border border-white/15 hover:border-amber-400/40'
              }`}
            >
              {/* Template Thumbnail with Real Frame and Overlayed Photo Slots Layout */}
              <div
                style={{ width: thumbWidth, height: thumbHeight }}
                className={`relative rounded-xl bg-white border-2 overflow-hidden flex-shrink-0 shadow-lg transition-all ${
                  isSelected ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/20'
                }`}
              >
                {/* 1. Base Frame PNG / Decorative Layer (Design Template Asli) */}
                {tpl.frameUrl && tpl.frameUrl.trim().length > 0 ? (
                  <img
                    src={tpl.frameUrl}
                    alt={tpl.name}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                    loading="eager"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-slate-100 to-slate-200 z-0 flex items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold">Bingkai Polos</span>
                  </div>
                )}

                {/* 2. Photo Slot Rectangles Overlay (Susunan Layout Foto yang Jelas) */}
                <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  {tpl.slots.map((s, idx) => {
                    const leftPct = (s.x / tplWidth) * 100;
                    const topPct = (s.y / tplHeight) * 100;
                    const widthPct = (s.width / tplWidth) * 100;
                    const heightPct = (s.height / tplHeight) * 100;

                    // Foto yang terpasang atau preview foto sesi
                    const photo = isSelected
                      ? slotPhotoMap[idx] || previewPhotos[idx]
                      : previewPhotos[idx];

                    return (
                      <div
                        key={s.id || idx}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        className={`rounded-[3px] overflow-hidden flex items-center justify-center transition-all ${
                          photo
                            ? 'border-2 border-white/95 shadow-md relative'
                            : isSelected
                              ? 'border-2 border-amber-400 bg-slate-950/80 shadow-md ring-1 ring-amber-400/50'
                              : 'border-2 border-sky-400/90 bg-slate-950/75 shadow-sm'
                        }`}
                      >
                        {photo ? (
                          <>
                            <img
                              src={photo}
                              alt={`Slot #${idx + 1}`}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                            <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[8px] font-black text-amber-300 leading-none shadow">
                              #{idx + 1}
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-0.5 pointer-events-none">
                            <span
                              className={`text-[10px] font-black leading-none drop-shadow-md ${
                                isSelected ? 'text-amber-300' : 'text-sky-300'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span className="text-[7px] text-white/75 font-bold leading-none mt-0.5">
                              Foto
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. Badge indikator jika sedang dipilih */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black shadow-md flex items-center gap-0.5">
                    ✓ Aktif
                  </div>
                )}
              </div>

              {/* Template Name & Slot Count */}
              <div className="text-center w-full px-1">
                <span
                  className={`text-xs font-black block truncate ${
                    isSelected ? 'text-amber-400' : 'text-white'
                  }`}
                  title={tpl.name}
                >
                  {tpl.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold inline-block mt-1">
                  {tpl.slots.length} Foto
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

