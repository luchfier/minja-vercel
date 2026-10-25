# MinjaPhotobooth V2 — Master Agent Instruction & System Architecture Guide

> **Catatan Penting untuk AI Agent / Developer Selanjutnya:**  
> Dokumen ini adalah panduan komprehensif untuk memahami seluruh alur, arsitektur, konfigurasi, dan batasan teknis dari **MinjaPhotobooth V2**. Sebelum memodifikasi atau menambahkan kode, **baca dan patuhi seluruh panduan serta *guardrails* yang ada di dokumen ini.**

---

## 1. Identitas Proyek & Ringkasan Eksekutif

**MinjaPhotobooth V2** adalah aplikasi photobooth komersial mandiri (*self-service kiosk*) modern berbasis **Windows 10/11 (64-bit)** dengan antarmuka layar sentuh (*touchscreen*) berorientasi lanskap.

### 1.1 Spesifikasi Inti
- **Sistem Operasi Target:** Windows 10 / Windows 11 (64-bit)
- **Tipe Aplikasi:** Kiosk Standalone / Desktop Appliance (Electron 33 + Node.js 20 LTS)
- **Resolusi Kiosk Target:** 1440×900 atau 1920×1080 (Layar Sentuh Lanskap)
- **Ukuran Cetak Standar:** Kertas Foto Lab 10 × 15 cm (Standar Studio / 4R, 300 DPI = 1200×1800 piksel)
- **Model Bisnis:** Self-service tanpa operator penuh, mendukung QRIS otomatis dan pembayaran tunai dengan konfirmasi kasir.

### 1.2 Tech Stack

| Lapisan | Teknologi | Peran & Keterangan |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 6, TypeScript, Tailwind CSS, Lucide Icons | Antarmuka layar sentuh pelanggan & Admin Control Center (Port `5173`) |
| **Backend API** | Node.js 20, Fastify 5, TypeScript, Zod, Pino | REST API otoritatif, logika bisnis, perhitungan harga, webhook (Port `3000`) |
| **Desktop Wrapper** | Electron 33, TypeScript | Kiosk lockout, single instance, shortcut darurat, window management |
| **Database Utama** | PostgreSQL 16 via Prisma 6 ORM | Penyimpanan relasional terpusat (Sesi, Transaksi, Paket, Template, Voucher, Audit) |
| **Cache Offline** | SQLite (`better-sqlite3`) & In-Memory Fallback | Dukungan operasional offline zero-downtime saat database/jaringan terputus |
| **Payment Gateway** | Midtrans Core API (QRIS Dinamis EMVCo) | Webhook SHA512 signature + Polling reconciler |
| **Pencetakan Fisik** | Windows Print Spooler (.NET PowerShell Script) | Silent printing 4R borderless 300 DPI tanpa popup dialog |
| **Kamera & Capture** | Web API (`getUserMedia`), UVC Probe, Canon EOS 600D | Live view 30 FPS, shutter cue, safe zone guide, tombol sentuh layar (touchscreen) |
| **Distribusi Digital**| Cloudflare R2 / AWS S3, Layanan Email (SMTP / Nodemailer) | Tokenized private gallery 48 jam, QR Code, pengiriman email otomatis |

---

## 2. Arsitektur Sistem & Pemisahan Tanggung Jawab (Separation of Concerns)

Sistem dibagi menjadi **3 komponen utama** yang berinteraksi secara modular:

```
┌─────────────────────────────────────────────────────────────┐
│                 MinjaPhotobooth Desktop Kiosk               │
│                                                             │
│  ┌───────────────────────────┐  IPC ContextBridge           │
│  │    React Touchscreen UI   │ ◄─────────────────────────┐  │
│  │    (Renderer - Port 5173) │                           │  │
│  └─────────────┬─────────────┘                           │  │
│                │                                         │  │
│                │ HTTP REST (JSON)                        │  │
│                ▼                                         ▼  │
│  ┌───────────────────────────┐         ┌─────────────────┴┐ │
│  │   Fastify Backend API     │         │  Electron Main   │ │
│  │   (Node.js - Port 3000)   │         │  Native Process  │ │
│  └─────────────┬─────────────┘         └─────────┬────────┘ │
└────────────────┼─────────────────────────────────┼──────────┘
                 │ Prisma ORM                      │ Windows Native
                 ▼                                 ▼
      ┌───────────────────────┐         ┌─────────────────────┐
      │ PostgreSQL 16         │         │ Windows Spooler     │
      │ Midtrans / Meta / S3  │         │ (silent-print.ps1)  │
      └───────────────────────┘         └─────────────────────┘
```

