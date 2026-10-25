// frontend/src/photo-engine/filterPipeline.ts
// Pipeline Filter Warna & Grading Studio Foto (Photo Engine)

import { FilterPreset, PhotoAdjustment, SlotAdjustment } from '../types/editor';

export interface FilterDefinition {
  id: FilterPreset;
  name: string;
  description: string;
  cssFilter: string;
}

export const STUDIO_FILTER_DEFINITIONS: Record<FilterPreset, FilterDefinition> = {
  normal: {
    id: 'normal',
    name: 'Original',
    description: 'Warna Asli Natural Studio',
    cssFilter: 'none',
  },
  glamour: {
    id: 'glamour',
    name: 'Glamour Glow',
    description: 'Glowing Estetik dengan Kontras Lembut',
    cssFilter: 'contrast(106%) brightness(108%) saturate(118%)',
  },
  bw: {
    id: 'bw',
    name: 'Classic B & W',
    description: 'Hitam Putih Sinematik & Elegan',
    cssFilter: 'grayscale(100%) contrast(115%)',
  },
  warm: {
    id: 'warm',
    name: 'Warm Sun',
    description: 'Sentuhan Hangat Golden Hour',
    cssFilter: 'sepia(25%) saturate(135%) brightness(102%)',
  },
  cool: {
    id: 'cool',
    name: 'Cool Blue',
    description: 'Nuansa Sejuk Modern & Bersih',
    cssFilter: 'hue-rotate(180deg) saturate(110%) brightness(103%)',
  },
  sepia: {
    id: 'sepia',
    name: 'Vintage Sepia',
    description: 'Nostalgia Retro Bernuansa Klasik',
    cssFilter: 'sepia(80%) hue-rotate(-20deg) contrast(105%)',
  },
};

export class FilterPipeline {
  /**
   * Menghasilkan string filter Canvas 2D standar gabungan antara
   * preset gaya + penyesuaian kecerahan & kontras (global + per-slot).
   */
  public static buildCanvasFilterString(
    filter: FilterPreset,
    globalAdj?: PhotoAdjustment,
    slotAdj?: SlotAdjustment
  ): string {
    const parts: string[] = [];

    // 1. Kalkulasi Kecerahan (Default 100%)
    const globalBrightness = globalAdj?.brightness || 0;
    const slotBrightness = slotAdj?.brightness || 0;
    const totalBrightness = Math.max(0, 100 + globalBrightness + slotBrightness);
    if (totalBrightness !== 100) {
      parts.push(`brightness(${totalBrightness}%)`);
    }

    // 2. Kalkulasi Kontras (Default 100%)
    const globalContrast = globalAdj?.contrast || 0;
    const slotContrast = slotAdj?.contrast || 0;
    const totalContrast = Math.max(0, 100 + globalContrast + slotContrast);
    if (totalContrast !== 100) {
      parts.push(`contrast(${totalContrast}%)`);
    }

    // 3. Tambahkan Preset Studio
    const activePreset = slotAdj?.filter || filter || 'normal';
    const def = STUDIO_FILTER_DEFINITIONS[activePreset];

    if (def && def.cssFilter !== 'none') {
      parts.push(def.cssFilter);
    }

    return parts.length > 0 ? parts.join(' ').trim() : 'none';
  }

  /**
   * Mendapatkan definisi lengkap filter
   */
  public static getDefinition(preset: FilterPreset): FilterDefinition {
    return STUDIO_FILTER_DEFINITIONS[preset] || STUDIO_FILTER_DEFINITIONS.normal;
  }
}
