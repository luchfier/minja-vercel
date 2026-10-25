# Rules: Hardware Calibration, Camera & 4R Printing

## 1. Spesifikasi Standar Cetak 10 × 15 cm (4R)
- **Dimensi Fisik Kertas:** 10 × 15 cm (Kertas Lab Foto Standar Studio).
- **Resolusi Cetak:** 300 DPI (Dots Per Inch) minimum.
- **Dimensi Kanvas Gambar:**
  - Portrait: **1200 × 1800 piksel** (10 × 15 cm)
  - Landscape: **1800 × 1200 piksel** (15 × 10 cm)
- **Margin:** 0 cm (0 mm — Borderless Printing).
- **Printer Target:** DNP QW410 / DS-RX1HS, Citizen CY-02, HiTi P525L, atau Epson L-Series.

## 2. Windows Silent Printing Pipeline
- Pencetakan fisik dilakukan tanpa dialog Windows menggunakan skrip PowerShell native: `server/scripts/silent-print.ps1`.
- Skrip ini memanfaatkan .NET `System.Drawing.Printing.PrintDocument` untuk mengirim buffer gambar langsung ke Windows Print Spooler.
- Parameter yang didukung:
  - `-FilePath`: Path absolut file gambar JPG/PNG resolusi tinggi.
  - `-PrinterName`: Nama printer Windows (opsional, default ke printer aktif Windows).
  - `-Copies`: Jumlah lembar cetak.
  - `-PaperWidthCm` / `-PaperWidthMm` & `-PaperHeightCm` / `-PaperHeightMm`: Dimensi kertas kustom (misal: 10 × 15 cm).
  - `-MarginTopCm` / `-MarginTopMm` & `-MarginLeftCm` / `-MarginLeftMm`: Kalibrasi margin fine-tuning dari Admin Panel.

## 3. Pipeline Kamera & Capture
- **Webcam USB & Virtual Camera:** Didukung langsung melalui `navigator.mediaDevices.getUserMedia`.
- **Canon EOS DSLR:**
  - Terhubung via HDMI Capture Card (misal Elgato Cam Link) atau EOS Webcam Utility.
  - Dikenali sebagai perangkat video UVC standar Windows.
- **Audio Cue & Shimmer:** `frontend/src/services/soundEffects.ts` memutar audio pemandu saat hitung mundur dan flash kilat putih saat shutter terpicu.
- **Foot Pedal Clicker:** Event listener di `CameraScreen.tsx` mendeteksi tombol pedal kaki USB (`Space`, `Enter`, `PageDown`) untuk mengambil foto tanpa menyentuh layar.
