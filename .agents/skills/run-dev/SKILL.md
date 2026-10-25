---
name: run-dev
description: Workflow panduan untuk menjalankan MinjaPhotobooth di Windows, sinkronisasi database Prisma, menjalankan test suite, dan meluncurkan Electron Kiosk.
---

# MinjaPhotobooth — Run & Development Skill

Skill ini membantu AI Agent atau pengembang dalam menjalankan dan menguji sistem MinjaPhotobooth V2 di lingkungan Windows.

## 1. Prasyarat & Lingkungan
- **OS:** Windows 10/11 64-bit
- **Shell:** Windows PowerShell
- **Node.js:** Versi 20 LTS atau lebih baru

> ⚠️ **Catatan Penting PowerShell:**  
> Selalu gunakan format executable `npm.cmd` saat memanggil npm di terminal PowerShell.

## 2. Alur Menjalankan Aplikasi

### Mode 1: Menjalankan Server & Frontend (Pengembangan Web)
```powershell
npm.cmd run dev
```
- Menjalankan Fastify backend di `http://localhost:3000`
- Menjalankan Vite React frontend di `http://localhost:5173`
- Buka browser di `http://localhost:5173` untuk menguji antarmuka sentuh pelanggan.

### Mode 2: Menjalankan Full Kiosk (Electron Desktop)
```powershell
npm.cmd run kiosk
```
- Menyalakan backend Fastify, frontend Vite, dan jendela Electron Kiosk secara bersamaan.
- Shortcut keluar darurat: `Ctrl + Shift + Q`
- Shortcut toggle mode window: `Ctrl + Shift + F`

### Mode 3: Menjalankan Automated Test Suite
```powershell
npm.cmd test
```
- Menjalankan rangkaian unit test dan integration test Vitest di direktori `server/tests/`.

## 3. Alur Pengelolaan Database PostgreSQL & Prisma

### Menyinkronkan Skema Database
```powershell
npm.cmd run db:push
```
- Menerapkan skema `server/prisma/schema.prisma` ke database PostgreSQL yang terkonfigurasi pada `server/.env`.

### Mengisi Data Awal (Seed)
```powershell
npm.cmd run db:seed
```
- Mengisi data default:
  - Admin (PIN default: `123456`)
  - Paket foto (*Solo Express*, *Bestie Duo*, *Party Quad*)
  - Template frame 4R default

### Membuka Prisma Studio GUI
```powershell
npm.cmd run db:studio
```
- Membuka dashboard visual Prisma di browser untuk menginspeksi tabel dan data.

## 4. Penanganan Masalah Umum

### PostgreSQL Autentikasi Gagal
Jika muncul error:
`P1000: Authentication failed against database server at localhost`
1. Buka file `server/.env`.
2. Periksa baris `DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/minjaphotobooth`.
3. Sesuaikan `PASSWORD` dengan password user `postgres` di instalasi PostgreSQL lokal Anda.
4. *Catatan:* Jika PostgreSQL offline, frontend tetap dapat berjalan menggunakan fallback `mockPhotoboothApi.ts`.
