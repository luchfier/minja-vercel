# Antigravity & Gemini Workspace Instructions — MinjaPhotobooth V2

Dokumen ini menyediakan instruksi dan panduan cepat bagi Antigravity AI Agent saat bekerja di repositori ini.

---

## 🧭 Referensi Master
Dokumen arsitektur lengkap, alur alur sistem, dan aturan proyek tersimpan di:
👉 **[`AGENTS.md`](AGENTS.md)**

Silakan rujuk [`AGENTS.md`](AGENTS.md) untuk detail menyeluruh tentang 5 Pilar Produksi, alur customer journey, state machine, dan daftar endpoint API.

---

## ⚡ Aturan Eksekusi Terminal Windows
1. **Shell Windows PowerShell:** Selalu gunakan format `npm.cmd` daripada `npm` biasa untuk menghindari hambatan `ExecutionPolicy` script Windows:
   - Menjalankan dev server: `npm.cmd run dev`
   - Menjalankan kiosk lengkap: `npm.cmd run kiosk`
   - Menjalankan tes: `npm.cmd test`
   - Sinkronisasi Prisma: `npm.cmd run db:push`
   - Seed database: `npm.cmd run db:seed`
2. **Path File:** Gunakan forward slash (`/`) atau kutip ganda untuk path yang mengandung spasi (`"d:\REVIA PROJECT\Minja V2"`).

---

## 🛡️ Guardrails Utama untuk AI
1. **Dual-Mode API (Zero Downtime Fallback):**
   - File `frontend/src/services/photoboothApi.ts` menghubungkan UI ke Fastify backend (`httpPhotoboothApi.ts`) dengan fallback otomatis ke `mockPhotoboothApi.ts`.
   - **DILARANG MERUSAK ATAU MENGHAPUS FALLBACK INI.**
2. **Server-Side Price Authority:**
   - Frontend tidak boleh menghitung harga total atau diskon secara independen. Backend adalah otoritas tunggal harga.
3. **Format Standar Cetak 10×15 cm (4R):**
   - Wajib ukuran 10×15 cm (1200×1800 piksel, 300 DPI) borderless sRGB.
4. **Isolasi Secret:**
   - Secret Midtrans, kredensial SMTP Email, dan JWT hanya boleh berada di `server/.env`.
