# MINJAPHOTOBOOTH — TEST PLAN

**Versi:** 2.0  
**Terakhir diperbarui:** 2026-10-17  
**Status:** Draft — Menunggu Review  
**Framework Testing:** Vitest + Supertest  

---

## 1. Strategi Pengujian

### 1.1 Piramida Pengujian

```
         ┌──────────┐
         │   E2E    │  ← Sedikit, mahal, lambat
         │  Tests   │     (Playwright / manual)
         ├──────────┤
         │  Integ-  │  ← Menengah
         │  ration  │     (Supertest + DB test)
         │  Tests   │
         ├──────────┤
         │  Unit    │  ← Banyak, murah, cepat
         │  Tests   │     (Vitest, mock adapters)
         └──────────┘
```

### 1.2 Prinsip

1. **Setiap milestone harus memiliki test yang lolos sebelum lanjut.**
2. **Adapter eksternal di-mock saat unit test.** Kita tidak memerlukan koneksi Midtrans atau server SMTP Email asli untuk unit test.
3. **Integration test menggunakan database PostgreSQL test** (bisa menggunakan container Docker atau database terpisah).
4. **Test yang memerlukan perangkat fisik (kamera, printer) ditandai dan dijelaskan cara pengujian manualnya.**
5. **Tidak ada mock yang berpura-pura perangkat berfungsi.** Mock hanya mengembalikan data struktur yang valid, tidak mensimulasikan perilaku perangkat.

---

## 2. Konfigurasi Test

### 2.1 Environment Test

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5432/minjaphotobooth_test
JWT_SECRET=test-jwt-secret-only-for-testing
BOOTH_API_KEY=test-booth-key
MIDTRANS_SERVER_KEY=test-midtrans-server-key
MIDTRANS_IS_PRODUCTION=false
NODE_ENV=test
```

### 2.2 Perintah Test

```bash
# Seluruh test
npm test

# Unit test saja
npm run test:unit

# Integration test saja
npm run test:integration

# Test dengan coverage
npm run test:coverage