### 2.1 Backend API Server (Fastify 5 — Port 3000)
- **Otoritas Harga (Server-Side Price Authority):** Frontend **dilarang keras** menentukan harga atau diskon. Frontend hanya mengirim `packageId`, `voucherCode`, dan `additionalPrints`. Backend menghitung total harga secara otoritatif dari database.
- **Otoritas Pembayaran:** Sesi kamera **hanya boleh aktif** setelah backend memvalidasi status `settlement` dari Midtrans atau pelunasan kasir tunai.
- **Isolasi Secret:** `MIDTRANS_SERVER_KEY`, `JWT_SECRET`, database credentials, dan kredensial SMTP Email **hanya ada di backend**. Tidak pernah diekspos ke frontend atau preload bridge.

### 2.2 Frontend Touchscreen UI (React 18 + Vite — Port 5173)
- Render antarmuka sentuh pelanggan dengan micro-interactions, audio cues, dan modal interaktif.
- Render kanvas editor foto 4R interaktif (multi-slot, crop, rotate, filter warna, sticker, custom greeting text).
- Menyediakan Admin Control Center tersembunyi yang diakses melalui gestur 5-tap pada logo di layar awal.

### 2.3 Dual-Mode API Architecture (Koneksi Backend + Graceful Fallback)
Arsitektur frontend mengimplementasikan **Dual-Mode Adapter** (`frontend/src/services/photoboothApi.ts`):
- Implementasi utama: `httpPhotoboothApi.ts` yang terhubung ke Fastify Backend di `http://localhost:3000/api`.
- Fallback otomatis: `mockPhotoboothApi.ts`.
- **Aturan Mutlak:** Jika backend mati atau database belum terhubung, antarmuka kiosk **tidak boleh crash**. Sistem secara otomatis beralih ke mock fallback dengan notifikasi status, sehingga demo UI dan pengujian kiosk tetap berjalan mulus.

### 2.4 Electron Desktop Kiosk Wrapper (`electron/main.ts`)
- **Single Instance Lock:** Mencegah multiple instance berjalan secara bersamaan di mesin booth.
- **Kiosk Security:** Fullscreen, menu bar Windows dinonaktifkan, DevTools dinonaktifkan di mode produksi, blokir popup window liar.
- **Shortcut Darurat Operator:**
  - `Ctrl + Shift + Q`: Keluar darurat dari aplikasi kiosk (*Emergency Quit*).
  - `Ctrl + Shift + F`: Toggle mode Kiosk / Windowed (untuk maintenance operator di lokasi).

---

## 3. Alur Pelanggan Lengkap (Customer Journey & State Machine)

State pelanggan diatur secara reaktif oleh `SessionContext.tsx` (`frontend/src/contexts/SessionContext.tsx`):

```mermaid
stateDiagram-v2
    [*] --> WELCOME: Attract Screen (Layar Awal)
    WELCOME --> PACKAGE: Sentuh "Mulai Sesi Foto"
    PACKAGE --> PAYMENT: Pilih Paket Sesi
    PAYMENT --> PAYMENT: Input & Validasi Voucher Diskon
    PAYMENT --> CAMERA: Bayar QRIS (Settlement) ATAU Bayar Tunai (PIN Kasir Valid)
    CAMERA --> EDITOR: Selesai Ambil Foto (1..10 Foto) / Timer Habis
    EDITOR --> ADD_PRINT: Finalisasi Tata Letak & Filter Frame 4R
    ADD_PRINT --> DELIVERY: Konfirmasi Lembar Cetak Tambahan (Add-On)
    DELIVERY --> WELCOME: Silent Print 4R + Scan QR Galeri / Kirim Email -> Reset Otomatis
```

### Rincian Tiap Tahap:

1. **`WELCOME` (WelcomeScreen):**
   - Layar animasi penarik (*attract screen*) dengan branding, teks selamat datang kustom, dan tombol besar "Mulai Sesi Foto".
   - **Pintu Rahasia Admin:** Ketukan 5x berturut-turut pada logo booth akan memunculkan popup verifikasi PIN Admin.

2. **`PACKAGE` (PackageSelectionScreen):**
   - Menampilkan daftar paket aktif dari database/API (contoh: *Solo Express*, *Bestie Duo*, *Party Quad*).
   - Menampilkan detail: harga, durasi sesi (detik), kuota foto, dan jumlah lembar cetak bawaan.

