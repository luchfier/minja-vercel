# MINJAPHOTOBOOTH — SECURITY DOCUMENT

**Versi:** 2.0  
**Terakhir diperbarui:** 2026-10-17  
**Status:** Draft — Menunggu Review  

---

## 1. Ringkasan Ancaman & Model Keamanan

MinjaPhotobooth beroperasi di lingkungan semi-publik (booth di mall, event, studio). Permukaan serangan meliputi:

| Vektor Ancaman | Risiko | Mitigasi |
|----------------|--------|----------|
| Akses fisik ke mesin | Orang mengakses panel admin tanpa izin | PIN admin ter-hash, brute force lockout, menu tersembunyi |
| Manipulasi harga | Client mengirim harga palsu ke backend | Backend menghitung harga dari database, tidak mempercayai client |
| Webhook palsu | Penyerang mengirim notifikasi pembayaran palsu | Verifikasi signature SHA512 dengan server key |
| Redirect QRIS palsu | Tampilan "pembayaran berhasil" di frontend tanpa verifikasi backend | Sesi hanya aktif setelah backend memverifikasi status `settlement` |
| Pencurian foto | Akses galeri tanpa izin melalui URL guessing | Token nanoid 32 karakter (kriptografis), retensi terbatas |
| Kebocoran secret | API keys terekspos di source code atau frontend | Environment variables, .env tidak di-commit, tidak ada secret di renderer |
| Brute force PIN | Percobaan PIN berulang-ulang | Lockout 10 menit setelah 5 kali gagal |
| Eavesdropping | Pencurian data di jaringan lokal | HTTPS untuk backend produksi, localhost untuk dev |

---

## 2. Autentikasi & Otorisasi

### 2.1 Tiga Tingkat Akses

| Tingkat | Mekanisme | Digunakan Oleh | Header |
|---------|-----------|----------------|--------|
| **Public** | Tidak ada autentikasi | Pelanggan (halaman QRIS, galeri) | Tidak ada |
| **Booth** | Static API key per mesin | Desktop client (Electron) | `X-Booth-Key: <key>` |
| **Admin** | JWT setelah verifikasi PIN | Panel admin | `Authorization: Bearer <jwt>` |

### 2.2 Admin PIN — Hashing & Penyimpanan

**Algoritma:** Argon2id  
**Alasan pemilihan:** Tahan terhadap serangan GPU (memory-hard), direkomendasikan oleh OWASP.

**Parameter Argon2id:**
```typescript
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,      // 64 MB
  timeCost: 3,             // 3 iterasi
  parallelism: 4,
  hashLength: 32,
  saltLength: 16,          // Salt acak otomatis
};
```

**Proses Hashing PIN:**
1. Admin memasukkan PIN (6-12 digit).
2. Backend menghasilkan salt acak 16 byte secara otomatis.
3. PIN di-hash dengan Argon2id dan parameter di atas.
4. Hasil hash (termasuk salt, parameter) disimpan di kolom `pinHash` tabel `Admin`.
5. PIN asli **tidak pernah disimpan** dan **tidak dapat dipulihkan**.

**Proses Verifikasi PIN:**
1. Admin memasukkan PIN.
2. Backend mengambil `pinHash` dari database.
3. Argon2id `verify()` membandingkan PIN input dengan hash yang tersimpan.
4. Jika cocok: terbitkan JWT, reset `failedAttempts` ke 0.
5. Jika tidak cocok: increment `failedAttempts`.

### 2.3 Proteksi Brute Force

```typescript
const BRUTE_FORCE_CONFIG = {
  maxAttempts: 5,
  lockoutMinutes: 10,
};
```

**Alur:**
1. Setiap login gagal, increment `failedAttempts` di tabel `Admin`.
2. Jika `failedAttempts >= 5`, set `lockedUntil = now + 10 menit`.
3. Selama `lockedUntil > now`, seluruh percobaan login ditolak dengan `ADMIN_LOCKED_OUT`.
4. Setelah `lockedUntil` lewat, reset `failedAttempts = 0`.
5. Login berhasil juga me-reset `failedAttempts = 0`.
6. Setiap kejadian lockout dicatat di `AuditLog`.

### 2.4 JWT (Admin Session Token)

```typescript
const JWT_CONFIG = {
  algorithm: "HS256",
  expiresIn: "4h",
  issuer: "minjaphotobooth",
};
```

- **Payload JWT:**
  ```json
  {
    "sub": "<admin_id>",
    "iss": "minjaphotobooth",
    "iat": 1729123456,
    "exp": 1729137856
  }
  ```
- **Secret:** Diambil dari `JWT_SECRET` di environment variable.
- **Penyimpanan di client:** Disimpan di memori runtime Electron (bukan localStorage atau cookie).
- **Invalidasi:** Client membuang token saat logout. Backend tidak menyimpan daftar token aktif (stateless).

### 2.5 Booth API Key

- Setiap mesin booth memiliki static API key unik yang dikonfigurasi di `.env`.
- Key ini digunakan sebagai header `X-Booth-Key` untuk endpoint non-publik non-admin.
- Key ini **bukan** secret kriptografis — fungsinya membedakan booth dan mencegah akses tanpa otorisasi dari jaringan lokal.

