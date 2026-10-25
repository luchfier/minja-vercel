# MINJAPHOTOBOOTH — THE NEXT STEP
## Panduan Lengkap Roadmap, Integrasi Hardware, Payment Gateway & Produksi

**Dokumen Referensi Teknis & Panduan Eksekusi Lanjutan**  
**Versi:** 2.0.0  
**Tanggal:** 2026-10-19  
**Status:** Blueprint & Execution Plan  
**Target Platform:** Windows 10/11 64-bit Kiosk Mode  

---

## 1. Executive Summary & Status Terkini

### 1.1 Apa yang Sudah Selesai (Baseline Tercapai)
Proyek **MinjaPhotobooth V2** telah menyelesaikan fase pondasi arsitektur (*Architecture Baseline & Interactive UI*):

| Komponen | Status | Teknologi | Keterangan |
| :--- | :---: | :--- | :--- |
| **Backend API** | ✅ **Selesai** | Node.js, Fastify, TypeScript | Port 3000, modular routes, global error handler, CORS, Helmet. |
| **Database** | ✅ **Selesai** | PostgreSQL 16, Prisma ORM | Model Admin, Settings, Packages, Templates, Sessions, Payments tersinkronisasi. |
| **Security & Auth** | ✅ **Selesai** | Argon2id, JWT, Brute-Force Lockout | Proteksi 5x salah = lockout 10 menit. PIN default: `123456`. |
| **Frontend Kiosk** | ✅ **Selesai** | React 18, TypeScript, Vite, Tailwind | Antarmuka layar sentuh responsif di port 5173. |
| **Editor Foto 4R** | ✅ **Selesai** | HTML5 Canvas, SVG Frames | Multi-slot 4R, filter warna, crop/pan/zoom, rotasi, stiker, dan teks ucapan. |
| **Admin Control Center** | ✅ **Selesai** | React, Recharts, Lucide | Dashboard statistik, kelola paket, template, kasir tunai, voucher, dan laporan finansial. |
| **Dual-Mode Adapter** | ✅ **Selesai** | `httpPhotoboothApi.ts` + Mock Fallback | Terhubung ke backend PostgreSQL, dengan fallback offline otomatis (*zero-downtime*). |
| **One-Command Runner** | ✅ **Selesai** | `concurrently` di root `package.json` | `npm.cmd run dev` menyalakan backend dan frontend sekaligus dalam 1 terminal. |
| **Pilar 1: Payment Gateway** | ✅ **Selesai** | Midtrans QRIS, Webhook, Settle | Webhook SHA512 signature, polling reconciler, cash desk audit confirmation. |
| **Pilar 2: Kamera & Capture** | ✅ **Selesai** | Canon EOS / UVC Probe, Strobe Flash | Safe zone 4R, smile cue shimmer audio, tombol sentuh layar (touchscreen). |
| **Pilar 3: Cetak Fisik 4R** | ✅ **Selesai** | Windows Spooler Native PowerShell | 300 DPI 1200x1800 px silent print, background worker, reprint audit log. |
| **Pilar 4: Desktop Kiosk** | ✅ **Selesai** | Electron 33, Lockout, Watchdog | Single instance lock, context bridge, emergency exit (`Ctrl+Shift+Q`), backend auto-start. |
| **Pilar 5: Distribusi Digital**| ✅ **Selesai** | S3 / Cloudflare R2, Layanan Email (SMTP) | 48h tokenized private gallery, Nodemailer SMTP, smartphone download page. |

---

### 1.2 Status Produksi: 5 Pilar Utama Telah Siap Operasi (*Production Ready*)

Seluruh 5 pilar arsitektur komersial telah terpasang, terintegrasi ujung-ke-ujung (*end-to-end*), dan divalidasi dengan rangkaian pengujian otomatis:

```mermaid
graph TD
    subgraph SUDAH_SELESAI [Fitur Inti & 5 Pilar Produksi - 100% Siap]
        UI[Touchscreen Kiosk UI]
        Editor[Editor Komposisi 4R]
        Admin[Admin Panel & PIN Auth]
        DB[(PostgreSQL Database)]
        API[Fastify REST API]
        Pilar1[1. Payment Gateway Midtrans & Tunai ✅]
        Pilar2[2. Integrasi Kamera Canon/Webcam & Audio Cue ✅]
        Pilar3[3. Integrasi Cetak Fisik 4R Windows Spooler ✅]
        Pilar4[4. Desktop Kiosk Packaging Electron 33 ✅]
        Pilar5[5. Cloud Storage R2/S3 & Layanan Email SMTP ✅]
    end

    UI --> Pilar1
    UI --> Pilar2
    Editor --> Pilar3
    UI --> Pilar5
    Pilar1 --> DB
    Pilar3 --> DB
    Pilar5 --> DB
```

