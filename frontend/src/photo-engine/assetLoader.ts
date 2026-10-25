// frontend/src/photo-engine/assetLoader.ts
// Manajemen Caching dan Pemuatan Aset Gambar Resolusi Tinggi (Photo Engine)

export class PhotoAssetLoader {
  private static instance: PhotoAssetLoader;
  private cache: Map<string, HTMLImageElement> = new Map();
  private pendingPromises: Map<string, Promise<HTMLImageElement | null>> = new Map();
  private failedUrls: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): PhotoAssetLoader {
    if (!PhotoAssetLoader.instance) {
      PhotoAssetLoader.instance = new PhotoAssetLoader();
    }
    return PhotoAssetLoader.instance;
  }

  /**
   * Mengambil gambar dari cache memori, atau memuatnya secara asinkron jika belum ada.
   */
  public async getImage(url: string, timeoutMs = 1500): Promise<HTMLImageElement | null> {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return null;
    }

    const trimmedUrl = url.trim();

    // 0. Jangan coba memuat URL yang sebelumnya sudah gagal / 404 agar tidak membekukan kanvas
    if (this.failedUrls.has(trimmedUrl)) {
      return null;
    }

    // 1. Cek cache memori instan
    const cached = this.cache.get(trimmedUrl);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return cached;
    }

    // 2. Cek apakah gambar sedang dalam proses download (de-duplikasi request)
    const pending = this.pendingPromises.get(trimmedUrl);
    if (pending) {
      return pending;
    }

    // 3. Muat gambar baru dengan perlindungan timeout & CORS
    const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();

      // Atur crossOrigin hanya untuk URL http/https eksternal agar tidak memblokir data: atau blob:
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        this.pendingPromises.delete(trimmedUrl);
      };

      img.onload = () => {
        cleanup();
        this.cache.set(trimmedUrl, img);
        resolve(img);
      };

      img.onerror = (err) => {
        console.warn(`[PhotoAssetLoader] Gagal memuat aset gambar: ${trimmedUrl.slice(0, 60)}...`, err);
        cleanup();
        this.failedUrls.add(trimmedUrl);
        resolve(null);
      };

      timer = setTimeout(() => {
        console.warn(`[PhotoAssetLoader] Timeout (${timeoutMs}ms) memuat aset: ${trimmedUrl.slice(0, 60)}...`);
        cleanup();
        this.failedUrls.add(trimmedUrl);
        resolve(null);
      }, timeoutMs);

      img.src = trimmedUrl;

      // Cek apakah gambar base64 data URL selesai di-decode seketika
      if (img.complete && img.naturalWidth > 0) {
        cleanup();
        this.cache.set(trimmedUrl, img);
        resolve(img);
      }
    });

    this.pendingPromises.set(trimmedUrl, loadPromise);
    return loadPromise;
  }

  /**
   * Pre-warm / Pre-decode daftar URL foto atau frame di awal sesi agar tidak terjadi kedipan layar
   */
  public async preloadAssets(urls: string[]): Promise<void> {
    const validUrls = urls.filter((u) => Boolean(u && u.trim().length > 0));
    await Promise.all(validUrls.map((u) => this.getImage(u)));
  }

  /**
   * Memeriksa apakah gambar sudah ada di cache dan siap digambar
   */
  public isCached(url: string): boolean {
    const img = this.cache.get(url.trim());
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  /**
   * Membersihkan seluruh cache memori gambar (dipanggil saat sesi pelanggan reset/selesai)
   */
  public clearCache(): void {
    this.cache.clear();
    this.pendingPromises.clear();
    this.failedUrls.clear();
  }

  /**
   * Menghapus URL spesifik dari cache
   */
  public invalidate(url: string): void {
    this.cache.delete(url.trim());
    this.failedUrls.delete(url.trim());
  }
}

export const assetLoader = PhotoAssetLoader.getInstance();