---

## 3. Keamanan Pembayaran

### 3.1 Prinsip Utama

> **Jangan pernah mengasumsikan bahwa redirect ke halaman sukses atau tampilan QRIS berarti pembayaran berhasil. Sesi hanya boleh aktif setelah backend memvalidasi status pembayaran final yang sah.**

### 3.2 Verifikasi Signature Webhook Midtrans

```typescript
function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
  serverKey: string
): boolean {
  const payload = orderId + statusCode + grossAmount + serverKey;
  const expectedSignature = crypto
    .createHash("sha512")
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signatureKey)
  );
}
```

**Poin penting:**
- Menggunakan `timingSafeEqual` untuk mencegah timing attack.
- `serverKey` diambil dari `MIDTRANS_SERVER_KEY` di environment variable.
- Jika signature tidak valid, webhook ditolak dengan `400 Bad Request` dan dicatat di `WebhookEvent` dengan `signatureValid: false`.

### 3.3 Idempotensi Webhook

1. Setiap webhook masuk dicatat di tabel `WebhookEvent` dengan `rawPayload`.
2. Sebelum memproses, backend memeriksa apakah `order_id` sudah berstatus `settlement` di tabel `Payment`.
3. Jika sudah `settlement`, backend merespons `200 OK` tanpa mengubah apa pun.
4. Jika belum, backend memperbarui `Payment.transactionStatus` dan `Session.state`.
5. Proses update menggunakan database transaction untuk menjamin konsistensi.

### 3.4 Polling Reconciler

Jika webhook belum diterima, desktop melakukan polling ke `GET /api/payments/:orderId/status`:
1. Backend dapat melakukan secondary check ke Midtrans Status API jika diperlukan.
2. Jika Midtrans API melaporkan `settlement`, backend memperbarui record dan merespons `isVerified: true`.
3. Desktop client hanya mengaktifkan sesi kamera jika `transactionStatus === "settlement" && isVerified === true`.

### 3.5 Server-Side Price Calculation

```
DILARANG:
  Client → Backend: { packageId: "abc", price: 35000 }  ❌

WAJIB:
  Client → Backend: { packageId: "abc", additionalPrints: 2 }  ✅
  
Backend melakukan:
  package = db.findPackage("abc")
  totalPrice = package.price + (2 * package.additionalPrintPrice)
```

---

## 4. Penyimpanan Rahasia (Secret Management)

### 4.1 Daftar Environment Variables

```bash
# .env (TIDAK BOLEH DI-COMMIT KE GIT)

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/minjaphotobooth

# JWT
JWT_SECRET=<random-string-minimal-32-karakter>

# Booth
BOOTH_API_KEY=<random-string-unik-per-mesin>

# Midtrans
MIDTRANS_SERVER_KEY=<server-key-dari-dashboard-midtrans>
MIDTRANS_CLIENT_KEY=<client-key-dari-dashboard-midtrans>
MIDTRANS_IS_PRODUCTION=false

# Email SMTP Delivery
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@minjaphotobooth.com
SMTP_PASS=app-specific-password
SMTP_FROM="Minja Photobooth <noreply@minjaphotobooth.com>"

# Object Storage
S3_ENDPOINT=<endpoint-url>
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_BUCKET_NAME=minjaphotobooth
S3_REGION=auto

# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### 4.2 Aturan Pengelolaan Secret

1. File `.env` **dilarang keras** di-commit ke Git. Sudah dikecualikan via `.gitignore`.
2. File `.env.example` berisi daftar variabel tanpa nilai, sebagai referensi.
3. Pada produksi, environment variables diatur langsung di sistem operasi atau manajer secret.
4. Backend memvalidasi kehadiran semua variabel wajib saat startup. Jika ada yang kosong, proses tidak akan dimulai.
5. Tidak ada default value untuk variabel keamanan (PIN, key, token).
6. **Tidak ada secret yang dikirim ke Electron renderer.** `MIDTRANS_CLIENT_KEY` mungkin diperlukan untuk widget Snap di frontend, tetapi karena kita menggunakan QR string langsung dari backend, client key pun tidak diperlukan di frontend.

### 4.3 Apa yang Boleh dan Tidak Boleh di Frontend

| Data | Frontend | Backend |
|------|----------|---------|
| Midtrans Server Key | ❌ | ✅ |
| Midtrans Client Key | ❌ | ✅ |
| Kredensial SMTP Email | ❌ | ✅ |
| S3 Secret Key | ❌ | ✅ |
| JWT Secret | ❌ | ✅ |
| Database Password | ❌ | ✅ |
| Booth API Key | ✅ (di Electron Main, bukan di renderer) | ✅ |
| QR String (QRIS) | ✅ (untuk tampilan) | ✅ |
| Gallery URL | ✅ (untuk QR display) | ✅ |
| Harga paket (read-only) | ✅ (untuk tampilan) | ✅ (sumber kebenaran) |

---

## 5. Privasi Galeri & Perlindungan Foto

### 5.1 Token Galeri

- **Generator:** `nanoid` dengan charset alfanumerik + `_-`, panjang 32 karakter.
- **Entropi:** ~190 bit (cukup untuk mencegah brute force dalam waktu praktis).
- **Contoh:** `V3kLm9xR-2nYp4wQ_8bTfJ6hA1cDsE7g`
- **URL:** `https://booth.minja.id/g/V3kLm9xR-2nYp4wQ_8bTfJ6hA1cDsE7g`