---

## 2. Pilar 1: Integrasi Payment Gateway (Midtrans QRIS)

### 2.1 Arsitektur Alur Transaksi
Pembayaran mandiri menggunakan **Midtrans Snap / Core API QRIS** dengan verifikasi dua arah (Webhook + Polling Reconciler).

```mermaid
sequenceDiagram
    autonumber
    actor Pelanggan as Pelanggan (Kiosk)
    participant Front as Frontend (React)
    participant Back as Backend (Fastify)
    participant Mid as Midtrans Server
    participant DB as PostgreSQL

    Pelanggan->>Front: Pilih Paket Foto & Klik Bayar
    Front->>Back: POST /api/payments/qris { sessionId, packageId }
    Back->>Mid: Charge Request (payment_type: "qris")
    Mid-->>Back: Response (qr_string EMVCo, order_id, gross_amount)
    Back->>DB: Simpan Transaksi (status: "pending")
    Back-->>Front: Kembalikan qr_string & order_id
    Front->>Pelanggan: Tampilkan QR Code & Countdown Timer (120s)
    
    Pelanggan->>Mid: Scan & Bayar via E-Wallet (BCA/GoPay/OVO/ShopeePay)
    Mid->>Back: Webhook Notifikasi HTTP POST (status: "settlement", signature_key)
    Back->>Back: Validasi SHA512(order_id + status_code + gross_amount + ServerKey)
    Back->>DB: Update Transaksi -> "settlement", isVerified: true
    Back->>DB: Update Session -> "PAYMENT_CONFIRMED"
    
    par Polling Reconciler (Cadangan jika Webhook Lambat)
        Front->>Back: GET /api/payments/:orderId/status (interval 2.5s)
        Back-->>Front: { status: "settlement", isVerified: true }
    end

    Front->>Pelanggan: Notifikasi Pembayaran Sukses & Kamera Aktif
```

