// frontend/src/photo-engine/compositor.ts
// Engine Render Komposisi Kanvas 2D Resolusi Tinggi (10×15 cm 300 DPI)

import { TemplateItem, PhotoSlot } from '../types/template';
import { FrameComposition, RenderOptions, CanvasDimensions } from './types';
import { PhotoAssetLoader } from './assetLoader';
import { FilterPipeline } from './filterPipeline';

export class PhotoCompositor {
  private static instance: PhotoCompositor;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private assetLoader: PhotoAssetLoader;

  private constructor() {
    this.assetLoader = PhotoAssetLoader.getInstance();
  }

  public static getInstance(): PhotoCompositor {
    if (!PhotoCompositor.instance) {
      PhotoCompositor.instance = new PhotoCompositor();
    }
    return PhotoCompositor.instance;
  }

  /**
   * Menghitung dimensi kanvas yang tepat berdasarkan spesifikasi template (10×15 cm pada 300 DPI)
   */
  public calculateDimensions(template: TemplateItem): CanvasDimensions {
    let width = template.width || 1200;
    let height = template.height || 1800;

    // Deteksi orientasi otomatis dari layoutType jika dimensi belum disetel
    if (!template.width || !template.height) {
      if (template.layoutType === '4R_LANDSCAPE') {
        width = 1800;
        height = 1200;
      } else if (template.layoutType === 'STRIP_2x6') {
        width = 600;
        height = 1800;
      } else {
        width = 1200;
        height = 1800;
      }
    }

    return {
      width,
      height,
      aspectRatio: width / height,
      orientation: width >= height ? 'landscape' : 'portrait',
    };
  }