# Test spesifik file
npx vitest run src/services/payment.service.test.ts
```

---

## 3. Test Cases per Domain

### 3.1 Admin Authentication

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| A01 | Setup admin pertama kali | Integration | Tidak ada admin di DB | 201, admin terbuat, PIN ter-hash |
| A02 | Setup admin duplikat | Integration | Admin sudah ada | 409 CONFLICT |
| A03 | Login dengan PIN benar | Integration | PIN valid | 200, JWT diterbitkan |
| A04 | Login dengan PIN salah | Integration | PIN salah | 401 INVALID_PIN, failedAttempts++ |
| A05 | Lockout setelah 5x gagal | Integration | 5x salah berturut-turut | 429 ADMIN_LOCKED_OUT |
| A06 | Login setelah lockout berakhir | Integration | 10 menit telah lewat | 200, JWT diterbitkan |
| A07 | Ubah PIN berhasil | Integration | currentPin valid, newPin valid | 200, hash baru tersimpan |
| A08 | Ubah PIN tanpa currentPin | Integration | currentPin tidak dikirim | 400 VALIDATION_ERROR |
| A09 | Ubah PIN dengan currentPin salah | Integration | currentPin salah | 401 INVALID_PIN |
| A10 | PIN terlalu pendek | Unit | PIN < 6 digit | 400 PIN_TOO_SHORT |
| A11 | PIN berupa angka berurutan | Unit | PIN = "123456" | 400 VALIDATION_ERROR |
| A12 | PIN berupa angka berulang | Unit | PIN = "111111" | 400 VALIDATION_ERROR |
| A13 | Akses endpoint admin tanpa JWT | Integration | Tidak ada header Authorization | 401 UNAUTHORIZED |
| A14 | Akses endpoint admin dengan JWT expired | Integration | Token kadaluwarsa | 401 UNAUTHORIZED |
| A15 | Audit log tercatat saat login | Integration | Login berhasil | AuditLog record ADMIN_LOGIN terbuat |

### 3.2 Settings

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| S01 | Ambil settings publik | Integration | Settings ada di DB | 200, hanya field publik |
| S02 | Ambil settings admin | Integration | JWT valid | 200, seluruh field termasuk internal |
| S03 | Update settings | Integration | JWT valid, data valid | 200, settings diperbarui |
| S04 | Update settings tanpa JWT | Integration | Tanpa Authorization | 401 UNAUTHORIZED |
| S05 | Update color format salah | Unit | primaryColor = "merah" | 400 VALIDATION_ERROR |
| S06 | Retention hours di luar range | Unit | retentionHours = 0 | 400 VALIDATION_ERROR |
| S07 | Audit log saat settings diubah | Integration | Settings diperbarui | AuditLog SETTINGS_UPDATED terbuat |

### 3.3 Packages

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| P01 | Ambil paket publik (aktif saja) | Integration | Ada paket aktif & nonaktif | 200, hanya paket aktif |
| P02 | Ambil semua paket (admin) | Integration | JWT valid | 200, termasuk paket nonaktif |
| P03 | Buat paket baru | Integration | JWT valid, data valid | 201, paket terbuat |
| P04 | Buat paket dengan nama duplikat | Integration | Nama sudah ada | 409 CONFLICT |
| P05 | Harga bukan kelipatan 500 | Unit | price = 35123 | 400 VALIDATION_ERROR |
| P06 | maxSelections > maxShots | Unit | max_sel = 10, max_shots = 5 | 400 VALIDATION_ERROR |
| P07 | Update paket | Integration | JWT valid | 200, paket diperbarui |
| P08 | Nonaktifkan paket | Integration | JWT valid | 200, isActive = false |
| P09 | Paket nonaktif tidak muncul di publik | Integration | Paket dinonaktifkan | GET publik tidak mengembalikannya |

### 3.4 Templates

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| T01 | Ambil template aktif | Integration | Ada template aktif | 200, daftar template |
| T02 | Buat template | Integration | JWT valid, data valid | 201, template terbuat |
| T03 | slots.length !== slotsCount | Unit | 3 slots tapi slotsCount = 2 | 400 VALIDATION_ERROR |
| T04 | Slot melampaui batas canvas | Unit | x + width > 1200 | 400 VALIDATION_ERROR |
| T05 | Update template | Integration | JWT valid | 200, template diperbarui |
| T06 | Nonaktifkan template | Integration | JWT valid | 200, isActive = false |

### 3.5 Sessions

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| SS01 | Buat sesi | Integration | Paket aktif ada | 201, sesi dengan harga terhitung |
| SS02 | Harga dihitung ulang oleh backend | Integration | Client tidak mengirim harga | totalPrice = basePrice + (additionalPrints × additionalPrintPrice) |
| SS03 | Buat sesi dengan paket nonaktif | Integration | Paket isActive = false | 400 PACKAGE_INACTIVE |
| SS04 | Buat sesi saat sesi aktif sudah ada | Integration | Sesi CAPTURE_ACTIVE ada | 409 ACTIVE_SESSION_EXISTS |
| SS05 | Ambil sesi aktif | Integration | Sesi ada | 200, SessionDto |
| SS06 | Ambil sesi aktif saat tidak ada | Integration | Tidak ada sesi aktif | 200, null |
| SS07 | Transisi state valid | Unit | PAYMENT_CONFIRMED → CAPTURE_ACTIVE | State berubah |
| SS08 | Transisi state tidak valid | Unit | AWAITING_PAYMENT → CAPTURE_ACTIVE | 400 INVALID_SESSION_STATE |
| SS09 | Selesaikan sesi | Integration | State = SHARING | 200, state = COMPLETED |
| SS10 | Batalkan sesi | Integration | Sesi aktif | 200, state = CANCELLED |
| SS11 | Sesi kadaluwarsa otomatis | Integration | expiresAt sudah lewat | State → EXPIRED (oleh worker) |

### 3.6 Payments

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| PM01 | Buat pembayaran QRIS | Integration | Sesi AWAITING_PAYMENT, Midtrans adapter di-mock | 201, qrString ada, status pending |
| PM02 | Buat pembayaran untuk sesi yang sudah bayar | Integration | Sesi PAYMENT_CONFIRMED | 400 INVALID_SESSION_STATE |
| PM03 | Polling status pending | Integration | Payment status pending | 200, transactionStatus = "pending" |
| PM04 | Webhook settlement valid | Integration | Signature valid, order_id ada | 200, payment → settlement, session → PAYMENT_CONFIRMED |
| PM05 | Webhook dengan signature salah | Integration | Signature tidak cocok | 400 INVALID_WEBHOOK_SIGNATURE |
| PM06 | Webhook idempoten (duplikat) | Integration | Payment sudah settlement | 200, tidak ada perubahan |
| PM07 | Webhook expire | Integration | transaction_status = "expire" | 200, payment → expire, session → EXPIRED |
| PM08 | Webhook deny | Integration | transaction_status = "deny" | 200, payment → deny, session → CANCELLED |
| PM09 | Order ID tidak ditemukan | Integration | order_id asing | 404 NOT_FOUND |
| PM10 | WebhookEvent tercatat | Integration | Webhook valid masuk | Record di webhook_events terbuat |
| PM11 | Desktop polling setelah settlement | Integration | Payment sudah settlement | isVerified = true |
| PM12 | Harga di payment cocok dengan sesi | Unit | Sesi totalPrice = 35000 | Payment grossAmount = 35000 |

### 3.7 Photos

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| PH01 | Simpan metadata foto | Integration | Sesi CAPTURE_ACTIVE | 201, foto tersimpan |
| PH02 | Simpan foto melebihi maxShots | Integration | shotsTaken = maxShots | 400 MAX_PHOTOS_REACHED |
| PH03 | Duplikat shotNumber | Integration | sessionId + shotNumber sudah ada | 409 CONFLICT |
| PH04 | Pilih foto | Integration | Foto ada | 200, isSelected = true |
| PH05 | Pilih foto melebihi maxSelections | Integration | Sudah maxSelections terpilih | 400 VALIDATION_ERROR |
| PH06 | Ambil foto per sesi | Integration | 3 foto dalam sesi | 200, 3 item |
| PH07 | Upload foto ke storage | Integration | Storage adapter di-mock | 200, storageKey dan storageUrl diisi |

### 3.8 Gallery

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| G01 | Buat galeri | Integration | Sesi selesai, foto sudah di-upload | 201, token + URL + QR code |
| G02 | Akses galeri dengan token valid | Integration | Token ada, belum kadaluwarsa | 200, daftar foto dengan signed URLs |
| G03 | Akses galeri dengan token salah | Integration | Token tidak ada | 404 GALLERY_TOKEN_INVALID |
| G04 | Akses galeri kadaluwarsa | Integration | expiresAt sudah lewat | 410 GALLERY_EXPIRED |
| G05 | Token galeri cukup panjang | Unit | Token yang dihasilkan | Panjang 32 karakter |
| G06 | accessCount bertambah saat diakses | Integration | Galeri diakses 3x | accessCount = 3 |

### 3.9 Delivery (Email)

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| D01 | Kirim Soft File Email | Integration | Email adapter di-mock, email valid | 200/202, sent = true |
| D02 | Alamat email format salah | Unit | email = "bukan-email" | 400 EMAIL_INVALID_ADDRESS |
| D03 | Alamat email valid | Unit | email = "pelanggan@gmail.com" | Lolos validasi |
| D04 | Galeri kadaluwarsa saat kirim | Integration | Gallery expired | 400 GALLERY_EXPIRED |
| D05 | Retry saat pengiriman gagal | Unit | Mock transporter throw error | retryCount++ , status tetap queued |
| D06 | Maks retry tercapai | Unit | retryCount >= maxRetries | status = failed |

### 3.10 Reports

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| R01 | Ringkasan laporan | Integration | Ada transaksi di range tanggal | 200, totalRevenue benar |
| R02 | Laporan dengan filter status | Integration | Filter settlement only | Hanya transaksi settlement |
| R03 | Laporan rentang tanggal kosong | Integration | Tidak ada transaksi | 200, semua counter = 0 |
| R04 | Ekspor CSV | Integration | Ada data | 200, Content-Type text/csv |
| R05 | CSV memiliki header yang benar | Unit | CSV output | Kolom sesuai TransactionReportItem |
| R06 | Laporan tanpa JWT | Integration | Tanpa Authorization | 401 UNAUTHORIZED |

### 3.11 Audit Log

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| AL01 | Ambil audit log | Integration | JWT valid, ada log | 200, daftar log |
| AL02 | Filter audit log by action | Integration | Filter "ADMIN_LOGIN" | Hanya log login |
| AL03 | Filter audit log by date | Integration | Range tanggal spesifik | Hanya log dalam range |
| AL04 | Setiap operasi admin membuat log | Integration | Buat paket baru | AuditLog PACKAGE_CREATED terbuat |

### 3.12 System

| # | Test Case | Tipe | Kondisi | Hasil yang Diharapkan |
|---|-----------|------|---------|----------------------|
| SY01 | Health check | Integration | Server berjalan | 200, status = "ok" |
| SY02 | Health check dengan DB down | Integration | DB tidak tersedia | 200, status = "degraded" |
| SY03 | Cek versi | Integration | Booth-Key valid | 200, currentVersion ada |

---

## 4. Test untuk Adapter (Mock vs Real)

### 4.1 Midtrans Adapter

| # | Test Case | Mock/Real | Keterangan |
|---|-----------|-----------|------------|
| MA01 | Create QRIS transaction | Mock | Mock mengembalikan qrString dummy |
| MA02 | Get status | Mock | Mock mengembalikan status yang dikonfigurasi |
| MA03 | Verify signature (valid) | Unit | Menggunakan test server key |
| MA04 | Verify signature (invalid) | Unit | Menggunakan key yang salah |
| MA05 | Sandbox transaction | Real (manual) | Memerlukan akun Midtrans sandbox |
| MA06 | Production transaction | Real (manual) | Memerlukan akun Midtrans production |

### 4.2 Email Delivery Service

| # | Test Case | Mock/Real | Keterangan |
|---|-----------|-----------|------------|
| EM01 | Send email notification | Mock | Simulasi dev mengembalikan sent=true & messageId |
| EM02 | Invalid email address | Mock | Validasi sanitizeEmail melempar EMAIL_INVALID_ADDRESS |
| EM03 | Kirim ke inbox nyata | Real (manual) | Memerlukan kredensial SMTP aktif |

### 4.3 Storage Adapter

| # | Test Case | Mock/Real | Keterangan |
|---|-----------|-----------|------------|
| ST01 | Upload file | Mock | Mock mengembalikan storageKey |
| ST02 | Get signed URL | Mock | Mock mengembalikan URL dummy |
| ST03 | Delete file | Mock | Mock mengembalikan void |
| ST04 | Upload ke S3/R2 nyata | Real (manual) | Memerlukan bucket terkonfigurasi |

---

## 5. Test yang Memerlukan Perangkat Fisik

Pengujian berikut **tidak dapat diotomasi** dan harus dilakukan secara manual dengan perangkat fisik. Pada unit test, digunakan mock adapter yang mengembalikan data berstruktur valid (bukan simulasi perangkat berfungsi).

| # | Pengujian | Perangkat | Cara Uji Manual |
|---|-----------|-----------|-----------------|
| HW01 | Live preview webcam | Webcam USB | Jalankan desktop app, buka sesi kamera, verifikasi preview 30fps |
| HW02 | Capture webcam | Webcam USB | Tekan shutter, verifikasi file JPEG tersimpan |
| HW03 | Live preview Canon EOS 600D | Canon EOS 600D + USB | Hubungkan kamera, buka sesi, verifikasi preview |
| HW04 | Capture Canon EOS 600D | Canon EOS 600D + USB | Tekan shutter, verifikasi file RAW/JPEG tersimpan |
| HW05 | Deteksi kamera disconnect | Webcam/DSLR | Cabut USB saat live preview, verifikasi error handling |
| HW06 | Print 4R | Printer foto 4R | Submit print job, verifikasi ukuran dan kualitas cetakan |
| HW07 | Printer offline detection | Printer | Matikan printer, verifikasi status "offline" |
| HW08 | Paper jam handling | Printer | Simulasi paper jam, verifikasi error message |
| HW09 | Touchscreen interaction | Layar sentuh | Tap, swipe, dan gesture pada seluruh alur UI |
| HW10 | Scan QR dari HP | Smartphone | Scan QR galeri dari layar booth, akses galeri di browser HP |

---

## 6. Test Coverage Target

| Layer | Target | Keterangan |
|-------|--------|------------|
| Service layer (business logic) | ≥ 90% | Semua kalkulasi harga, state machine, dan validasi |
| Route handlers | ≥ 80% | Request parsing, auth check, response formatting |
| Adapters (mock implementations) | ≥ 70% | Verifikasi kontrak interface |
| Utils & helpers | ≥ 90% | Crypto, signature, validation |
| Electron IPC handlers | ≥ 60% | Terbatas pada unit test (tanpa hardware) |
| Total project | ≥ 80% | Gabungan seluruh layer |

---

## 7. Pengujian Non-Fungsional

| # | Aspek | Metode | Kriteria Lulus |
|---|-------|--------|---------------|
| NF01 | Latensi sentuh UI | Manual measurement | < 50ms response time |
| NF02 | Rendering 4R tidak freeze UI | Manual observation | UI tetap responsif saat render 300 DPI berjalan di background |
| NF03 | Cetak tidak freeze UI | Manual observation | UI tetap responsif saat spooler mencetak |
| NF04 | Offline mode | Putuskan internet | Sesi yang sudah aktif tetap berjalan, data tersimpan di SQLite |
| NF05 | Recovery setelah crash | Kill process, restart | Sesi terakhir dapat dilanjutkan atau direset dengan benar |
| NF06 | Update tidak menghapus data | Install update | Database, foto, dan konfigurasi tetap ada |
| NF07 | Memory usage stabil | Monitor selama 8 jam | Tidak ada memory leak yang signifikan |