3. **`PAYMENT` (PaymentScreen):**
   - **Fitur Voucher Promo:** Pelanggan dapat memasukkan kode voucher. Sistem memvalidasi ke backend: tipe potongan (persentase / nominal tetap), minimal transaksi, kuota, masa aktif, dan batas maksimum diskon.
   - **Pilihan Metode 1: QRIS (Midtrans):**
     - Memunculkan QR Code dinamis standar EMVCo dengan timer kedaluwarsa (120 detik).
     - Polling reconciler otomatis mengecek status setiap 2.5–3 detik ke `/api/payments/:orderId/status`.
     - Saat webhook Midtrans mengirimkan status `settlement`, layar langsung beralih ke kamera.
   - **Pilihan Metode 2: Tunai (Cash Desk):**
     - Menampilkan Order ID dan rincian total tagihan.
     - Membuka modal konfirmasi kasir booth: petugas kasir memasukkan PIN Admin, input jumlah uang fisik yang diterima, dan sistem otomatis menghitung uang kembalian.
     - Begitu kasir konfirmasi, sesi langsung terbuka ke kamera.

4. **`CAMERA` (CameraScreen):**
   - Live stream video dari webcam UVC atau Canon EOS DSLR via HDMI/Virtual Cam.
   - Overlay garis panduan (*Safe Zone Guide*) proporsional 4R (rasio 2:3).
   - Hitung mundur interaktif (3.. 2.. 1..), efek lampu kilat layar (*strobe flash* putih), dan audio shimmer/shutter.
   - Tombol shutter sentuh di layar (touchscreen) dengan hitung mundur otomatis dan shutter instan.
   - Thumbnail foto terkumpul di samping layar, mendukung hapus & foto ulang (*retake*).

5. **`EDITOR` (PhotoEditorScreen):**
   - Pemilihan template frame 4R (1 slot, 2 slot, 3 slot strip, 4 slot grid, collage).
   - Pengaturan tiap slot foto: drag & pan, zoom/scale, rotate 90°, swap posisi.
   - Filter kreatif satu sentuhan: *Normal*, *Black & White*, *Vintage/Sepia*, *Warm Glow*, *Cool Breeze*, *Glamour Soft*.
   - Tambahan stiker interaktif dan teks ucapan kustom (watermark tanggal, nama event).

6. **`ADD_PRINT` (AddPrintScreen):**
   - Penawaran cetak lembar fisik tambahan (*upselling print copies*).
   - Kalkulasi harga tambahan per lembar secara otomatis dari konfigurasi paket.
   - Jika ada tambahan biaya, dapat dibayar via QRIS / Tunai instan sebelum pencetakan.

7. **`DELIVERY` (DeliveryScreen):**
   - **Pencetakan Fisik:** Mengirim sinyal cetak latar belakang (*silent print*) ke Windows Print Spooler sesuai jumlah copy yang dipilih.
   - **QR Code Galeri Privat:** Menghasilkan URL galeri terenkripsi token (masa aktif 48 jam) untuk di-scan oleh smartphone pelanggan.
   - **Layanan Email (SMTP):** Virtual keyboard layar sentuh responsif dengan tombol pintas domain (@gmail.com, dll) bagi pelanggan yang ingin soft file fotonya dikirim langsung ke alamat email.
   - **Auto-Reset Countdown:** Setelah selesai, timer mundur 30 detik akan membersihkan sesi memori dan mengembalikan layar ke `WELCOME`.

---

## 4. Admin Control Center & Keamanan

Panel admin tersembunyi dirancang untuk konfigurasi operasional harian, kalibrasi hardware, dan laporan keuangan.

### 4.1 Keamanan & Autentikasi Admin
- **Verifikasi PIN:** Menggunakan algoritma hash standar industri **Argon2id** (PIN default saat seed: `123456`).
- **Brute-Force Lockout:** Salah memasukkan PIN sebanyak 5 kali berturut-turut akan mengunci akses selama **10 menit**.
- **JWT Stateless Token:** Sesi admin menggunakan Bearer JWT dengan masa berlaku 4 jam.
- **Audit Logging:** Setiap tindakan penting admin (ganti PIN, reprint, ubah harga paket, konfirmasi kasir tunai) dicatat di tabel `AuditLog`.