### 5.2 Signed Download URL

- Foto di object storage tidak dapat diakses langsung (private bucket).
- Backend menghasilkan signed URL dengan masa berlaku 1 jam saat galeri diakses.
- Signed URL berisi timestamp + signature yang diverifikasi oleh S3/R2.
- Setelah 1 jam, URL tidak valid lagi (harus akses galeri ulang).

### 5.3 Retensi Otomatis

1. Admin mengonfigurasi `retentionHours` (default: 48 jam).
2. Cron job backend berjalan setiap 1 jam.
3. Cron job mencari galeri dengan `expiresAt < now`.
4. Untuk setiap galeri kadaluwarsa:
   - Hapus file dari object storage.
   - Hapus record `Photo.storageKey` dan `Gallery`.
   - Record `Session` dan `Payment` tetap tersimpan (untuk audit).

---

## 6. Keamanan Jaringan

### 6.1 CORS

```typescript
const CORS_CONFIG = {
  origin: [
    "http://localhost:5173",  // Vite dev server
    "app://.",                // Electron production
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Booth-Key"],
  credentials: false,
};
```

### 6.2 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/admin/login` | 5 requests | 10 menit (+ lockout) |
| `POST /api/webhooks/midtrans` | 60 requests | 1 menit |
| `POST /api/payments` | 10 requests | 1 menit |
| `POST /api/sessions/:sessionId/email` | 5 requests | 1 menit |
| Endpoint lainnya | 100 requests | 1 menit |

### 6.3 Helmet & Headers

Backend Fastify menggunakan `@fastify/helmet` untuk menambahkan security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000` (jika HTTPS)
- `Content-Security-Policy: default-src 'self'`

### 6.4 HTTPS

- **Development:** HTTP di `localhost:3000` (cukup aman untuk lokal).
- **Production:** HTTPS wajib jika backend diakses melalui jaringan (reverse proxy Nginx/Caddy).
- **Webhook Midtrans:** Midtrans mengirim webhook ke URL HTTPS. Untuk development, gunakan tunnel (ngrok/cloudflared).

---

## 7. Keamanan Desktop (Electron)

### 7.1 Isolasi Renderer

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,       // ❌ Tidak ada akses Node.js
    contextIsolation: true,       // ✅ Isolasi penuh
    sandbox: true,                // ✅ Sandbox aktif
    preload: path.join(__dirname, "preload.js"),
    webSecurity: true,            // ✅ Same-origin policy aktif
    allowRunningInsecureContent: false,
  },
  // Sembunyikan menu bar (mencegah akses DevTools via menu)
  autoHideMenuBar: true,
});

// Disable keyboard shortcut DevTools di produksi
if (process.env.NODE_ENV === "production") {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || (input.control && input.shift && input.key === "I")) {
      event.preventDefault();
    }
  });
}
```

### 7.2 Preload Script

- Hanya mengekspos fungsi yang didefinisikan secara eksplisit via `contextBridge`.
- Tidak mengekspos `require()`, `fs`, `child_process`, atau modul Node.js lainnya.
- Setiap channel IPC didefinisikan dengan nama eksplisit (whitelist, bukan wildcard).

### 7.3 Kiosk Mode (Produksi)

```typescript
const mainWindow = new BrowserWindow({
  fullscreen: true,
  kiosk: true,
  frame: false,
  resizable: false,
  // ...webPreferences
});
```

---

## 8. Checklist Keamanan

Daftar ini harus diverifikasi sebelum deployment ke produksi:

- [ ] Semua secret ada di `.env` dan `.env` tidak ada di Git.
- [ ] Tidak ada hardcoded secret di source code.
- [ ] PIN admin di-hash dengan Argon2id, bukan plaintext.
- [ ] Tidak ada PIN default yang tetap.
- [ ] Brute force lockout berfungsi (5x gagal → kunci 10 menit).
- [ ] JWT secret minimal 32 karakter acak.
- [ ] Webhook Midtrans diverifikasi dengan SHA512 signature.
- [ ] Harga dikalkulasi di backend, bukan dipercaya dari client.
- [ ] Sesi kamera hanya aktif setelah `settlement + isVerified`.
- [ ] Token galeri menggunakan nanoid 32 karakter.
- [ ] Foto di object storage menggunakan private bucket + signed URLs.
- [ ] Retensi galeri berfungsi (cron job menghapus galeri kadaluwarsa).
- [ ] CORS dikonfigurasi hanya untuk origin yang diizinkan.
- [ ] Rate limiting aktif di endpoint sensitif.
- [ ] Renderer Electron terisolasi (`nodeIntegration: false`, `contextIsolation: true`).
- [ ] DevTools dinonaktifkan di produksi.
- [ ] HTTPS digunakan jika backend tidak di localhost.
