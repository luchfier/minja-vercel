// frontend/src/photo-engine/types.ts
// Tipe Data dan Kontrak untuk Dedicated Photo Engine (MinjaPhotobooth V2)

import { TemplateItem, PhotoSlot } from '../types/template';
import { FilterPreset, PhotoAdjustment, SlotAdjustment, StickerElement, TextElement } from '../types/editor';

/** Konfigurasi Standar Engine Cetak 10×15 cm (4R) pada 300 DPI */
export interface PhotoEngineConfig {
  dpi: number;                  // Default 300 DPI
  standardWidthPx: number;      // 1200 px (10 cm pada 300 DPI)
  standardHeightPx: number;     // 1800 px (15 cm pada 300 DPI)
  landscapeWidthPx: number;     // 1800 px (15 cm pada 300 DPI)
  landscapeHeightPx: number;    // 1200 px (10 cm pada 300 DPI)
  stripWidthPx: number;         // 600 px (5 cm / 2 inch pada 300 DPI)
  stripHeightPx: number;        // 1800 px (15 cm / 6 inch pada 300 DPI)
}

/** Dimensi Canvas Terhitung Berdasarkan Template */
export interface CanvasDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape';
}

/** Komposisi Lengkap Desain Frame Foto */
export interface FrameComposition {
  template: TemplateItem;
  photoUrls: string[];
  filter: FilterPreset;
  adjustments: PhotoAdjustment;
  slotAdjustments: Record<number, SlotAdjustment>;
  stickers: StickerElement[];
  texts: TextElement[];
  selectedSlotIndex?: number | null;
}

/** Opsi Render Kanvas */
export interface RenderOptions {
  isExport?: boolean;           // Jika true, render kualitas cetak tanpa indikator/panduan interaktif
  scale?: number;               // Faktor skala (misal 1.0 untuk 300 DPI)
  quality?: number;             // Kualitas kompresi JPEG (0.1 - 1.0, default 0.95)
  showEmptySlotHints?: boolean; // Tampilkan teks "+ Slot Foto #N" jika kosong
  selectedSlotHighlight?: boolean;
}

/** Hasil Hit-Test Sentuhan Layar */
export type HitTargetType = 'slot' | 'sticker' | 'text' | 'none';

export interface HitTestResult {
  type: HitTargetType;
  id?: string;
  slotIndex?: number;
  slot?: PhotoSlot;
  sticker?: StickerElement;
  text?: TextElement;
  canvasX: number;
  canvasY: number;
}

/** Snapshot Histori untuk Undo / Redo */
export interface HistorySnapshot {
  id: string;
  timestamp: number;
  filter: FilterPreset;
  adjustments: PhotoAdjustment;
  slotAdjustments: Record<number, SlotAdjustment>;
  stickers: StickerElement[];
  texts: TextElement[];
  templateId: string;
}

/** Hasil Ekspor File Siap Cetak 4R */
export interface ExportedPhotoResult {
  dataUrl: string;
  width: number;
  height: number;
  dpi: number;
  dimensionsCm: {
    width: number;
    height: number;
  };
  sizeBytesApprox: number;
}
