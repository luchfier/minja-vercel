// frontend/src/photo-engine/exportPipeline.ts
// Pipeline Ekspor Headless & Cetak Resolusi Tinggi 300 DPI 10×15 cm (Photo Engine)

import { FrameComposition, ExportedPhotoResult } from './types';
import { PhotoCompositor } from './compositor';

export class PhotoExportPipeline {
  private static instance: PhotoExportPipeline;
  private compositor: PhotoCompositor;

  private constructor() {
    this.compositor = PhotoCompositor.getInstance();
  }

  public static getInstance(): PhotoExportPipeline {
    if (!PhotoExportPipeline.instance) {
      PhotoExportPipeline.instance = new PhotoExportPipeline();
    }
    return PhotoExportPipeline.instance;
  }

  /**
   * Mengekspor satu komposisi secara headless (tanpa bergantung elemen DOM di layar)
   * menghasilkan citra 300 DPI siap cetak 10×15 cm (4R borderless)
   */
  public async exportPrintReady(
    composition: FrameComposition,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg',
    quality = 0.95
  ): Promise<ExportedPhotoResult> {
    const { width, height } = this.compositor.calculateDimensions(composition.template);

    // Buat kanvas headless
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Render dengan flag isExport: true (bersihkan elemen bantuan / hint sentuh)
    await this.compositor.render(canvas, composition, {
      isExport: true,
      showEmptySlotHints: false,
      selectedSlotHighlight: false,
    });

    const dataUrl = canvas.toDataURL(format, quality);

    // Hitung ukuran fisik dalam cm pada 300 DPI (1 inci = 2.54 cm -> 300 px/inci = 118.11 px/cm)
    const pxPerCm = 300 / 2.54;
    const widthCm = Number((width / pxPerCm).toFixed(1));
    const heightCm = Number((height / pxPerCm).toFixed(1));

    // Perkiraan ukuran bita dari string base64
    const approxBytes = Math.round((dataUrl.length * 3) / 4);

    return {
      dataUrl,
      width,
      height,
      dpi: 300,
      dimensionsCm: {
        width: widthCm,
        height: heightCm,
      },
      sizeBytesApprox: approxBytes,
    };
  }

  /**
   * Mengekspor thumbnail ringan untuk pratinjau cepat di galeri
   */
  public async exportThumbnail(
    composition: FrameComposition,
    maxDim = 400
  ): Promise<string> {
    const { width, height } = this.compositor.calculateDimensions(composition.template);
    const scale = maxDim / Math.max(width, height);
    const thumbW = Math.round(width * scale);
    const thumbH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;

    // Render skala penuh terlebih dahulu pada canvas perantara
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;

    await this.compositor.render(fullCanvas, composition, {
      isExport: true,
      showEmptySlotHints: false,
      selectedSlotHighlight: false,
    });

    // Salin ke thumbnail dengan penyesuaian interpolasi lembut
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(fullCanvas, 0, 0, thumbW, thumbH);
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    return fullCanvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Mengekspor kumpulan multi-desain frame foto secara paralel
   */
  public async exportBatch(
    compositions: FrameComposition[],
    format: 'image/jpeg' | 'image/png' = 'image/jpeg',
    quality = 0.95
  ): Promise<ExportedPhotoResult[]> {
    return Promise.all(
      compositions.map((comp) => this.exportPrintReady(comp, format, quality))
    );
  }
}

export const exportPipeline = PhotoExportPipeline.getInstance();