### 4.2 Modul-Modul Admin
1. **Dashboard Statistik:** Ringkasan pendapatan hari ini, jumlah sesi, perbandingan metode pembayaran (QRIS vs Tunai), dan status hardware.
2. **Kasir Tunai (Cash Desk):** Antarmuka cepat bagi petugas untuk mengonfirmasi tagihan tunai, verifikasi nominal uang pelanggan, dan cetak struk/kembalian.
3. **Manajemen Paket:** CRUD paket foto (nama, harga dasar, durasi detik, batas foto, cetak bawaan, harga add-on per lembar).
4. **Manajemen Template:** CRUD template frame 4R (upload frame PNG overlay transparan, tentukan jumlah slot, orientasi portrait/landscape, dan koordinat bounding box).
5. **Hardware & Kalibrasi:**
   - Deteksi & seleksi kamera video input.
   - Deteksi & seleksi printer Windows.
   - Kalibrasi margin cetak (Top/Left Margin mm) dan tombol **Test Print**.
6. **Manajemen Voucher Promo:** Buat kupon diskon (persentase dengan max cap, atau potongan tetap), set kuota, masa berlaku, dan minimal transaksi.
7. **Laporan Finansial:** Rekapitulasi transaksi berdasarkan rentang tanggal, filter status pembayaran, rincian diskon voucher, dan ekspor ke **CSV**.
8. **Pengaturan Branding:** Ubah nama booth, judul display, teks welcome, warna tema primer/sekunder, upload logo dan wallpaper background.
9. **Diagnostik Sistem:** Status memori RAM, versi OS Windows, arsitektur CPU, latensi database, dan status mode Kiosk.

---

## 5. Implementasi 5 Pilar Produksi

| Pilar | Status | Komponen Utama | File Terkait |
| :--- | :---: | :--- | :--- |
| **1. Payment Gateway** | ✅ Selesai | Midtrans QRIS, Webhook SHA512, Polling, Cash Desk | `server/src/services/payment.service.ts`<br/>`server/src/routes/payment.routes.ts`<br/>`frontend/src/pages/customer/PaymentScreen.tsx` |
| **2. Pipeline Kamera** | ✅ Selesai | Webcam UVC, Canon EOS 600D, Safe Zone 4R, Audio Shimmer, Touch Shutter | `frontend/src/pages/customer/CameraScreen.tsx`<br/>`frontend/src/adapters/cameraAdapter.ts`<br/>`frontend/src/services/soundEffects.ts` |
| **3. Pipeline Cetak 4R (Dedicated Windows Print Engine)**| ✅ Selesai | Windows Spooler WMI/CIM, Silent Borderless .NET, Sheet-by-sheet Recovery (Paper-Out auto-pause & resume), Audit Tracker, Support Inkjet L-Series/SELPHY/DNP/SureLab | `electron/print-engine/` (`spoolerMonitor.ts`, `queueManager.ts`, `auditTracker.ts`)<br/>`server/scripts/silent-print.ps1`<br/>`frontend/src/adapters/printerAdapter.ts` |
| **4. Desktop Kiosk** | ✅ Selesai | Electron 33, Single Instance, Lockout, Hotkeys darurat | `electron/main.ts`<br/>`electron/preload.ts`<br/>`package.json` |
| **5. Distribusi Digital**| ✅ Selesai | S3/R2 Storage, 48h Tokenized Gallery, Layanan Email (SMTP) | `server/src/services/delivery.service.ts`<br/>`server/src/services/email.service.ts`<br/>`frontend/src/pages/customer/DeliveryScreen.tsx` |

---

## 6. Peta Struktur Direktori Proyek