  /**
   * Mengambil atau membuat in-memory offscreen canvas untuk double buffering
   */
  private getOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    if (this.offscreenCanvas.width !== width) this.offscreenCanvas.width = width;
    if (this.offscreenCanvas.height !== height) this.offscreenCanvas.height = height;
    return this.offscreenCanvas;
  }

  /**
   * Melakukan render penuh komposisi frame foto ke target Canvas HTML5
   */
  public async render(
    targetCanvas: HTMLCanvasElement,
    composition: FrameComposition,
    options: RenderOptions = {}
  ): Promise<void> {
    const { template, photoUrls, filter, adjustments, slotAdjustments, stickers, texts, selectedSlotIndex } = composition;
    const { width: targetWidth, height: targetHeight } = this.calculateDimensions(template);

    // Pastikan ukuran target canvas sesuai
    if (targetCanvas.width !== targetWidth) targetCanvas.width = targetWidth;
    if (targetCanvas.height !== targetHeight) targetCanvas.height = targetHeight;

    const mainCtx = targetCanvas.getContext('2d');
    if (!mainCtx) return;

    // Siapkan offscreen buffer untuk atomic blit (zero-flicker)
    const offscreen = this.getOffscreenCanvas(targetWidth, targetHeight);
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // 1. Pemuatan Asinkron Semua Aset Gambar (Foto Slot, Frame Overlay, Sticker Gambar)
    const slotUrls = photoUrls.slice(0, template.slots.length);
    const stickerImgUrls = stickers
      .filter((s) => s.url.startsWith('data:image/') || s.url.startsWith('http://') || s.url.startsWith('https://') || s.url.includes('.png'))
      .map((s) => s.url);

    const [loadedPhotos, frameImg, ...loadedStickers] = await Promise.all([
      Promise.all(slotUrls.map((u) => (u ? this.assetLoader.getImage(u) : Promise.resolve(null)))),
      template.frameUrl ? this.assetLoader.getImage(template.frameUrl) : Promise.resolve(null),
      ...stickerImgUrls.map((u) => this.assetLoader.getImage(u)),
    ]);

    // Map sticker URL -> HTMLImageElement
    const stickerImgMap = new Map<string, HTMLImageElement>();
    stickerImgUrls.forEach((url, idx) => {
      const img = loadedStickers[idx];
      if (img) stickerImgMap.set(url, img);
    });

    // 2. LAYER 0: Canvas Background & Border Studio
    ctx.save();
    ctx.fillStyle = '#0F131D';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.strokeStyle = '#263147';
    ctx.lineWidth = 16;
    ctx.strokeRect(16, 16, targetWidth - 32, targetHeight - 32);
    ctx.restore();

    // 3. LAYER 1: Photo Slots (Foto, Crop, Zoom, Pan, Rotation, Per-slot Filters)
    template.slots.forEach((slot: PhotoSlot, index: number) => {
      const img = loadedPhotos[index];
      const slotAdj = slotAdjustments[index] || {
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
        brightness: 0,
        contrast: 0,
      };
      const isSlotSelected = selectedSlotIndex === index && !options.isExport;

      ctx.save();
      ctx.beginPath();
      const cornerRadius = 24;
      ctx.roundRect(slot.x, slot.y, slot.width, slot.height, cornerRadius);
      ctx.clip();

      ctx.fillStyle = '#182032';
      ctx.fillRect(slot.x, slot.y, slot.width, slot.height);

      if (img && img.naturalWidth > 0) {
        // Terapkan filter grading studio
        ctx.filter = FilterPipeline.buildCanvasFilterString(filter, adjustments, slotAdj);

        // Transformasi rotasi & pergeseran pan slot
        const totalRot = ((adjustments.rotation || 0) + (slotAdj.rotation || 0) + 360) % 360;
        ctx.translate(
          slot.x + slot.width / 2 + (slotAdj.panX || 0),
          slot.y + slot.height / 2 + (slotAdj.panY || 0)
        );
        ctx.rotate((totalRot * Math.PI) / 180);

        // Aspect Fill (Cover) Math
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const slotAspect = slot.width / slot.height;
        let baseW = slot.width;
        let baseH = slot.height;

        if (imgAspect > slotAspect) {
          baseW = slot.height * imgAspect;
        } else {
          baseH = slot.width / imgAspect;
        }

        const zoom = Math.max(1.0, slotAdj.zoom || 1.0);
        const drawW = baseW * zoom;
        const drawH = baseH * zoom;

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else if (!options.isExport && options.showEmptySlotHints !== false) {
        // Placeholder Slot Kosong Interaktif
        ctx.fillStyle = isSlotSelected ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(slot.x, slot.y, slot.width, slot.height);

        // Header slot indicator
        ctx.fillStyle = isSlotSelected ? '#38BDF8' : 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+ Pasang Foto #${index + 1}`, slot.x + slot.width / 2, slot.y + slot.height / 2 - 14);

        // Subtitle helper text
        ctx.fillStyle = isSlotSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.6)';
        ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`Sentuh disini untuk pasang foto`, slot.x + slot.width / 2, slot.y + slot.height / 2 + 24);
      }
      ctx.restore();

      // Border Slot / Highlight Pemilihan
      if (isSlotSelected && options.selectedSlotHighlight !== false) {
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.width, slot.height, cornerRadius);
        ctx.stroke();
        ctx.restore();
      } else if (!frameImg || !template.frameUrl || template.frameUrl.trim().length === 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.width, slot.height, cornerRadius);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 4. LAYER 2: Frame PNG Overlay (Transparan di atas foto)
    if (frameImg && frameImg.naturalWidth > 0) {
      // Gunakan offscreen buffer untuk memotong (punch out) area slot foto,
      // mencegah frame PNG solid/non-transparan dari menutupi foto pelanggan di bawahnya
      try {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = targetWidth;
        frameCanvas.height = targetHeight;
        const fCtx = frameCanvas.getContext('2d');
        if (fCtx) {
          fCtx.drawImage(frameImg, 0, 0, targetWidth, targetHeight);
          // Punch out cutout slot foto
          template.slots.forEach((slot) => {
            fCtx.save();
            fCtx.globalCompositeOperation = 'destination-out';
            fCtx.beginPath();
            const punchRadius = 14;
            fCtx.roundRect(slot.x + 3, slot.y + 3, slot.width - 6, slot.height - 6, punchRadius);
            fCtx.fill();
            fCtx.restore();
          });
          ctx.drawImage(frameCanvas, 0, 0);
        } else {
          ctx.drawImage(frameImg, 0, 0, targetWidth, targetHeight);
        }
      } catch {
        ctx.drawImage(frameImg, 0, 0, targetWidth, targetHeight);
      }
    }

    // 5. LAYER 3: Decorative Stickers (Sticker PNG atau Emoji)
    stickers.forEach((sticker) => {
      ctx.save();
      ctx.translate(sticker.x, sticker.y);
      ctx.rotate(((sticker.rotation || 0) * Math.PI) / 180);
      ctx.scale(sticker.scale || 1, sticker.scale || 1);

      const isImage =
        sticker.url.startsWith('data:image/') ||
        sticker.url.startsWith('http://') ||
        sticker.url.startsWith('https://') ||
        sticker.url.includes('.png');

      if (isImage) {
        const cachedImg = stickerImgMap.get(sticker.url) || this.assetLoader.getImage(sticker.url);
        if (cachedImg instanceof HTMLImageElement && cachedImg.naturalWidth > 0) {
          const imgAspect = cachedImg.naturalWidth / cachedImg.naturalHeight;
          let drawW = 90;
          let drawH = 90;
          if (imgAspect > 1) {
            drawH = 90 / imgAspect;
          } else {
            drawW = 90 * imgAspect;
          }
          ctx.drawImage(cachedImg, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      } else {
        // Render Karakter Emoji
        ctx.font = '72px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.url, 0, 0);
      }
      ctx.restore();
    });

    // 6. LAYER 4: Custom Text Typography
    texts.forEach((txt) => {
      ctx.save();
      ctx.translate(txt.x, txt.y);
      ctx.rotate(((txt.rotation || 0) * Math.PI) / 180);

      ctx.font = `bold ${(txt.fontSize || 34) * 1.5}px "${txt.fontFamily || 'Plus Jakarta Sans'}", sans-serif`;
      ctx.fillStyle = txt.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 8;
      ctx.fillText(txt.text, 0, 0);
      ctx.restore();
    });

    // 7. Atomic Blit: Salin hasil offscreen ke canvas target (Bebas Flicker 60 FPS)
    mainCtx.clearRect(0, 0, targetWidth, targetHeight);
    mainCtx.drawImage(offscreen, 0, 0);
  }
}

export const compositor = PhotoCompositor.getInstance();
