import { CameraDeviceInfo } from '../types/hardware';

const PREFERRED_CAMERA_KEY = 'minja_preferred_camera_id';

export interface ICameraAdapter {
  listDevices(): Promise<CameraDeviceInfo[]>;
  startLiveView(videoElement: HTMLVideoElement, deviceId?: string): Promise<boolean>;
  stopLiveView(): void;
  capturePhoto(isMirrored?: boolean): Promise<string>; // returns data URL (JPEG 0.98)
  getPreferredDeviceId(): string | null;
  setPreferredDeviceId(deviceId: string): void;
  getActiveDeviceId(): string | null;
  onDeviceChange(callback: () => void): () => void;
  isUsingSimulatedStream(): boolean;
  getLastError(): string | null;
}

class CameraAdapterService implements ICameraAdapter {
  private activeStream: MediaStream | null = null;
  private activeVideoElement: HTMLVideoElement | null = null;
  private prewarmedStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private activeDeviceId: string | null = null;
  private isSimulated = false;
  private lastError: string | null = null;

  getPreferredDeviceId(): string | null {
    try {
      return localStorage.getItem(PREFERRED_CAMERA_KEY);
    } catch {
      return null;
    }
  }

  setPreferredDeviceId(deviceId: string): void {
    try {
      localStorage.setItem(PREFERRED_CAMERA_KEY, deviceId);
    } catch (e) {
      console.warn('Gagal menyimpan preferred camera id:', e);
    }
  }

  getActiveDeviceId(): string | null {
    return this.activeDeviceId;
  }

