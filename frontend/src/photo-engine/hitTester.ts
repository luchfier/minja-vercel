// frontend/src/photo-engine/hitTester.ts
// Engine Deteksi Sentuhan Layar & Matematika Koordinat Canvas (Photo Engine)

import { TemplateItem } from '../types/template';
import { StickerElement, TextElement } from '../types/editor';
import { HitTestResult } from './types';

export class HitTester {
  /**
   * Mengubah koordinat pointer layar (clientX, clientY) ke koordinat internal Canvas (misal 1200×1800 px)
   */
  public static getCanvasCoordinates(
    clientX: number,
    clientY: number,
    canvasElement: HTMLCanvasElement,
    canvasWidth = 1200,
    canvasHeight = 1800
  ): { x: number; y: number } {
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { x: 0, y: 0 };
    }
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  /**
   * Melakukan hit-testing secara komprehensif terhadap elemen yang disentuh di kanvas
   */
  public static test(
    canvasX: number,
    canvasY: number,
    template: TemplateItem,
    stickers: StickerElement[],
    texts: TextElement[]
  ): HitTestResult {
    // 1. Cek Stiker (Prioritas teratas, urutan terbalik dari yang paling atas)
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      const radius = 65 * (s.scale || 1);
      const dist = Math.hypot(canvasX - s.x, canvasY - s.y);
      if (dist <= radius) {
        return {
          type: 'sticker',
          id: s.id,
          sticker: s,
          canvasX,
          canvasY,
        };
      }
    }

    // 2. Cek Teks Kustom
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const approxRadius = Math.max(60, (t.fontSize || 32) * 1.5);
      const dist = Math.hypot(canvasX - t.x, canvasY - t.y);
      if (dist <= approxRadius) {
        return {
          type: 'text',
          id: t.id,
          text: t,
          canvasX,
          canvasY,
        };
      }
    }

    // 3. Cek Slot Foto
    if (template && template.slots) {
      for (let i = 0; i < template.slots.length; i++) {
        const slot = template.slots[i];
        if (
          canvasX >= slot.x &&
          canvasX <= slot.x + slot.width &&
          canvasY >= slot.y &&
          canvasY <= slot.y + slot.height
        ) {
          return {
            type: 'slot',
            slotIndex: i,
            slot,
            canvasX,
            canvasY,
          };
        }
      }
    }

    // 4. Sentuhan di luar elemen apapun
    return {
      type: 'none',
      canvasX,
      canvasY,
    };
  }
}