```
Minja V2/
├── AGENTS.md                  # Panduan Master AI Agent (File ini)
├── GEMINI.md                  # Panduan Khusus Antigravity / Gemini CLI
├── README.md                  # Dokumentasi umum proyek
├── PRD.md                     # Ringkasan Product Requirements
├── package.json               # Root workspace (scripts: dev, kiosk, db:push, test)
│
├── .agents/                   # Customization Root untuk AI Agents
│   ├── rules/                 # Aturan arsitektur, hardware, keamanan
│   └── skills/                # Skrip & alur eksekusi otomatis
│
├── docs/                      # Spesifikasi teknis mendalam
│   ├── API_CONTRACT.md        # 41 Endpoint REST lengkap dengan payload Zod
│   ├── ARCHITECTURE.md        # Desain perangkat lunak & batas online vs desktop
│   ├── DATABASE_SCHEMA.md     # 14 Model Prisma & SQLite DDL
│   ├── MILESTONES.md          # 15 Tahapan milestone pengerjaan (M0 s/d M14)
│   ├── PRD.md                 # Product Requirements Document lengkap
│   ├── SECURITY.md            # Standar keamanan, hashing, lockout, proteksi
│   ├── TEST_PLAN.md           # 85+ Kasus uji otomatis & hardware test
│   └── THE_NEXT_STEP.md       # Blueprint integrasi fisik & roadmap komersial
│
├── electron/                  # Electron Main & Preload Process
│   ├── main.ts                # Kiosk window, single instance lock, IPC, shortcuts
│   ├── preload.ts             # contextBridge IPC API (electronKiosk, electronPrinter)
│   ├── print-engine/          # Dedicated Windows Native Print Engine (Opsi A)
│   │   ├── types.ts           # Tipe data, kategori printer, status sensor hardware
│   │   ├── spoolerMonitor.ts  # WMI/CIM Win32_Printer & Win32_PrintJob status scanner
│   │   ├── queueManager.ts    # Sheet-by-sheet queue executor & auto-recovery engine
│   │   ├── auditTracker.ts    # JSON-based daily sheets summary & recovery logs
│   │   └── index.ts           # PrintEngine controller & IPC handlers
│   └── tsconfig.json
│
├── frontend/                  # React 18 + Vite Kiosk Touchscreen
│   ├── src/
│   │   ├── adapters/          # cameraAdapter.ts, printerAdapter.ts
│   │   ├── components/        # Komponen UI: admin, common, editor, layout
│   │   ├── contexts/          # SessionContext.tsx (State Machine), ThemeContext.tsx
│   │   ├── mocks/             # mockPhotoboothApi.ts, mockData.ts (Zero-Downtime Fallback)
│   │   ├── pages/
│   │   │   ├── admin/         # 10 Halaman Admin Control Center
│   │   │   └── customer/      # 7 Layar Alur Sentuh Pelanggan
│   │   ├── photo-engine/      # Dedicated 2D Photo Editor Engine (Compositor, Filter, Exporter)
│   │   │   ├── types.ts       # Kontrak tipe, dimensi kanvas 300 DPI (10×15 cm), konfigurasi
│   │   │   ├── assetLoader.ts # LRU asset caching & pre-warm manager
│   │   │   ├── filterPipeline.ts # Studio color grading (normal, bw, sepia, warm, cool, glamour)
│   │   │   ├── compositor.ts  # Multi-layer double buffered 60 FPS 2D canvas compositor
│   │   │   ├── hitTester.ts   # Touchscreen coordinate mapper & hit-test
│   │   │   ├── historyManager.ts # Bounded memory Undo/Redo stack manager
│   │   │   ├── exportPipeline.ts # Headless 300 DPI print exporter & thumbnailer
│   │   │   └── index.ts       # Unified PhotoEngine facade
│   │   ├── services/          # httpPhotoboothApi.ts, soundEffects.ts, livePhotoService.ts
│   │   └── types/             # Shared TypeScript interfaces
│   └── package.json
│
└── server/                    # Fastify 5 Backend API
    ├── prisma/
    │   └── schema.prisma      # 14 Model PostgreSQL Prisma
    ├── scripts/
    │   └── silent-print.ps1   # PowerShell .NET Silent Printing 4R ke Windows Spooler
    ├── src/
    │   ├── app.ts             # Fastify setup, plugin CORS/Helmet, routes register
    │   ├── server.ts          # Server entry point (port 3000)
    │   ├── config/env.ts      # Validasi Zod variabel lingkungan .env
    │   ├── middleware/        # auth.middleware.ts, error.middleware.ts
    │   ├── routes/            # 13 File REST endpoint modular
    │   ├── services/          # Logika bisnis (payment, print, session, delivery, dll)
    │   └── utils/             # Argon2id, crypto, signature SHA512
    ├── tests/                 # Vitest automated test suite (8 test suites)
    ├── .env                   # Variabel lingkungan server lokal
    └── package.json
```

---

## 7. Panduan Menjalankan & Perintah Operasional

### 7.1 Catatan Penting Terminal Windows (PowerShell)
Di lingkungan Windows PowerShell, perintah `npm` langsung sering terhambat oleh `ExecutionPolicy` script.  
**Selalu gunakan format `npm.cmd` saat menjalankan perintah di terminal Windows.**

### 7.2 Perintah Utama (Root Folder)