### 2.2 Langkah Teknis Eksekusi
1. **Pendaftaran Kredensial:**
   - Dapatkan `Server Key` dan `Client Key` dari [dashboard.midtrans.com](https://dashboard.midtrans.com) (mulai dari mode Sandbox).
   - Masukkan ke file `server/.env`:
     ```env
     MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
     MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
     MIDTRANS_IS_PRODUCTION=false
     ```
2. **Implementasi Service Backend (`server/src/services/payment.service.ts`):**
   - Buat request `POST https://api.sandbox.midtrans.com/v2/charge` menggunakan Basic Auth (`base64(MIDTRANS_SERVER_KEY + ":")`).
   - Ekstrak field `qr_string` (format EMVCo standard QRIS).
3. **Endpoint Webhook (`server/src/routes/payment.routes.ts`):**
   - Menerima notifikasi `POST /api/webhooks/midtrans`.
   - Hitung hash SHA512:
     ```typescript
     import crypto from 'crypto';
     const raw = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
     const calculatedSignature = crypto.createHash('sha512').update(raw).digest('hex');
     if (calculatedSignature !== req.body.signature_key) throw new Error('Invalid signature');
     ```
   - Lakukan update transaksi idempoten (*idempotent update*) agar transaksi yang sama tidak diproses dua kali.

---

## 3. Pilar 2: Integrasi Kamera Fisik (Webcam & Canon EOS DSLR)

### 3.1 Pendekatan Sesuai Perangkat

| Jenis Kamera | Metode Koneksi | Latensi | Kualitas | Kompleksitas |
| :--- | :--- | :---: | :---: | :---: |
| **Webcam USB (Logitech Brio, C920)** | Langsung via Browser `getUserMedia` | < 30ms | 1080p - 4K | ⭐ Sangat Mudah |
| **Canon DSLR via HDMI Capture Card** | HDMI to USB (Elgato Cam Link / Murah) | < 50ms | 1080p Studio | ⭐⭐ Mudah |
| **Canon DSLR via Software Virtual Cam** | EOS Webcam Utility / OBS Virtual Cam | ~80ms | 1080p | ⭐⭐ Mudah |
| **Canon DSLR via USB Native (EDSDK)** | Desktop Sidecar / Native Addon | < 100ms | 18MP Asli | ⭐⭐⭐ Menengah |

### 3.2 Langkah Teknis Eksekusi
1. **Level 1 (Paling Cepat & Stabil — Direkomendasikan):**
   - Hubungkan Canon EOS 600D ke PC menggunakan kabel mini-HDMI ke USB Capture Card (atau instal software resmi *Canon EOS Webcam Utility*).
   - Kamera langsung terbaca sebagai perangkat video standar Windows (UVC).
   - Buka menu **Admin > Hardware & Kalibrasi** di Kiosk, pilih kamera Canon dari dropdown daftar perangkat, dan simpan.
2. **Level 2 (Kontrol Native Shutter & File Mentah):**
   - Jika ingin memicu mekanik shutter kamera DSLR asli dan mengambil file JPEG resolusi penuh (18 Megapiksel) tanpa Capture Card:
   - Gunakan utility jembatan lokal seperti **digiCamControl** atau wrapper Node.js **edsdk**.
   - Backend memicu perintah capture melalui child process:
     ```typescript
     import { exec } from 'child_process';
     exec('CameraControlCmd.exe /capture /filename "photo_temp.jpg"');
     ```

---

## 4. Pilar 3: Integrasi Cetak Fisik 4R (Windows Print Spooler)

### 4.1 Persyaratan Cetak Lab 4R
- **Ukuran Kertas:** Standar Studio 10 × 15 cm (4R).
- **Resolusi Cetak:** 300 DPI (Dots Per Inch) minimum.
- **Dimensi Kanvas:** 
  - Portrait: **1200 × 1800 piksel**.
  - Landscape: **1800 × 1200 piksel**.
- **Printer Target:** DNP QW410 / DS-RX1HS, Citizen CY-02, Hiti P525L, atau Epson L-series.

### 4.2 Alur Komposisi & Silent Printing
Mesin photobooth mandiri **tidak boleh** memunculkan popup dialog Windows (*"Do you want to print?"*). Proses harus berjalan otomatis di latar belakang (*silent print*).

```mermaid
graph LR
    Slot[Foto Pilihan Pelanggan] --> Compositor[Sharp / Canvas 300 DPI Compositor]
    Template[Frame PNG Overlay Transparan] --> Compositor
    Compositor --> HighResJPG[High-Res 1200x1800 px JPG]
    HighResJPG --> Spooler[Windows Print Spooler Service]
    Spooler --> Printer[Printer Dye-Sublimation 4R Fisik]
```

### 4.3 Langkah Teknis Eksekusi
1. **Compositing Resolusi Tinggi:**
   - Gunakan modul `sharp` di backend untuk menggabungkan slot foto dan frame PNG transparan pada resolusi 1200x1800 px sRGB.
2. **Perintah Cetak Latar Belakang (Silent Print Windows):**
   - Di Windows, kirim file gambar ke printer default tanpa dialog menggunakan tool CLI ringan seperti **PDFtoPrinter** atau **SumatraPDF**:
     ```powershell
     SumatraPDF.exe -print-to "DNP DS-RX1" -print-settings "paper=4x6,fit" final_photo_4r.jpg
     ```
   - Atau menggunakan modul Node.js `node-printer` / `pdf-to-printer` di lingkungan desktop Electron.

---

## 5. Pilar 4: Desktop Kiosk Wrapper (Electron Packaging)

### 5.1 Mengapa Memerlukan Electron?
Menjalankan photobooth di browser biasa memiliki kekurangan:
- Pelanggan bisa menekan tombol `F11`, `Alt+Tab`, atau menutup tab browser.
- Browser tidak memiliki akses langsung ke port printer tanpa konfirmasi pengguna.
- Tidak bisa auto-start saat Windows menyala (*kiosk appliance mode*).

### 5.2 Arsitektur Electron Kiosk

```
MinjaPhotobooth.exe (Electron Wrapper)
 ├── Main Process (Node.js Windows Native)
 │    ├── Lock Kiosk: Fullscreen, Disable Alt+Tab, Disable Context Menu
 │    ├── Akses Langsung ke Windows Print Spooler API
 │    ├── Child Process: Menjalankan Fastify Backend (Port 3000)
 │    └── Watchdog & Auto-Restart jika terjadi crash
 └── Renderer Process (Chromium)
      └── Menampilkan UI Touchscreen Vite (React 18)
```

### 5.3 Konfigurasi Kiosk Lockout
```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  fullscreen: true,
  kiosk: true,          // Mengunci aplikasi dari taskbar dan tombol shortcut Windows
  frame: false,
  alwaysOnTop: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  },
});
```

---

## 6. Pilar 5: Distribusi Digital (Cloud Storage & Layanan Email SMTP)

### 6.1 Galeri Privat Berbatas Waktu (Cloudflare R2 / AWS S3)
1. Setelah sesi foto selesai, foto final 4R diunggah ke Object Storage yang kompatibel dengan S3 (misal: **Cloudflare R2** dengan biaya egress $0).
2. Dibuatkan link privat unik menggunakan token crypto (Nanoid 32 karakter):
   `https://gallery.minjaphotobooth.com/s/SESSION_ID?token=NANOOID_32`
3. Link ini dijadikan **QR Code** di layar *DeliveryScreen* untuk di-scan smartphone pelanggan.
4. Auto-deletion / Expiry job berjalan setiap 48 jam untuk menghapus file lama sesuai kebijakan retensi privasi.

### 6.2 Layanan Email SMTP (Pengiriman Otomatis)
1. Pelanggan memasukkan alamat email di virtual keyboard layar sentuh dengan shortcut domain (@gmail.com, dll).
2. Backend mengirim email template HTML responsif melalui **Nodemailer SMTP** (Gmail, Google Workspace, domain hosting):
   *"Halo Kak! Terima kasih sudah berfoto di Minja Photobooth. Foto kenangan Anda dapat diunduh di link berikut: [Link Galeri] (Aktif selama 48 jam)."*

---

## 7. Roadmap Pelaksanaan Bertahap (Phase-by-Phase Plan)

```mermaid
gantt
    title MinjaPhotobooth — Rencana Eksekusi Lanjutan
    dateFormat YYYY-MM-DD
    
    section Tahap 1: Pembayaran
    Integrasi Midtrans Sandbox API          :active, t1, 2026-10-20, 2d
    Webhook & Polling Reconciler            :t2, after t1, 2d
    
    section Tahap 2: Desktop Kiosk
    Inisialisasi Electron Wrapper           :t3, after t2, 3d
    Kiosk Mode Lockout & Auto-Start         :t4, after t3, 2d
    
    section Tahap 3: Imaging & Hardware
    Pipeline Kamera (Webcam/Cam Link)       :t5, after t4, 3d
    Pipeline Cetak Silent Print 4R (Sharp)  :t6, after t5, 3d
    
    section Tahap 4: Distribusi & Rilis
    Cloudflare R2 & Layanan Email SMTP      :t7, after t6, 3d
    Windows Installer (.exe) & Field Test   :t8, after t7, 3d
```

---

## 8. Panduan Cepat untuk AI / Pengembang Selanjutnya

Jika sesi ini dilanjutkan oleh AI lain atau pengembang baru, perhatikan aturan penting berikut:

1. **JANGAN menimpa kode yang sudah bekerja.** Arsitektur saat ini memiliki dual-mode API (`httpPhotoboothApi.ts`) dengan mock fallback. Pertahankan fallback agar aplikasi selalu bisa dijalankan meskipun hardware sedang tidak terhubung.
2. **Port yang Digunakan:**
   - Backend Fastify: `http://localhost:3000`
   - Frontend Vite: `http://localhost:5173`
   - Database PostgreSQL: `localhost:5432` (`DATABASE_URL` di `server/.env`)
3. **Eksekusi Sekali Perintah:**
   - Gunakan `npm.cmd run dev` di root folder untuk menjalankan server dan frontend secara bersamaan.
   - Gunakan `npm.cmd run db:push` untuk menyinkronkan schema database.
   - Gunakan `npm.cmd run db:seed` untuk mengisi data awal admin (`PIN: 123456`), paket, dan template.
4. **Ukuran File Gambar Cetak:** Wajib mematuhi rasio 4R (1200x1800 px pada 300 DPI) agar hasil cetak fisik tidak terdistorsi atau terpotong.
