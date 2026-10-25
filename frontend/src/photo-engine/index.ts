// frontend/src/photo-engine/index.ts
// Facade Utama Dedicated Photo Engine (MinjaPhotobooth V2)

import { FrameComposition, RenderOptions, ExportedPhotoResult, CanvasDimensions } from './types';
import { assetLoader } from './assetLoader';
import { compositor } from './compositor';
import { FilterPipeline } from './filterPipeline';
import { HitTester } from './hitTester';
import { EditorHistoryManager } from './historyManager';
import { exportPipeline } from './exportPipeline';

export * from './types';
export * from './assetLoader';
export * from './filterPipeline';
export * from './compositor';
export * from './hitTester';
export * from './historyManager';
export * from './exportPipeline';

/**
 * Facade Utama Photo Engine untuk Akses Praktis & Terpadu
 */
export class PhotoEngine {
  public static readonly assets = assetLoader;
  public static readonly compositor = compositor;
  public static readonly filters = FilterPipeline;
  public static readonly hitTester = HitTester;
  public static readonly exporter = exportPipeline;

  /**
   * Membuat instance baru pengelola riwayat undo/redo
   */
  public static createHistoryManager(maxSnapshots = 25): EditorHistoryManager {
    return new EditorHistoryManager(maxSnapshots);
  }

  /**
   * Menghitung dimensi dan orientasi kanvas berdasarkan template
   */
  public static getDimensions(template: FrameComposition['template']): CanvasDimensions {
    return compositor.calculateDimensions(template);
  }

  /**
   * Render langsung komposisi ke elemen kanvas
   */
  public static async renderToCanvas(
    canvas: HTMLCanvasElement,
    composition: FrameComposition,
    options?: RenderOptions
  ): Promise<void> {
    return compositor.render(canvas, composition, options);
  }

  /**
   * Ekspor citra resolusi tinggi siap cetak 10×15 cm (300 DPI) secara headless
   */
  public static async exportPrintReady(
    composition: FrameComposition,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg',
    quality = 0.95
  ): Promise<ExportedPhotoResult> {
    return exportPipeline.exportPrintReady(composition, format, quality);
  }

  /**
   * Ekspor thumbnail ringan untuk pratinjau cepat
   */
  public static async exportThumbnail(
    composition: FrameComposition,
    maxDim = 400
  ): Promise<string> {
    return exportPipeline.exportThumbnail(composition, maxDim);
  }

  /**
   * Pre-warm / preload aset-aset foto untuk sesi editor
   */
  public static async preloadSession(urls: string[]): Promise<void> {
    return assetLoader.preloadAssets(urls);
  }

  /**
   * Bersihkan semua cache memori setelah sesi foto selesai
   */
  public static resetSession(): void {
    assetLoader.clearCache();
  }
}

export default PhotoEngine;