```powershell
# 1. Menjalankan Server Fastify & Frontend Vite bersamaan (Development Mode)
npm.cmd run dev

# 2. Menjalankan Full Kiosk (Backend + Frontend + Electron Window)
npm.cmd run kiosk

# 3. Menjalankan Tes Otomatis (Vitest Backend)
npm.cmd test

# 4. Sinkronisasi Skema Database Prisma ke PostgreSQL
npm.cmd run db:push

# 5. Mengisi Data Awal Database (Admin PIN default: 123456, Paket, Template)
npm.cmd run db:seed

# 6. Membuka Prisma Studio GUI untuk menginspeksi database
npm.cmd run db:studio

# 7. Membangun Kode Produksi (Build Frontend + Backend + Electron)
npm.cmd run build
```

### 7.3 Konfigurasi Database PostgreSQL
File konfigurasi database berada di `server/.env`:
```env
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/minjaphotobooth
```
*Tips untuk Agent:* Jika terjadi pesan `Authentication failed against database server at localhost`, sesuaikan username dan password PostgreSQL lokal pada `server/.env`. Bila PostgreSQL sedang tidak aktif, aplikasi frontend akan secara otomatis menggunakan fallback `mockPhotoboothApi.ts` tanpa menghentikan jalannya UI.

---

## 8. Aturan Wajib & Pantangan untuk AI Agent (*Guardrails*)

1. **JANGAN MERUSAK DUAL-MODE API FALLBACK:**
   File `frontend/src/services/photoboothApi.ts` dan `httpPhotoboothApi.ts` dirancang dengan proteksi fallback otomatis ke `mockPhotoboothApi.ts`. Jangan hapus atau bypass fallback ini! Ini menjamin aplikasi tetap bisa didemokan dan diuji meskipun hardware kamera, printer, atau database lokal sedang offline.

2. **OTORITAS HARGA HANYA DI BACKEND:**
   Jangan pernah memindahkan kalkulasi harga total, diskon voucher, atau validasi pembayaran ke sisi client/frontend. Frontend hanya mengirimkan request kalkulasi dan menerima hasil dari server.

3. **STANDAR UKURAN CETAK 10 × 15 CM TIDAK BOLEH BERUBAH:**
   - Dimensi cetak: **10 × 15 cm** (1200 × 1800 piksel Portrait atau 1800 × 1200 piksel Landscape).
   - Resolusi: **300 DPI**.
   - Margin: **Borderless (0 cm / 0 mm)**.
   Format rendering ini wajib dipertahankan agar tidak terjadi distorsi atau gambar terpotong pada printer dye-sublimation fisik (DNP, Citizen, HiTi, Epson).

4. **KEAMANAN & ZERO SECRETS IN FRONTEND:**
   Jangan pernah menyertakan Midtrans Server Key, password database, atau JWT secret di dalam file frontend atau Electron preload. Semua komunikasi ke layanan pihak ketiga (Midtrans, Layanan Email SMTP, Object Storage) harus melalui rute backend Fastify.

5. **IDEMPOTENSI PEMBAYARAN:**
   Endpoint webhook Midtrans (`/api/webhooks/midtrans`) dan pelunasan kasir tunai wajib bersifat idempoten. Transaksi yang sudah bersatus `settlement` tidak boleh diproses ulang atau memicu sesi ganda.

---

## 9. Status Milestone & Tugas Selanjutnya untuk Agent

Sesuai `docs/MILESTONES.md` dan `docs/THE_NEXT_STEP.md`:
- **M0 s/d M13:** Arsitektur, database, API, dual-mode frontend, editor 4R, 5 pilar fungsional telah selesai diimplementasikan.
- **Tugas Selanjutnya yang Dapat Dikerjakan AI Agent:**
  1. **Pengujian Integrasi Hardware Fisik Nyata (M9 & M14):**
     - Uji coba langsung pengiriman print job ke printer fisik terpasang menggunakan `server/scripts/silent-print.ps1`.
     - Kalibrasi penyesuaian margin driver printer lab (DNP / Citizen) melalui menu **Admin > Hardware Settings**.
  2. **Packaging Windows Installer Standalone (M14):**
     - Konfigurasi `electron-builder` untuk membuat file installer `.exe` (NSIS) mandiri yang memaketkan Node.js, Fastify backend, dan frontend bundle menjadi satu paket distribusi siap pasang.
  3. **Auto-Start & Windows Kiosk Appliance Setup:**
     - Menyiapkan skrip registri Windows untuk auto-login user khusus Kiosk dan auto-start aplikasi saat komputer booth dinyalakan.
