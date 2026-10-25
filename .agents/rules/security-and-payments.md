# Rules: Security, Authentication & Payment Integrity

## 1. Zero Secrets in Frontend
- Frontend (React 18) dan Electron preload tidak boleh menyimpan secret token, private API keys, atau password database.
- Kredensial sensitif berikut hanya boleh berada di file `server/.env`:
  - `MIDTRANS_SERVER_KEY`
  - `JWT_SECRET`
  - `BOOTH_API_KEY`
  - `WHATSAPP_ACCESS_TOKEN`
  - `S3_SECRET_KEY`
  - `DATABASE_URL`

## 2. Integritas Pembayaran Midtrans QRIS
- **Verifikasi Signature:** Setiap notifikasi webhook pada `POST /api/webhooks/midtrans` wajib memverifikasi signature hash SHA512:
  `SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)`
- **Idempotensi:** Webhook yang berulang untuk `order_id` yang sudah berstatus `settlement` tidak boleh memproses ulang database atau memicu sesi ganda.
- **Polling Reconciler:** Desktop frontend melakukan polling status ke `GET /api/payments/:orderId/status` setiap 2.5–3 detik sebagai cadangan jika webhook jaringan internet publik mengalami kelambatan.
- **Larangan Keras:** Sesi kamera tidak boleh diaktifkan sebelum transaksi dinyatakan `settlement` dan `isVerified: true` oleh backend.

## 3. Pembayaran Tunai (Cash Desk)
- Pelunasan tunai wajib diverifikasi oleh petugas kasir dengan memasukkan PIN Admin.
- Sistem memvalidasi nominal uang tunai yang diterima vs total tagihan.
- Sistem otomatis menghitung kembalian uang.
- Riwayat pelunasan tunai dicatat ke dalam audit log dengan rincian: operator, order ID, nominal diterima, dan kembalian.
- PIN kasir dilarang dicatat dalam log atau disimpan plaintext.

## 4. Keamanan Admin Panel
- **Hashing:** PIN Admin di-hash menggunakan algoritma **Argon2id**.
- **Brute-Force Lockout:** Kegagalan input PIN sebanyak 5 kali berturut-turut akan mengunci akses admin selama **10 menit**.
- **Masa Berlaku Token:** JWT Admin dibatasi masa aktifnya maksimal 4 jam.
