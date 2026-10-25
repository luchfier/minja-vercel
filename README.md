# MinjaPhotobooth — Aplikasi Photobooth Mandiri Windows

Selamat datang di repositori **MinjaPhotobooth**, sistem photobooth mandiri (*self-service*) modern untuk Windows 10/11 64-bit dengan antarmuka layar sentuh (*touchscreen*).

---

## 📌 Ringkasan Proyek

| Komponen | Teknologi |
|----------|-----------|
| **Backend API** | Node.js, Fastify, Prisma ORM, PostgreSQL |
| **Desktop Client** | Electron, React 18, TypeScript, Vite |
| **Penyimpanan Lokal** | SQLite (better-sqlite3) — cache offline |
| **Pembayaran** | Midtrans Snap QRIS |
| **Distribusi Foto** | Object Storage (S3/R2), QR Code, Layanan Email (SMTP) |
| **Kamera** | Webcam USB, Virtual Webcam, Canon EOS 600D (adapter modular) |
| **Cetak** | Windows Print Spooler — kertas foto 10×15 cm (300 DPI) |
| **Admin Panel** | Autentikasi PIN (Argon2id), CRUD paket, laporan CSV |

---

## 📂 Struktur Dokumentasi

| Dokumen | Deskripsi |
|---------|-----------|
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document — kebutuhan bisnis dan alur pelanggan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Software Architecture — arsitektur sistem, batas online vs desktop |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | API Contract — 41 endpoint REST dengan request/response types |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Database Schema — 14 model Prisma (PostgreSQL) + SQLite DDL |
| [docs/SECURITY.md](docs/SECURITY.md) | Security — autentikasi, hashing, manajemen secret, checklist |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Test Plan — 85+ test cases, strategi mock, pengujian hardware |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Milestones — 15 tahap pengerjaan (M0-M14) dengan kriteria lulus |
| [docs/THE_NEXT_STEP.md](docs/THE_NEXT_STEP.md) | The Next Step — Blueprint integrasi printer fisik, kamera, Midtrans & Electron |

---

## 🛠️ Prasyarat

1. **Sistem Operasi:** Windows 10 atau 11 (64-bit)
2. **Node.js:** Versi 20 LTS atau lebih baru — [nodejs.org](https://nodejs.org)
3. **Git:** Versi 2.40+ — [git-scm.com](https://git-scm.com)
4. **PostgreSQL:** Versi 16 — [postgresql.org](https://www.postgresql.org)
5. **Editor:** Visual Studio Code / Antigravity IDE dengan ekstensi ESLint dan Prettier

---

## 🗺️ Roadmap Pengerjaan

| Status | Milestone | Deskripsi |
|:------:|-----------|-----------|
| ✅ | **M0** Dokumen Baseline | PRD, Architecture, API Contract, Database Schema, Security, Test Plan |
| ⏳ | **M1** Backend Scaffolding | Fastify + Prisma + PostgreSQL + health check |
| 📋 | **M2** Desktop Scaffolding | Electron + Vite + React + SQLite + IPC bridge |
| 📋 | **M3** Admin & Settings | PIN Argon2id, JWT, CRUD pengaturan |
| 📋 | **M4** Paket & Template | CRUD paket sesi dan template foto |
| 📋 | **M5** Sesi & Kalkulasi Harga | Session state machine, server-side pricing |
| 📋 | **M6** Pembayaran QRIS | Midtrans integration, webhook idempoten |
| 📋 | **M7** Pipeline Kamera | Webcam, Canon EOS 600D adapter, live preview |
| 📋 | **M8** Editor & Renderer 4R | Filter, template, Sharp 300 DPI compositor |
| 📋 | **M9** Pipeline Cetak | Windows Spooler adapter, print queue |
| 📋 | **M10** Galeri & QR | Object storage, galeri privat, signed URLs |
| 📋 | **M11** Email Delivery | Layanan Email (SMTP / Nodemailer), delivery queue |
| 📋 | **M12** Laporan & CSV | Ringkasan pendapatan, audit log, ekspor CSV |
| 📋 | **M13** Touch UI | Antarmuka pelanggan lengkap, state orchestration |
| 📋 | **M14** Hardening & Installer | Windows installer, auto-update, kiosk mode |

---

## ❓ Panduan Pemecahan Masalah

### `node: The term 'node' is not recognized`
Node.js belum terpasang atau belum terdaftar di PATH Windows.
1. Unduh Node.js LTS dari [nodejs.org](https://nodejs.org).
2. Saat instalasi, pastikan opsi *"Add to PATH"* dicentang.
3. Tutup dan buka kembali terminal.

### `git: The term 'git' is not recognized`
Git belum terpasang. Unduh dari [git-scm.com](https://git-scm.com).

### File `.env` ter-commit ke Git
File `.gitignore` sudah dikonfigurasi untuk mencegah ini. Jangan pernah menggunakan `git add -f .env`.
