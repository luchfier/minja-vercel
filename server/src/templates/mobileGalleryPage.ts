import type { SessionGalleryItem } from '../services/storage.service.js';

export interface MobileGalleryPageOptions {
  boothName: string;
  sessionId: string;
  sessionCode: string;
  expiresAt: string;
  items: SessionGalleryItem[];
}

export function renderMobileGalleryHtml(opts: MobileGalleryPageOptions): string {
  const { boothName, sessionCode, items } = opts;

  // Pisahkan item berdasarkan kategori (Hasil Cetak 4R, Video Live Motion, Pose Foto Asli)
  const layoutItems = items.filter((it) => it.fileType === 'layout_4r');
  const liveVideoItems = items.filter((it) => it.fileType === 'live_video');
  const rawPhotoItems = items.filter((it) => it.fileType === 'raw_photo' || it.fileType === 'other');

  // Item utama untuk pratinjau
  const primaryLayout = layoutItems[0] || items[0] || null;
  const primaryLive = liveVideoItems[0] || null;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>${boothName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0A0A0A;
      color: #EDEDED;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 48px;
    }
    .wrapper {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header {
      text-align: center;
      padding-top: 8px;
    }
    .brand {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #A1A1AA;
      margin-bottom: 4px;
    }
    .meta {
      font-size: 12px;
      color: #71717A;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #71717A;
      padding-left: 2px;
    }
    .media-card {
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .media-box {
      width: 100%;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .media-box img, .media-box video {
      width: 100%;
      height: auto;
      max-height: 460px;
      object-fit: contain;
      display: block;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, opacity 0.15s ease;
    }
    .btn-card-action {
      background: #FFFFFF;
      color: #000000;
      padding: 14px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .btn-card-action:active {
      background: #D4D4D8;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .grid-item {
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .grid-item img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
      background: #000;
    }
    .grid-item .btn {
      background: #1F1F23;
      color: #EDEDED;
      padding: 10px 8px;
      font-size: 11px;
    }
    .grid-item .btn:active {
      background: #27272A;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #52525B;
      padding-top: 16px;
    }
    #toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #FFFFFF;
      color: #000000;
      font-size: 12px;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      pointer-events: none;
      z-index: 100;
      white-space: nowrap;
    }
    #toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header -->
    <div class="header">
      <div class="brand">${boothName}</div>
      <div class="meta">Sesi #${sessionCode}</div>
    </div>

    <!-- 1. Layout Cetak 4R -->
    ${
      primaryLayout
        ? `
    <div class="section">
      <div class="section-label">Hasil Cetak 4R</div>
      <div class="media-card">
        <div class="media-box">
          <img src="${primaryLayout.url}" alt="Foto 4R" loading="eager">
        </div>
        <a href="${primaryLayout.downloadUrl || primaryLayout.url}" download="${primaryLayout.fileName}" class="btn btn-card-action download-btn" data-name="Foto 4R">
          Unduh Foto 4R
        </a>
      </div>
    </div>
    `
        : ''
    }

    <!-- 2. Video Live Motion -->
    ${
      primaryLive
        ? `
    <div class="section">
      <div class="section-label">Live Video Motion</div>
      <div class="media-card">
        <div class="media-box">
          <video src="${primaryLive.url}" controls playsinline loop autoplay muted preload="metadata"></video>
        </div>
        <a href="${primaryLive.downloadUrl || primaryLive.url}" download="${primaryLive.fileName}" class="btn btn-card-action download-btn" data-name="Live Video">
          Unduh Video
        </a>
      </div>
    </div>
    `
        : ''
    }

    <!-- 3. Semua Pose Foto Asli (Grid) -->
    ${
      rawPhotoItems.length > 0
        ? `
    <div class="section">
      <div class="section-label">Pose Foto Asli (${rawPhotoItems.length})</div>
      <div class="grid">
        ${rawPhotoItems
          .map(
            (it, idx) => `
          <div class="grid-item">
            <img src="${it.url}" alt="Pose ${idx + 1}" loading="lazy">
            <a href="${it.downloadUrl || it.url}" download="${it.fileName}" class="btn download-btn" data-name="Pose ${idx + 1}">
              Unduh Pose ${idx + 1}
            </a>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      ${boothName} &bull; Tautan Privat Berlaku 48 Jam
    </div>
  </div>

  <div id="toast">Mengunduh berkas...</div>

  <script>
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const url = btn.getAttribute('href');
        const name = btn.getAttribute('data-name') || 'berkas';
        showToast('Mengunduh ' + name + '...');

        try {
          e.preventDefault();
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error('HTTP Status ' + res.status);
          }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = btn.getAttribute('download') || 'minja-photo.jpg';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
          showToast('Tersimpan ke galeri');
        } catch (err) {
          console.warn('[Gallery] Fetch blob gagal, gunakan direct navigation:', err);
          window.location.href = url;
        }
      });
    });

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  </script>
</body>
</html>
`;
}
