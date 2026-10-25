# Rules: Architecture, Flow & State Machine

## 1. Pemisahan Komponen
- **Frontend (`frontend/`):** React 18, Vite 6, Tailwind CSS. Berfungsi murni sebagai UI/UX layar sentuh dan editor kanvas foto 4R.
- **Backend (`server/`):** Node.js 20, Fastify 5, Prisma 6. Otoritas tunggal kalkulasi harga, validasi voucher, integrasi Midtrans, pengiriman WhatsApp, dan database PostgreSQL.
- **Desktop Wrapper (`electron/`):** Electron 33. Mengunci kiosk (fullscreen, disable menu/shortcuts), single instance, dan jembatan ke hardware Windows native.

## 2. Dual-Mode API Adapter
- Semua interaksi API dari frontend harus melewati kontrak `IPhotoboothApi` (`frontend/src/services/api.interface.ts`).
- `httpPhotoboothApi.ts` adalah adapter ke Fastify backend (`http://localhost:3000/api`).
- Jika request backend gagal atau offline, fungsi-fungsi di `httpPhotoboothApi.ts` secara cerdas mengembalikan fallback dari `mockPhotoboothApi.ts`.
- **Aturan:** Pengembang atau AI Agent dilarang keras menghapus mekanisme fallback ini agar kiosk tidak pernah mengalami *white-screen of death* atau crash saat hardware/database terputus.

## 3. Customer State Machine
State pelanggan dikelola terpusat oleh `SessionContext.tsx`:
1. `WELCOME`: Tampilan idle attract screen. Tap 5x pada logo membuka `PinAuthModal`.
2. `PACKAGE`: Pemilihan paket sesi foto (durasi, jumlah foto, kuota cetak).
3. `PAYMENT`: Input voucher promo, checkout QRIS Midtrans atau Kasir Tunai (Cash Desk).
4. `CAMERA`: Sesi foto live view, hitung mundur, audio shimmer cue, safe zone guide 4R, clicker shutter pedal/layar.
5. `EDITOR`: Tata letak multi-slot foto 4R, pemilihan frame template, filter warna, sticker, teks ucapan.
6. `ADD_PRINT`: Penawaran tambahan cetak fisik (+Rp per lembar).
7. `DELIVERY`: Silent print ke Windows Spooler, QR Code galeri privat 48 jam, form input nomor WhatsApp resmi.
8. Reset otomatis kembali ke `WELCOME`.
