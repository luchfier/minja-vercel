# MINJAPHOTOBOOTH — API CONTRACT SPECIFICATION

**Versi:** 2.0  
**Terakhir diperbarui:** 2026-10-17  
**Status:** Draft — Menunggu Review  
**Transport:** HTTP REST (JSON) via Fastify  
**Base URL:** `http://localhost:3000/api`  

---

## 1. Konvensi Umum

### 1.1 Format Respons

Seluruh endpoint mengembalikan format seragam:

```typescript
// Sukses
{
  "success": true,
  "data": T,
  "timestamp": "2026-10-17T01:00:00.000Z"
}

// Gagal
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Pesan error yang dapat dibaca manusia",
    "details": {} // Opsional, detail tambahan
  },
  "timestamp": "2026-10-17T01:00:00.000Z"
}
```

### 1.2 TypeScript Type

```typescript
export type ApiResponse<T> =
  | { success: true; data: T; timestamp: string }
  | { success: false; error: ApiError; timestamp: string };

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

### 1.3 Autentikasi

- **Endpoint publik** (pelanggan): Tidak memerlukan token. Prefix: `/api/public/*`
- **Endpoint admin**: Memerlukan header `Authorization: Bearer <JWT>`. Prefix: `/api/admin/*`
- **Endpoint webhook**: Diverifikasi dengan signature Midtrans SHA512. Prefix: `/api/webhooks/*`
- **Endpoint internal** (desktop ke backend): Memerlukan header `X-Booth-Key: <BOOTH_API_KEY>`. Prefix: `/api/*` (non-public, non-admin)

### 1.4 Pagination

Endpoint yang mengembalikan daftar mendukung query parameters:

```typescript
interface PaginationParams {
  page?: number;    // Default: 1, minimum: 1
  limit?: number;   // Default: 20, maximum: 100
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## 2. Daftar Error Codes

```typescript
export enum ErrorCode {
  // === General ===
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",

  // === Admin Auth ===
  INVALID_PIN = "INVALID_PIN",
  ADMIN_LOCKED_OUT = "ADMIN_LOCKED_OUT",
  PIN_TOO_SHORT = "PIN_TOO_SHORT",
  PIN_CHANGE_REQUIRES_CURRENT = "PIN_CHANGE_REQUIRES_CURRENT",
  ADMIN_NOT_INITIALIZED = "ADMIN_NOT_INITIALIZED",

  // === Session ===
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  INVALID_SESSION_STATE = "INVALID_SESSION_STATE",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_ALREADY_COMPLETED = "SESSION_ALREADY_COMPLETED",
  ACTIVE_SESSION_EXISTS = "ACTIVE_SESSION_EXISTS",

  // === Package ===
  PACKAGE_NOT_FOUND = "PACKAGE_NOT_FOUND",
  PACKAGE_INACTIVE = "PACKAGE_INACTIVE",
  PACKAGE_HAS_SESSIONS = "PACKAGE_HAS_SESSIONS",

  // === Template ===
  TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND",
  TEMPLATE_INACTIVE = "TEMPLATE_INACTIVE",

  // === Payment & Cash ===
  PAYMENT_CREATION_FAILED = "PAYMENT_CREATION_FAILED",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  PAYMENT_ALREADY_SETTLED = "PAYMENT_ALREADY_SETTLED",
  PAYMENT_EXPIRED = "PAYMENT_EXPIRED",
  PAYMENT_DENIED = "PAYMENT_DENIED",
  INVALID_WEBHOOK_SIGNATURE = "INVALID_WEBHOOK_SIGNATURE",
  CASH_UNDERPAID = "CASH_UNDERPAID",
  CASH_CONFIRMATION_FAILED = "CASH_CONFIRMATION_FAILED",

  // === Voucher ===
  VOUCHER_NOT_FOUND = "VOUCHER_NOT_FOUND",
  VOUCHER_EXPIRED = "VOUCHER_EXPIRED",
  VOUCHER_QUOTA_EXCEEDED = "VOUCHER_QUOTA_EXCEEDED",
  VOUCHER_MIN_NOT_MET = "VOUCHER_MIN_NOT_MET",
  VOUCHER_PACKAGE_INELIGIBLE = "VOUCHER_PACKAGE_INELIGIBLE",
  VOUCHER_INACTIVE = "VOUCHER_INACTIVE",

  // === Photo ===
  PHOTO_NOT_FOUND = "PHOTO_NOT_FOUND",
  MAX_PHOTOS_REACHED = "MAX_PHOTOS_REACHED",
  PHOTO_SESSION_MISMATCH = "PHOTO_SESSION_MISMATCH",

  // === Camera (Desktop Only) ===
  CAMERA_NOT_FOUND = "CAMERA_NOT_FOUND",
  CAMERA_BUSY = "CAMERA_BUSY",
  CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED",
  CAPTURE_FAILED = "CAPTURE_FAILED",

  // === Printer (Desktop Only) ===
  PRINTER_OFFLINE = "PRINTER_OFFLINE",
  PRINTER_ERROR = "PRINTER_ERROR",
  PRINT_JOB_FAILED = "PRINT_JOB_FAILED",

  // === Gallery & Delivery ===
  GALLERY_NOT_FOUND = "GALLERY_NOT_FOUND",
  GALLERY_EXPIRED = "GALLERY_EXPIRED",
  GALLERY_TOKEN_INVALID = "GALLERY_TOKEN_INVALID",
  EMAIL_DELIVERY_FAILED = "EMAIL_DELIVERY_FAILED",
  EMAIL_INVALID_ADDRESS = "EMAIL_INVALID_ADDRESS",
  STORAGE_UPLOAD_FAILED = "STORAGE_UPLOAD_FAILED",

  // === System ===
  UPDATE_CHECK_FAILED = "UPDATE_CHECK_FAILED",
}
```

---

## 3. Endpoint Detail

---

### 3.1 Admin Authentication

#### `POST /api/admin/login`

Verifikasi PIN admin dan terbitkan JWT.

**Auth:** Tidak diperlukan  
**Rate Limit:** Lockout 10 menit setelah 5 kali gagal berturut-turut

**Request Body:**
```typescript
interface AdminLoginRequest {
  pin: string; // 6-12 digit
}
```

**Validasi:**
- `pin`: wajib, string, panjang 6-12 karakter, hanya digit

**Response 200:**
```typescript
interface AdminLoginResponse {
  token: string;           // JWT Bearer token
  expiresAt: string;       // ISO 8601
}
```

**Errors:** `INVALID_PIN`, `ADMIN_LOCKED_OUT`, `ADMIN_NOT_INITIALIZED`, `VALIDATION_ERROR`

---

#### `POST /api/admin/logout`

Mencatat logout admin pada audit log. Token dianggap tidak valid setelah client membuangnya.

**Auth:** Bearer JWT  

**Response 200:**
```typescript
null // data: null
```

---

#### `PUT /api/admin/pin`

Mengubah PIN admin. Memerlukan PIN saat ini untuk verifikasi.

**Auth:** Bearer JWT  

**Request Body:**
```typescript
interface ChangePinRequest {
  currentPin: string; // PIN saat ini
  newPin: string;     // PIN baru, 6-12 digit
}
```

**Validasi:**
- `currentPin`: wajib, string
- `newPin`: wajib, string, 6-12 digit, tidak boleh sama dengan currentPin, tidak boleh berupa angka berurutan (123456) atau berulang (111111)

**Response 200:**
```typescript
{ message: "PIN berhasil diubah" }
```

**Errors:** `INVALID_PIN`, `PIN_TOO_SHORT`, `VALIDATION_ERROR`

---

#### `POST /api/admin/setup`

Inisialisasi PIN admin pertama kali. Hanya dapat dipanggil jika admin belum pernah diatur.

**Auth:** Tidak diperlukan (hanya saat belum ada admin)

**Request Body:**
```typescript
interface AdminSetupRequest {
  pin: string; // 6-12 digit
}
```

**Validasi:**
- Endpoint mengembalikan `CONFLICT` jika admin sudah pernah diatur

**Response 201:**
```typescript
{ message: "Admin berhasil diinisialisasi" }
```

**Errors:** `CONFLICT`, `PIN_TOO_SHORT`, `VALIDATION_ERROR`

---

### 3.2 Settings (Pengaturan)

#### `GET /api/public/settings`

Mengambil pengaturan publik yang terlihat oleh pelanggan (branding).

**Auth:** Tidak diperlukan

**Response 200:**
```typescript
interface PublicSettingsResponse {
  boothName: string;
  brandTitle: string;
  welcomeText: string;
  primaryColor: string;       // Hex color, contoh: "#6C5CE7"
  secondaryColor: string;
  logoUrl: string | null;
  wallpaperUrl: string | null;
  attractVideoUrl: string | null;
  maintenanceMode: boolean;
}
```

---

#### `GET /api/admin/settings`

Mengambil seluruh pengaturan termasuk konfigurasi internal.

**Auth:** Bearer JWT

**Response 200:**
```typescript
interface AdminSettingsResponse extends PublicSettingsResponse {
  retentionHours: number;
  maxSessionTimeoutSeconds: number;
  paymentTimeoutSeconds: number;
  selectedCameraId: string | null;
  selectedPrinterName: string | null;
  autoResetSeconds: number;
  emailDeliveryEnabled: boolean;
  galleryEnabled: boolean;
}
```

---

#### `PUT /api/admin/settings`

Memperbarui pengaturan.

**Auth:** Bearer JWT

**Request Body:**
```typescript
interface UpdateSettingsRequest {
  boothName?: string;          // max 100 karakter
  brandTitle?: string;         // max 100 karakter
  welcomeText?: string;        // max 500 karakter
  primaryColor?: string;       // Hex color
  secondaryColor?: string;     // Hex color
  logoUrl?: string | null;
  wallpaperUrl?: string | null;
  attractVideoUrl?: string | null;
  retentionHours?: number;     // min: 1, max: 720 (30 hari)
  maxSessionTimeoutSeconds?: number;  // min: 60, max: 1800
  paymentTimeoutSeconds?: number;     // min: 60, max: 600
  selectedCameraId?: string | null;
  selectedPrinterName?: string | null;
  autoResetSeconds?: number;   // min: 10, max: 120
  emailDeliveryEnabled?: boolean;
  galleryEnabled?: boolean;
  maintenanceMode?: boolean;
}
```

**Validasi:**
- `primaryColor`, `secondaryColor`: format hex (#RRGGBB)
- `retentionHours`: integer, 1-720
- String fields: trimmed, max length enforced

**Response 200:** `AdminSettingsResponse`

**Errors:** `UNAUTHORIZED`, `VALIDATION_ERROR`

---

### 3.3 Packages (Paket Sesi)

#### `GET /api/public/packages`

Mengambil daftar paket aktif yang tersedia untuk pelanggan.

**Auth:** Tidak diperlukan

**Response 200:**
```typescript
interface PackageDto {
  id: string;
  name: string;
  description: string;
  price: number;              // Rupiah (contoh: 35000)
  durationSeconds: number;
  maxShots: number;
  maxSelections: number;
  defaultPrints: number;
  additionalPrintPrice: number;
  sortOrder: number;
  isActive: boolean;
}

// Response: PackageDto[] (hanya isActive: true)
```

---

#### `GET /api/admin/packages`

Mengambil semua paket termasuk yang tidak aktif.

**Auth:** Bearer JWT

**Response 200:** `PaginatedResponse<PackageDto>`

---

#### `POST /api/admin/packages`

Membuat paket baru.

**Auth:** Bearer JWT

**Request Body:**
```typescript
interface CreatePackageRequest {
  name: string;                 // 1-100 karakter
  description: string;          // 0-500 karakter
  price: number;                // >= 0, kelipatan 500
  durationSeconds: number;      // 30-1800
  maxShots: number;             // 1-50
  maxSelections: number;        // 1-maxShots
  defaultPrints: number;        // 0-10
  additionalPrintPrice: number; // >= 0
  sortOrder?: number;
  isActive?: boolean;           // Default: true
}
```

**Validasi:**
- `price`: integer, >= 0, kelipatan 500 (QRIS minimal amount)
- `maxSelections` <= `maxShots`
- `defaultPrints` <= `maxSelections`
- `name`: unik di antara paket aktif

**Response 201:** `PackageDto`

**Errors:** `VALIDATION_ERROR`, `CONFLICT` (nama duplikat)

---

#### `PUT /api/admin/packages/:id`

Memperbarui paket yang ada.

**Auth:** Bearer JWT

**Request Body:** Sama seperti `CreatePackageRequest` tetapi semua field opsional.

**Response 200:** `PackageDto`

**Errors:** `PACKAGE_NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`

---

#### `DELETE /api/admin/packages/:id`

Menonaktifkan paket (soft delete). Paket yang sudah memiliki sesi tidak dapat dihapus permanen.

**Auth:** Bearer JWT

**Response 200:**
```typescript
{ message: "Paket dinonaktifkan" }
```

**Errors:** `PACKAGE_NOT_FOUND`, `PACKAGE_HAS_SESSIONS` (jika mencoba hard delete)

---

### 3.4 Templates (Template Foto)

#### `GET /api/public/templates`

Mengambil template aktif.

**Auth:** Tidak diperlukan

**Response 200:**
```typescript
interface TemplateDto {
  id: string;
  name: string;
  thumbnailUrl: string;
  frameOverlayUrl: string;    // URL ke PNG transparan 1200x1800
  orientation: "portrait" | "landscape";
  slotsCount: number;
  slots: TemplateSlot[];
  isActive: boolean;
}

interface TemplateSlot {
  index: number;
  x: number;        // px dari kiri (dalam canvas 1200x1800)
  y: number;        // px dari atas
  width: number;    // px
  height: number;   // px
  rotation: number; // derajat (0, 90, 180, 270)
}

// Response: TemplateDto[] (hanya isActive: true)
```

---

#### `GET /api/admin/templates`

**Auth:** Bearer JWT

**Response 200:** `PaginatedResponse<TemplateDto>`

---

#### `POST /api/admin/templates`

**Auth:** Bearer JWT

**Request Body:**
```typescript
interface CreateTemplateRequest {
  name: string;                            // 1-100 karakter
  thumbnailUrl: string;                    // URL valid
  frameOverlayUrl: string;                 // URL valid
  orientation: "portrait" | "landscape";
  slotsCount: number;                      // 1-9
  slots: TemplateSlot[];                   // panjang harus = slotsCount
  isActive?: boolean;
}
```

**Validasi:**
- `slots.length === slotsCount`
- Setiap slot: `x >= 0`, `y >= 0`, `width > 0`, `height > 0`
- Slot tidak boleh melampaui batas canvas (1200x1800 atau 1800x1200)

**Response 201:** `TemplateDto`

---

#### `PUT /api/admin/templates/:id`

**Auth:** Bearer JWT  
**Response 200:** `TemplateDto`

---

#### `DELETE /api/admin/templates/:id`

**Auth:** Bearer JWT (soft delete)  
**Response 200:** `{ message: "Template dinonaktifkan" }`

---

### 3.5 Sessions (Sesi Pelanggan)

#### `POST /api/sessions`

Membuat sesi baru. Backend mengambil harga dari database berdasarkan `packageId`.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CreateSessionRequest {
  packageId: string;
  additionalPrints?: number;  // Default: 0, min: 0, max: 20
}
```

**Logika Backend:**
```
package = findPackage(packageId)
basePrice = package.price
additionalCost = additionalPrints * package.additionalPrintPrice
totalPrice = basePrice + additionalCost
```

**Validasi:**
- `packageId`: wajib, harus merujuk ke paket aktif
- `additionalPrints`: integer >= 0
- Tidak boleh ada sesi aktif lain yang belum selesai pada booth yang sama

**Response 201:**
```typescript
interface SessionDto {
  id: string;
  packageId: string;
  packageName: string;
  state: SessionState;
  basePrice: number;
  additionalPrints: number;
  additionalPrintCost: number;
  totalPrice: number;
  maxShots: number;
  maxSelections: number;
  totalPrints: number;            // defaultPrints + additionalPrints
  durationSeconds: number;
  shotsTaken: number;
  photosSelected: number;
  createdAt: string;
  expiresAt: string;
}
```

```typescript
export type SessionState =
  | "AWAITING_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "CAPTURE_ACTIVE"
  | "PHOTO_REVIEW"
  | "PHOTO_EDITING"
  | "RENDERING"
  | "PRINTING"
  | "SHARING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";
```

**Errors:** `PACKAGE_NOT_FOUND`, `PACKAGE_INACTIVE`, `ACTIVE_SESSION_EXISTS`, `VALIDATION_ERROR`

---

#### `GET /api/sessions/:id`

**Auth:** X-Booth-Key

**Response 200:** `SessionDto`

**Errors:** `SESSION_NOT_FOUND`

---

#### `GET /api/sessions/active`

Mengambil sesi aktif saat ini (jika ada).

**Auth:** X-Booth-Key

**Response 200:** `SessionDto | null`

---

#### `PATCH /api/sessions/:id/state`

Mengubah state sesi. Transisi state divalidasi oleh backend.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface UpdateSessionStateRequest {
  state: SessionState;
  shotsTaken?: number;
  photosSelected?: number;
}
```

**Transisi state yang valid:**

```
AWAITING_PAYMENT -> PAYMENT_CONFIRMED   (hanya oleh webhook/payment service)
PAYMENT_CONFIRMED -> CAPTURE_ACTIVE
CAPTURE_ACTIVE -> PHOTO_REVIEW
PHOTO_REVIEW -> PHOTO_EDITING
PHOTO_EDITING -> RENDERING
RENDERING -> PRINTING
PRINTING -> SHARING
SHARING -> COMPLETED
[any] -> CANCELLED
[any] -> EXPIRED (oleh timeout worker)
```

**Errors:** `SESSION_NOT_FOUND`, `INVALID_SESSION_STATE`, `VALIDATION_ERROR`

---

#### `POST /api/sessions/:id/complete`

Menyelesaikan sesi dan mencatat statistik final.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CompleteSessionRequest {
  shotsTaken: number;
  photosSelected: number;
  photosPrinted: number;
}
```

**Response 200:** `SessionDto`

---

#### `POST /api/sessions/:id/cancel`

Membatalkan sesi.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CancelSessionRequest {
  reason?: string;  // max 500 karakter
}
```

**Response 200:** `SessionDto`

---

### 3.6 Payments & Cash Desk (Pembayaran & Kasir Tunai)

#### `POST /api/payments`

Membuat transaksi pembayaran (QRIS Midtrans atau Tunai/Cash) untuk sesi yang sedang berjalan.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CreatePaymentRequest {
  sessionId: string;
  paymentMethod: "qris" | "cash";
  voucherCode?: string;
}
```

**Logika Backend:**
1. Ambil sesi dari database, pastikan state = `AWAITING_PAYMENT`.
2. Validasi voucher (jika disediakan): hitung subtotal, diskon voucher, biaya add-on cetak, dan gross amount final.
3. Jika `paymentMethod === "qris"`:
   - Panggil Midtrans Snap/Core API untuk generate QRIS dinamis (`qrString`, `qrImageUrl`).
4. Jika `paymentMethod === "cash"`:
   - Buat order dengan status `pending`, tanpa payload QR. Menunggu konfirmasi staf kasir melalui PIN admin.
5. Simpan payment record di database.

**Response 201:**
```typescript
interface PaymentDto {
  id: string;
  orderId: string;         // Format: MINJA-{YYYYMMDD}-{sequence}
  sessionId: string;
  paymentMethod: "qris" | "cash";
  subtotal: number;
  voucherCode: string | null;
  voucherDiscount: number;
  grossAmount: number;
  qrString: string | null; // EMVCo QRIS string (null jika cash)
  qrImageUrl: string | null;
  transactionStatus: PaymentStatus;
  expiryTime: string;      // ISO 8601
  changeAmount?: number;
  confirmedBy?: string;
  createdAt: string;
}
```

```typescript
export type PaymentMethod = "qris" | "cash";

export type PaymentStatus =
  | "pending"
  | "settlement"
  | "expire"
  | "cancel"
  | "deny"
  | "refund";
```

**Errors:** `SESSION_NOT_FOUND`, `INVALID_SESSION_STATE`, `PAYMENT_CREATION_FAILED`, `VOUCHER_NOT_FOUND`, `VOUCHER_EXPIRED`, `VOUCHER_QUOTA_EXCEEDED`

---

#### `GET /api/payments/:orderId/status`

Mengambil status pembayaran terkini. Desktop melakukan polling endpoint ini setiap 3 detik.

**Auth:** X-Booth-Key

**Response 200:**
```typescript
interface PaymentStatusResponse {
  orderId: string;
  transactionStatus: PaymentStatus;
  settlementTime: string | null;
  isVerified: boolean;          // true jika backend telah memverifikasi (Midtrans webhook/API check atau PIN kasir valid)
}
```

**Catatan tentang isVerified:**
- `isVerified: true` berarti backend telah memverifikasi status ini (via webhook/API check Midtrans untuk QRIS, atau via autentikasi PIN kasir untuk Cash).
- `isVerified: false` berarti status masih `pending`.
- Desktop client **hanya boleh mengaktifkan sesi kamera** jika `transactionStatus === "settlement" && isVerified === true`.

---

#### `GET /api/admin/payments`

Daftar semua transaksi pembayaran.

**Auth:** Bearer JWT

**Query Parameters:**
```typescript
interface PaymentQueryParams extends PaginationParams {
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  sessionId?: string;
}
```

**Response 200:** `PaginatedResponse<PaymentDto>`

---

#### `GET /api/admin/cash/pending`

Mengambil antrean transaksi tunai (`paymentMethod: "cash"`) berstatus `pending` yang menunggu pelunasan dari staf kasir.

**Auth:** Bearer JWT

**Response 200:**
```typescript
interface CashPendingTransaction {
  id: string;
  orderId: string;
  sessionId: string;
  packageName: string;
  subtotal: number;
  voucherCode: string | null;
  voucherDiscount: number;
  grossAmount: number;
  createdAt: string;
  status: "pending";
}

// Response: CashPendingTransaction[]
```

---

#### `POST /api/admin/cash/confirm`

Konfirmasi pelunasan uang tunai oleh staf kasir menggunakan verifikasi PIN Admin.

**Auth:** X-Booth-Key atau Bearer JWT

**Request Body:**
```typescript
interface CashConfirmationRequest {
  orderId: string;
  pin: string;              // PIN Admin (misal: 123456)
  receivedAmount: number;   // Nominal uang fisik yang diserahkan pelanggan
  operatorId?: string;      // Identitas operator/kasir
}
```

**Validasi & Logika Keamanan:**
1. Verifikasi PIN admin (proteksi anti-brute force, lockout jika 5x gagal).
2. Periksa apakah transaksi berstatus `pending` dan metode pembayaran adalah `cash`.
3. Validasi nominal uang:
   - Jika `receivedAmount < grossAmount`, kembalikan error `CASH_UNDERPAID` (400 Bad Request) dengan selisih kekurangan. Sesi **tidak boleh aktif**.
   - Jika `receivedAmount >= grossAmount`, hitung `changeAmount = receivedAmount - grossAmount`.
4. Perbarui status transaksi dan sesi menjadi `settlement` dan `PAYMENT_CONFIRMED`.
5. Catat event pada Cash Audit Log. **Dilarang keras mencatat PIN petugas ke log atau menyimpannya dalam plaintext.**

**Response 200:**
```typescript
interface CashConfirmationResponse {
  success: boolean;
  orderId: string;
  grossAmount: number;
  receivedAmount: number;
  changeAmount: number;
  confirmedBy: string;
  confirmedAt: string;
  message: string;
}
```

**Errors:** `INVALID_PIN`, `ADMIN_LOCKED_OUT`, `CASH_UNDERPAID`, `PAYMENT_NOT_FOUND`, `PAYMENT_ALREADY_SETTLED`

---

#### `GET /api/admin/cash/audit-logs`

Mengambil catatan audit konfirmasi pembayaran tunai untuk transparansi dan rekapitulasi kasir.

**Auth:** Bearer JWT

**Response 200:**
```typescript
interface CashAuditLogItem {
  id: string;
  orderId: string;
  operatorId: string;
  grossAmount: number;
  receivedAmount: number;
  changeAmount: number;
  confirmedAt: string;
}

// Response: CashAuditLogItem[]
```

---

### 3.7 Vouchers (Manajemen Voucher & Kode Promo)

#### `POST /api/vouchers/validate`

Memvalidasi kode voucher promo dan menghitung nilai diskon terhadap paket yang dipilih pelanggan.

**Auth:** Tidak diperlukan (Publik / Desktop)

**Request Body:**
```typescript
interface ValidateVoucherRequest {
  code: string;
  packageId: string;
  additionalPrints?: number;
}
```

**Logika Backend:**
1. Cari kode voucher (case-insensitive).
2. Periksa apakah voucher `isActive: true`.
3. Periksa masa berlaku (`validFrom <= now <= validUntil`).
4. Periksa sisa kuota pemakaian (`usedCount < quota`).
5. Periksa kesesuaian paket (`applicablePackages` jika ditentukan).
6. Hitung subtotal paket + cetak tambahan. Periksa apakah memenuhi `minTransaction`.
7. Hitung nilai diskon:
   - Persentase: `(subtotal * discountValue) / 100`, dibatasi plafon `maxDiscount` (bila ada).
   - Nominal tetap: `min(subtotal, discountValue)`.
8. Hitung `grossAmount = max(0, subtotal - discountAmount)`.

**Response 200:**
```typescript
interface ValidateVoucherResponse {
  isValid: boolean;
  discountAmount: number;
  voucher?: {
    code: string;
    name: string;
    type: "percentage" | "fixed";
    discountValue: number;
    maxDiscount?: number;
  };
  errorCode?:
    | "INVALID_CODE"
    | "EXPIRED"
    | "OUT_OF_QUOTA"
    | "MIN_TRANSACTION_NOT_MET"
    | "PACKAGE_NOT_ELIGIBLE"
    | "INACTIVE";
  errorMessage?: string;
}
```

---

#### `GET /api/admin/vouchers`

Mengambil seluruh daftar voucher promo beserta metrik penggunaan.

**Auth:** Bearer JWT

**Response 200:**
```typescript
interface VoucherItem {
  id: string;
  code: string;
  name: string;
  type: "percentage" | "fixed";
  discountValue: number;
  maxDiscount?: number;
  minTransaction?: number;
  quota: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  applicablePackages?: string[];
  isActive: boolean;
  createdAt: string;
}

// Response: VoucherItem[]
```

---

#### `POST /api/admin/vouchers`

Membuat voucher promo baru.

**Auth:** Bearer JWT

**Request Body:**
```typescript
interface CreateVoucherRequest {
  code: string;               // 3-20 karakter alfanumerik
  name: string;               // 1-100 karakter
  type: "percentage" | "fixed";
  discountValue: number;      // 1-100 untuk %, >= 500 untuk fixed
  maxDiscount?: number;       // Plafon rupiah jika type = percentage
  minTransaction?: number;    // Min total harga sebelum diskon
  quota: number;              // Kuota penggunaan, min: 1
  validFrom: string;          // ISO 8601
  validUntil: string;         // ISO 8601
  applicablePackages?: string[]; // ID paket (kosong = semua paket)
  isActive?: boolean;         // Default: true
}
```

**Response 201:** `VoucherItem`

**Errors:** `VALIDATION_ERROR`, `CONFLICT` (kode voucher sudah terdaftar)

---

#### `PUT /api/admin/vouchers/:id`

Memperbarui voucher promo yang ada.

**Auth:** Bearer JWT

**Request Body:** Partial dari `CreateVoucherRequest`.

**Response 200:** `VoucherItem`

**Errors:** `NOT_FOUND`, `VALIDATION_ERROR`

---

#### `DELETE /api/admin/vouchers/:id`

Menonaktifkan atau menghapus voucher promo.

**Auth:** Bearer JWT

**Response 200:**
```typescript
{ message: "Voucher berhasil dinonaktifkan" }
```

---

### 3.7 Webhooks

#### `POST /api/webhooks/midtrans`

Menerima notifikasi pembayaran dari Midtrans.

**Auth:** Verifikasi signature SHA512

**Request Body (dari Midtrans):**
```typescript
interface MidtransNotification {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  settlement_time?: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status?: string;
  currency: string;
}
```

**Verifikasi Signature:**
```
SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
```

**Proses Idempoten:**
1. Verifikasi `signature_key` menggunakan `MIDTRANS_SERVER_KEY` dari environment.
2. Cari payment record berdasarkan `order_id`.
3. Jika payment sudah berstatus `settlement` → return `200 OK` tanpa perubahan.
4. Jika belum → update status payment dan session state sesuai `transaction_status`.
5. Catat webhook event di tabel `WebhookEvent`.

**Response:**
- `200 OK` — Notifikasi diproses (atau sudah diproses sebelumnya).
- `400 Bad Request` — Signature tidak valid.
- `404 Not Found` — `order_id` tidak ditemukan.

---

### 3.8 Photos (Metadata Foto)

#### `POST /api/photos`

Menyimpan metadata foto yang diambil selama sesi.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CreatePhotoRequest {
  sessionId: string;
  shotNumber: number;        // 1-based index
  localFilePath: string;     // Path lokal di mesin desktop
  originalFilename: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  mimeType: "image/jpeg" | "image/png";
}
```

**Validasi:**
- `sessionId`: harus merujuk ke sesi dengan state `CAPTURE_ACTIVE`
- `shotNumber`: harus <= `maxShots` dari paket sesi
- Tidak boleh ada duplikat `sessionId + shotNumber`

**Response 201:**
```typescript
interface PhotoDto {
  id: string;
  sessionId: string;
  shotNumber: number;
  localFilePath: string;
  storageKey: string | null;     // Diisi setelah upload ke object storage
  storageUrl: string | null;
  isSelected: boolean;
  createdAt: string;
}
```

**Errors:** `SESSION_NOT_FOUND`, `INVALID_SESSION_STATE`, `MAX_PHOTOS_REACHED`, `VALIDATION_ERROR`

---

#### `GET /api/photos/session/:sessionId`

Mengambil semua foto dalam satu sesi.

**Auth:** X-Booth-Key

**Response 200:** `PhotoDto[]`

---

#### `PATCH /api/photos/:id/select`

Menandai foto sebagai terpilih atau tidak terpilih.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface SelectPhotoRequest {
  isSelected: boolean;
}
```

**Validasi:**
- Jumlah foto terpilih tidak boleh melebihi `maxSelections` dari paket

**Response 200:** `PhotoDto`

---

#### `POST /api/photos/:id/upload`

Mengunggah file foto ke object storage.

**Auth:** X-Booth-Key

**Request Body:** `multipart/form-data` dengan field `file` (JPEG/PNG, max 30MB)

**Response 200:**
```typescript
interface PhotoUploadResponse {
  photoId: string;
  storageKey: string;
  storageUrl: string;
}
```

**Errors:** `PHOTO_NOT_FOUND`, `STORAGE_UPLOAD_FAILED`

---

### 3.9 Gallery (Galeri Privat)

#### `POST /api/gallery`

Membuat tautan galeri privat untuk sesi yang sudah selesai.

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface CreateGalleryRequest {
  sessionId: string;
}
```

**Logika Backend:**
1. Generate token unik (nanoid 32 karakter, charset alfanumerik+symbol aman URL).
2. Hitung `expiresAt` = now + `retentionHours` dari settings.
3. Simpan gallery record di database.
4. Generate QR code image (base64 data URL) dari gallery URL.

**Response 201:**
```typescript
interface GalleryDto {
  id: string;
  sessionId: string;
  token: string;
  galleryUrl: string;            // https://booth.minja.id/g/{token}
  qrCodeDataUrl: string;         // data:image/png;base64,...
  photoCount: number;
  expiresAt: string;
  createdAt: string;
}
```

---

#### `GET /api/gallery/:token`

Mengakses galeri publik (halaman yang dibuka pelanggan dari QR code).

**Auth:** Tidak diperlukan (token adalah autentikasi)

**Response 200:**
```typescript
interface GalleryPublicResponse {
  sessionId: string;
  packageName: string;
  photos: Array<{
    id: string;
    downloadUrl: string;     // Signed URL dengan masa berlaku 1 jam
    thumbnailUrl: string;
    width: number;
    height: number;
  }>;
  expiresAt: string;
  createdAt: string;
}
```

**Errors:** `GALLERY_TOKEN_INVALID`, `GALLERY_EXPIRED`

---

### 3.10 Delivery (Pengiriman Soft File Email)

#### `POST /api/sessions/:sessionId/email`

Mengirim tautan galeri via Layanan Email (SMTP / Nodemailer).

**Auth:** X-Booth-Key

**Request Body:**
```typescript
interface SendEmailRequest {
  email: string;      // Format email valid: "user@example.com"
}
```

**Validasi:**
- `email`: format email yang valid (contoh: user@gmail.com)

**Response 200/202:** (Pengiriman email soft file)
```typescript
interface DeliveryJobDto {
  id: string;
  sessionId: string;
  channel: "email";
  email: string;
  status: "queued" | "sent" | "delivered" | "failed";
  retryCount: number;
  createdAt: string;
}
```

**Errors:** `EMAIL_INVALID_ADDRESS`, `GALLERY_TOKEN_INVALID`, `GALLERY_EXPIRED`, `EMAIL_DELIVERY_FAILED`

---

#### `GET /api/delivery/:id/status`

Mengambil status pengiriman.

**Auth:** X-Booth-Key

**Response 200:** `DeliveryJobDto`

---

### 3.11 Desktop Local Endpoints (Camera & Printer)

Endpoint ini berjalan di **Electron Main Process** (bukan di Fastify backend). Komunikasi via IPC contextBridge.

#### Camera IPC Channels

| Channel | Payload | Return | Keterangan |
|---------|---------|--------|------------|
| `camera:list` | `void` | `CameraDeviceDto[]` | Enumerasi perangkat kamera |
| `camera:connect` | `{ deviceId: string }` | `void` | Hubungkan ke kamera |
| `camera:disconnect` | `void` | `void` | Putuskan kamera |
| `camera:startPreview` | `void` | `void` | Mulai live view streaming |
| `camera:stopPreview` | `void` | `void` | Hentikan live view |
| `camera:capture` | `{ sessionId: string, shotNumber: number }` | `CapturedPhotoDto` | Ambil foto |
| `camera:status` | `void` | `CameraStatusDto` | Cek status kamera |

**Event streams (Main → Renderer):**
- `camera:frame` → `string` (base64 JPEG frame)
- `camera:statusChanged` → `CameraStatusDto`

```typescript
interface CameraDeviceDto {
  id: string;
  name: string;
  type: "webcam" | "virtual_webcam" | "canon_dslr";
  isAvailable: boolean;
}

interface CapturedPhotoDto {
  photoId: string;         // UUID lokal
  shotNumber: number;
  localFilePath: string;
  previewDataUrl: string;  // Base64 thumbnail untuk review instan
  capturedAt: string;
}

interface CameraStatusDto {
  deviceId: string | null;
  isConnected: boolean;
  isStreaming: boolean;
  batteryLevel: number | null;
  error: string | null;
}
```

#### Printer IPC Channels

| Channel | Payload | Return | Keterangan |
|---------|---------|--------|------------|
| `printer:list` | `void` | `PrinterDto[]` | Enumerasi printer Windows |
| `printer:submit` | `PrintJobRequest` | `PrintJobDto` | Kirim job cetak 4R |
| `printer:jobStatus` | `{ jobId: string }` | `PrintJobDto` | Cek status cetak |
| `printer:testPrint` | `{ printerName: string }` | `PrintJobDto` | Test print kalibrasi |

```typescript
interface PrinterDto {
  name: string;
  isDefault: boolean;
  status: "ready" | "printing" | "offline" | "error";
}

interface PrintJobRequest {
  sessionId: string;
  imageFilePath: string;   // Path file 4R yang sudah dirender
  printerName: string;
  copies: number;          // 1-10
}

interface PrintJobDto {
  jobId: string;
  sessionId: string;
  status: "queued" | "printing" | "completed" | "failed";
  copies: number;
  createdAt: string;
  error: string | null;
}
```

---

### 3.12 Reports (Laporan — Admin)

#### `GET /api/admin/reports/summary`

Ringkasan pendapatan dan statistik.

**Auth:** Bearer JWT

**Query Parameters:**
```typescript
interface ReportQueryParams {
  startDate: string;    // YYYY-MM-DD, wajib
  endDate: string;      // YYYY-MM-DD, wajib
}
```

**Response 200:**
```typescript
interface ReportSummaryResponse {
  period: { startDate: string; endDate: string };
  totalRevenue: number;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  expiredSessions: number;
  totalPayments: number;
  settledPayments: number;
  failedPayments: number;
  totalPhotosTaken: number;
  totalPhotosPrinted: number;
  totalPrintJobs: number;
  failedPrintJobs: number;
  totalEmailsSent: number;
  failedEmailDeliveries: number;
}
```

---

#### `GET /api/admin/reports/transactions`

Daftar transaksi detail.

**Auth:** Bearer JWT

**Query Parameters:**
```typescript
interface TransactionReportParams extends PaginationParams {
  startDate: string;
  endDate: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}
```

**Response 200:**
```typescript
interface TransactionReportItem {
  orderId: string;
  sessionId: string;
  packageName: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  voucherCode: string | null;
  discountAmount: number;
  grossAmount: number;
  paymentStatus: PaymentStatus;
  sessionState: SessionState;
  shotsTaken: number;
  photosPrinted: number;
  printStatus: string;
  confirmedBy: string | null;
  createdAt: string;
  settlementTime: string | null;
}

// Response: PaginatedResponse<TransactionReportItem>
```

---

#### `GET /api/admin/reports/export/csv`

Mengekspor laporan transaksi sebagai file CSV.

**Auth:** Bearer JWT

**Query Parameters:** Sama dengan `TransactionReportParams` (tanpa pagination)

**Response 200:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="minja-report-YYYYMMDD.csv"`

---

### 3.13 Audit Log

#### `GET /api/admin/audit-log`

Daftar catatan audit tindakan admin.

**Auth:** Bearer JWT

**Query Parameters:**
```typescript
interface AuditLogParams extends PaginationParams {
  startDate?: string;
  endDate?: string;
  action?: string;    // Filter berdasarkan action type
}
```

**Response 200:**
```typescript
interface AuditLogDto {
  id: string;
  action: string;           // "ADMIN_LOGIN", "PACKAGE_CREATED", "SETTINGS_UPDATED", dll.
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// Response: PaginatedResponse<AuditLogDto>
```

---

### 3.14 System (Update & Versi)

#### `GET /api/system/version`

Mengecek versi backend dan ketersediaan update.

**Auth:** X-Booth-Key

**Response 200:**
```typescript
interface VersionResponse {
  currentVersion: string;        // SemVer: "1.0.0"
  latestVersion: string | null;  // null jika tidak bisa cek
  updateAvailable: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
  checkedAt: string;
}
```

---

#### `GET /api/system/health`

Health check endpoint.

**Auth:** Tidak diperlukan

**Response 200:**
```typescript
interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "disconnected";
  uptime: number;    // detik
  version: string;
}
```

---

## 4. Ringkasan Seluruh Endpoint

| # | Method | Path | Auth | Deskripsi |
|---|--------|------|------|-----------|
| 1 | POST | `/api/admin/setup` | None | Inisialisasi PIN admin |
| 2 | POST | `/api/admin/login` | None | Login admin |
| 3 | POST | `/api/admin/logout` | JWT | Logout admin |
| 4 | PUT | `/api/admin/pin` | JWT | Ubah PIN admin |
| 5 | GET | `/api/public/settings` | None | Pengaturan publik |
| 6 | GET | `/api/admin/settings` | JWT | Pengaturan admin |
| 7 | PUT | `/api/admin/settings` | JWT | Update pengaturan |
| 8 | GET | `/api/public/packages` | None | Paket aktif |
| 9 | GET | `/api/admin/packages` | JWT | Semua paket |
| 10 | POST | `/api/admin/packages` | JWT | Buat paket |
| 11 | PUT | `/api/admin/packages/:id` | JWT | Update paket |
| 12 | DELETE | `/api/admin/packages/:id` | JWT | Nonaktifkan paket |
| 13 | GET | `/api/public/templates` | None | Template aktif |
| 14 | GET | `/api/admin/templates` | JWT | Semua template |
| 15 | POST | `/api/admin/templates` | JWT | Buat template |
| 16 | PUT | `/api/admin/templates/:id` | JWT | Update template |
| 17 | DELETE | `/api/admin/templates/:id` | JWT | Nonaktifkan template |
| 18 | POST | `/api/sessions` | Booth-Key | Buat sesi |
| 19 | GET | `/api/sessions/:id` | Booth-Key | Detail sesi |
| 20 | GET | `/api/sessions/active` | Booth-Key | Sesi aktif |
| 21 | PATCH | `/api/sessions/:id/state` | Booth-Key | Update state sesi |
| 22 | POST | `/api/sessions/:id/complete` | Booth-Key | Selesaikan sesi |
| 23 | POST | `/api/sessions/:id/cancel` | Booth-Key | Batalkan sesi |
| 24 | POST | `/api/payments` | Booth-Key | Buat pembayaran QRIS / Cash |
| 25 | GET | `/api/payments/:orderId/status` | Booth-Key | Status pembayaran |
| 26 | GET | `/api/admin/payments` | JWT | Daftar pembayaran |
| 27 | GET | `/api/admin/cash/pending` | JWT | Antrean transaksi tunai kasir |
| 28 | POST | `/api/admin/cash/confirm` | Booth-Key/JWT | Konfirmasi pelunasan kasir tunai (PIN) |
| 29 | GET | `/api/admin/cash/audit-logs` | JWT | Audit log konfirmasi tunai |
| 30 | POST | `/api/vouchers/validate` | None | Validasi voucher & kalkulasi diskon |
| 31 | GET | `/api/admin/vouchers` | JWT | Daftar voucher promo |
| 32 | POST | `/api/admin/vouchers` | JWT | Buat voucher baru |
| 33 | PUT | `/api/admin/vouchers/:id` | JWT | Update voucher |
| 34 | DELETE | `/api/admin/vouchers/:id` | JWT | Nonaktifkan voucher |
| 35 | POST | `/api/webhooks/midtrans` | Signature | Webhook Midtrans |
| 36 | POST | `/api/photos` | Booth-Key | Simpan metadata foto |
| 37 | GET | `/api/photos/session/:sessionId` | Booth-Key | Foto per sesi |
| 38 | PATCH | `/api/photos/:id/select` | Booth-Key | Pilih/batal pilih foto |
| 39 | POST | `/api/photos/:id/upload` | Booth-Key | Upload foto |
| 40 | POST | `/api/gallery` | Booth-Key | Buat galeri |
| 41 | GET | `/api/gallery/:token` | None (token) | Akses galeri publik |
| 42 | POST | `/api/sessions/:sessionId/email` | Booth-Key | Kirim Email Soft File |
| 43 | GET | `/api/delivery/:id/status` | Booth-Key | Status pengiriman |
| 44 | GET | `/api/admin/reports/summary` | JWT | Ringkasan laporan |
| 45 | GET | `/api/admin/reports/transactions` | JWT | Laporan transaksi lengkap |
| 46 | GET | `/api/admin/reports/export/csv` | JWT | Ekspor CSV |
| 47 | GET | `/api/admin/audit-log` | JWT | Log audit |
| 48 | GET | `/api/system/version` | Booth-Key | Cek versi & update |
| 49 | GET | `/api/system/health` | None | Health check |
| 50 | GET | `/api/printer/list` | None/Booth-Key | Daftar printer Windows terdeteksi & status |
| 51 | GET | `/api/printer/config` | None/Booth-Key | Konfigurasi printer aktif terpilih |
| 52 | PUT | `/api/printer/config` | Booth-Key/JWT | Simpan kustomisasi printer, ukuran kertas & margin |
| 53 | POST | `/api/printer/print` | Booth-Key | Submit antrean cetak 4R silent spooler |
| 54 | POST | `/api/printer/test` | None/Booth-Key | Uji cetak kalibrasi 4R borderless |
| 55 | POST | `/api/printer/reprint` | Booth-Key/JWT | Cetak ulang audit log operator |