  isUsingSimulatedStream(): boolean {
    return this.isSimulated;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  onDeviceChange(callback: () => void): () => void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', callback);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', callback);
      };
    }
    return () => {};
  }

  /**
   * Mengambil daftar perangkat input kamera yang tersedia di sistem.
   */
  async listDevices(): Promise<CameraDeviceInfo[]> {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.enumerateDevices === 'function') {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let videoDevices = devices.filter((d) => d.kind === 'videoinput');

        // Jika browser/Electron belum memiliki izin kamera, minta izin sekali dan simpan stream-nya
        const hasEmptyLabels = videoDevices.some((d) => !d.label || d.label.trim() === '');
        if (hasEmptyLabels && typeof navigator.mediaDevices?.getUserMedia === 'function') {
          try {
            if (!this.prewarmedStream || !this.prewarmedStream.active) {
              this.prewarmedStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            }
            devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter((d) => d.kind === 'videoinput');
          } catch (e) {
            console.warn('[CameraAdapter] Izin akses getUserMedia belum diberikan:', e);
          }
        }

        if (videoDevices.length > 0) {
          const preferredId = this.getPreferredDeviceId();

          return videoDevices.map((d, index) => {
            const labelLower = (d.label || '').toLowerCase();
            const isCanonOrDslr =
              labelLower.includes('canon') ||
              labelLower.includes('nikon') ||
              labelLower.includes('sony') ||
              labelLower.includes('cam link') ||
              labelLower.includes('capture') ||
              labelLower.includes('hdmi') ||
              labelLower.includes('dslr') ||
              labelLower.includes('elgato');
            const isVirtual =
              labelLower.includes('obs') ||
              labelLower.includes('virtual') ||
              labelLower.includes('camo') ||
              labelLower.includes('manycam');
            const isDroidCam = labelLower.includes('droidcam');

            const isSelected = preferredId ? d.deviceId === preferredId : index === 0;

            let displayName = d.label;
            if (!displayName || displayName.trim() === '') {
              displayName = isDroidCam
                ? 'DroidCam Video'
                : `Kamera Fisik ${index + 1}`;
            }

            return {
              id: d.deviceId || `cam-${index}`,
              name: displayName,
              type: isCanonOrDslr ? 'dslr' : isVirtual ? 'virtual' : isDroidCam ? 'external' : 'webcam',
              status: 'connected',
              isDefault: isSelected,
              resolution: 'Auto HD',
            };
          });
        }
      }
    } catch (e) {
      console.warn('Gagal enumerasi perangkat kamera fisik:', e);
    }

    return [];
  }

  /**
   * Multi-Stage Fallback Constraint Ladder:
   * Menjamin kamera USB, DroidCam, OBS VirtualCam, hingga Canon EOS Webcam Utility
   * terbuka mulus tanpa terhalang OverconstrainedError.
   */
  private async acquireStream(deviceId?: string): Promise<MediaStream> {
    // Abaikan ID dummy / sintesis seperti "cam-0"
    const validDeviceId = (deviceId && !deviceId.startsWith('cam-') && deviceId.trim().length > 0) ? deviceId : undefined;

    const attempts: MediaStreamConstraints[] = [
      // 1. Studio Full HD 1080p dengan ideal constraint
      {
        video: validDeviceId
          ? {
              deviceId: { ideal: validDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            }
          : {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            },
        audio: false,
      },
      // 2. Standard HD 720p
      {
        video: validDeviceId
          ? {
              deviceId: { ideal: validDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      },
      // 3. Relaxed Device Match (Cocok untuk DroidCam, Canon EOS utility 480p/576p)
      {
        video: validDeviceId ? { deviceId: { ideal: validDeviceId } } : true,
        audio: false,
      },
      // 4. Fallback umum ke perangkat video apa pun yang tersedia di OS
      {
        video: true,
        audio: false,
      },
    ];

    let lastErr: any = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
        return stream;
      } catch (err: any) {
        lastErr = err;
        console.info(`[CameraAdapter] Percobaan constraint #${i + 1} belum berhasil:`, err?.message || err);
      }
    }

    throw lastErr || new Error('Tidak ada stream kamera yang dapat diakses.');
  }

  /**
   * Memulai live view kamera ke elemen <video>.
   */
  async startLiveView(videoElement: HTMLVideoElement, targetDeviceId?: string): Promise<boolean> {
    this.activeVideoElement = videoElement;

    const preferredId = this.getPreferredDeviceId();
    const rawDeviceId = targetDeviceId || preferredId || undefined;
    const deviceId = (rawDeviceId && !rawDeviceId.startsWith('cam-') && rawDeviceId.trim().length > 0) ? rawDeviceId : undefined;

    // 1. Jika activeStream sudah ada dan masih aktif pada device yang sama, pasang langsung
    if (this.activeStream && this.activeStream.active && !this.isSimulated) {
      const currentTrack = this.activeStream.getVideoTracks()[0];
      const currentDeviceId = currentTrack?.getSettings?.()?.deviceId;
      if (!deviceId || currentDeviceId === deviceId) {
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
        videoElement.srcObject = this.activeStream;
        await videoElement.play().catch(() => {});
        this.isSimulated = false;
        return true;
      }
    }

    // Hentikan simulasi canvas jika sebelumnya aktif
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        let stream: MediaStream | null = null;

        // Gunakan stream yang sudah pre-warmed jika cocok (menghindari DirectShow hardware lock di Windows)
        if (this.prewarmedStream && this.prewarmedStream.active) {
          const videoTrack = this.prewarmedStream.getVideoTracks()[0];
          const trackSettings = videoTrack?.getSettings?.();

          if (!deviceId || trackSettings?.deviceId === deviceId) {
            stream = this.prewarmedStream;
            this.prewarmedStream = null;
          } else {
            this.prewarmedStream.getTracks().forEach((t) => t.stop());
            this.prewarmedStream = null;
            // Berikan jeda 150ms agar DirectShow driver melepaskan hardware
            await new Promise((r) => setTimeout(r, 150));
          }
        }

        // Jika belum ada stream, buka stream baru
        if (!stream) {
          // Matikan activeStream lama sebelum membuka yang baru
          if (this.activeStream) {
            this.activeStream.getTracks().forEach((t) => t.stop());
            this.activeStream = null;
            await new Promise((r) => setTimeout(r, 150));
          }
          stream = await this.acquireStream(deviceId);
        }

        this.activeStream = stream;
        const track = stream.getVideoTracks()[0];
        const actualDeviceId = track?.getSettings?.()?.deviceId || deviceId || null;
        this.activeDeviceId = actualDeviceId;
        this.isSimulated = false;
        this.lastError = null;

        // Siapkan properti video sebelum assign srcObject
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('muted', '');
        videoElement.srcObject = stream;

        // Panggil play() SEGERA agar pipeline rendering Chromium aktif
        try {
          await videoElement.play();
        } catch (playErr) {
          console.warn('[CameraAdapter] Autoplay dicegah browser, mencoba muted play:', playErr);
          videoElement.muted = true;
          await videoElement.play().catch((e) => console.error('[CameraAdapter] Play muted gagal:', e));
        }

        // Tunggu frame pertama termuat
        await new Promise<void>((resolve) => {
          if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
            resolve();
            return;
          }
          const onReady = () => {
            videoElement.removeEventListener('playing', onReady);
            videoElement.removeEventListener('loadeddata', onReady);
            resolve();
          };
          videoElement.addEventListener('playing', onReady, { once: true });
          videoElement.addEventListener('loadeddata', onReady, { once: true });
          setTimeout(resolve, 800);
        });

        if (videoElement.paused) {
          await videoElement.play().catch(() => {});
        }

        return true;
      }
    } catch (err: any) {
      console.warn('[CameraAdapter] Kamera fisik tidak dapat diakses, beralih ke preview simulated:', err);
      this.lastError = err?.message || 'Kamera fisik tidak dapat diakses atau sedang dibuka aplikasi lain';
    }

    // Fallback Canvas standby visual jika hardware tidak tersedia
    this.activeDeviceId = deviceId || null;
    this.isSimulated = true;
    return this.startSimulatedStream(videoElement);
  }

  private startSimulatedStream(videoElement: HTMLVideoElement): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    let pulse = 0;
    const draw = () => {
      pulse = (pulse + 0.04) % (Math.PI * 2);

      // Clean background studio gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Studio grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 3, 0);
      ctx.lineTo(canvas.width / 3, canvas.height);
      ctx.moveTo((canvas.width * 2) / 3, 0);
      ctx.lineTo((canvas.width * 2) / 3, canvas.height);
      ctx.moveTo(0, canvas.height / 3);
      ctx.lineTo(canvas.width, canvas.height / 3);
      ctx.moveTo(0, (canvas.height * 2) / 3);
      ctx.lineTo(canvas.width, (canvas.height * 2) / 3);
      ctx.stroke();

      // Studio Simulation Graphic (Face contour silhouette dengan pulsing glow)
      const glowAlpha = 0.4 + 0.2 * Math.sin(pulse);
      ctx.strokeStyle = `rgba(245, 158, 11, ${glowAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 110, 0, Math.PI * 2);
      ctx.stroke();

      // Subtitle status
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STANDBY PREVIEW KAMERA STUDIO', canvas.width / 2, canvas.height / 2 + 130);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.fillText('Hubungkan webcam / DroidCam / DSLR lalu tekan Hubungkan Ulang', canvas.width / 2, canvas.height / 2 + 155);

      this.animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    try {
      const stream = canvas.captureStream(30);
      this.activeStream = stream;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.srcObject = stream;
      videoElement.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  stopLiveView(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
    if (this.prewarmedStream) {
      this.prewarmedStream.getTracks().forEach((track) => track.stop());
      this.prewarmedStream = null;
    }
    this.activeVideoElement = null;
    this.activeDeviceId = null;
  }

  /**
   * Mengambil snapshot foto beresolusi tinggi dari live view kamera.
   * @param isMirrored Bila true, hasil foto dicerminkan horizontal (sesuai tampilan layar Kiosk).
   */
  async capturePhoto(isMirrored = true): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal inisialisasi context canvas snapshot');

    // 1. Jika video fisik aktif dengan frame nyata, capture langsung resolusi aslinya!
    if (this.activeVideoElement && !this.isSimulated) {
      const vid = this.activeVideoElement;
      const width = vid.videoWidth > 0 ? vid.videoWidth : 1920;
      const height = vid.videoHeight > 0 ? vid.videoHeight : 1080;

      canvas.width = width;
      canvas.height = height;

      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.98);
    }

    // 2. Fallback Studio Portrait jika dalam mode simulasi
    canvas.width = 1920;
    canvas.height = 1280;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(0.5, '#1F2937');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Warm studio spotlight glow
    const radial = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2 - 50,
      50,
      canvas.width / 2,
      canvas.height / 2 - 50,
      600
    );
    radial.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Photo frame & silhouette
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 80, 160, 0, Math.PI * 2);
    ctx.fill();

    // Body silhouette
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2 + 250, 300, 200, 0, 0, Math.PI, true);
    ctx.fill();

    return canvas.toDataURL('image/jpeg', 0.98);
  }
}

export const cameraAdapter: ICameraAdapter = new CameraAdapterService();
