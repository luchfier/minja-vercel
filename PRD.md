# MINJAPHOTOBOOTH — PRODUCT REQUIREMENTS DOCUMENT

**Versi:** 1.0  
**Platform:** Windows 10/11 64-bit  
**Jenis aplikasi:** Self-service photobooth desktop  
**Status:** Rancangan awal  
**Nama produk:** MinjaPhotobooth

## 1. Tujuan Produk

MinjaPhotobooth adalah aplikasi photobooth mandiri yang memungkinkan pelanggan membeli paket sesi, mengambil foto, memilih dan mengedit hasil, mencetak foto ukuran 4R, serta menerima soft file melalui QR atau Email tanpa membutuhkan operator sepanjang sesi.

Aplikasi dilengkapi panel admin untuk mengelola tampilan, harga, paket, kamera, printer, sesi, template, dan laporan transaksi.

## 2. Target Pengguna

### Pelanggan
- Menggunakan layar touchscreen.
- Memilih paket dan membayar dengan QRIS.
- Mengambil sejumlah foto sesuai paket.
- Melihat dan menghapus hasil foto yang tidak diinginkan.
- Mengedit foto dengan frame, filter, teks, dan sticker.
- Menambah jumlah cetak dengan biaya tambahan.
- Mengunduh foto melalui QR atau menerima tautan melalui Email.

### Admin
- Masuk melalui menu tersembunyi dengan PIN.
- Mengatur tampilan awal, logo, teks, wallpaper, dan warna.
- Mengelola paket, harga, durasi, sesi, dan batas foto.
- Mengelola template, kamera, dan printer.
- Memeriksa status sesi, transaksi, pembayaran gagal, serta pekerjaan cetak.
- Mengatur masa penyimpanan foto dan konfigurasi pengiriman.

## 3. Alur Pelanggan

1. Pelanggan melihat halaman awal dan menekan Mulai Sesi.
2. Pelanggan memilih paket sesi.
3. Sistem menampilkan ringkasan harga dan pembayaran QRIS.
4. Pelanggan melakukan pembayaran.
5. Backend memvalidasi status transaksi dari Midtrans.
6. Sesi kamera baru dibuka setelah pembayaran dinyatakan berhasil.
7. Pelanggan mengambil foto sampai batas sesi tercapai.
8. Pelanggan memilih, menghapus, dan mengedit hasil foto.
9. Pelanggan memilih template/frame dan efek foto.
10. Pelanggan memilih jumlah cetak dan membayar tambahan bila diperlukan.
11. Aplikasi merender foto final untuk cetak 4R dan soft file.
12. Sistem mencetak foto serta menghasilkan QR galeri.
13. Jika pelanggan memilih Email, sistem mengirim tautan galeri privat secara instan.
14. Sistem menampilkan status akhir dan membersihkan data sementara sesuai kebijakan penyimpanan.

## 4. Persyaratan Fungsional

### Kamera
- Webcam USB.
- Virtual webcam yang dikenali oleh Windows.
- Kamera DSLR/mirrorless melalui adapter terpisah.
- Target integrasi pertama: Canon EOS 600D.
- Deteksi perangkat dan status koneksi.
- Live preview, shutter, countdown, serta status error.
- Dukungan multi-kamera melalui adapter yang kompatibel.
- Pengaturan jumlah pengambilan foto, jumlah foto terpilih, dan durasi sesi.

Dukungan kamera harus diverifikasi berdasarkan model dan kemampuan driver. Jangan mengklaim semua DSLR dapat menggunakan seluruh fungsi.

### Editor Foto
- Preview foto.
- Hapus foto yang tidak dipilih.
- Crop, rotate, brightness, contrast, dan filter.
- Frame/template.
- Sticker dan teks.
- Undo/redo.
- Preview layout cetak.
- Ekspor hasil akhir dalam resolusi tinggi tanpa bergantung pada screenshot layar.

### Paket dan Harga
- Harga setiap paket.
- Jumlah sesi.
- Jumlah foto yang boleh diambil dan dipilih.
- Durasi sesi.
- Harga cetak per lembar.
- Harga tambahan sesi atau layanan, bila diaktifkan.
- Semua harga dihitung di backend, bukan dipercaya dari frontend.

### Pembayaran
- Midtrans Snap dengan metode QRIS yang telah diaktifkan pada akun merchant.
- Status menunggu, berhasil, kedaluwarsa, dibatalkan, atau gagal.
- Sesi hanya aktif setelah pembayaran terverifikasi.
- Notifikasi pembayaran diproses secara idempotent.
- Pembayaran gagal tidak boleh membuka sesi.
- Rekonsiliasi status transaksi ketika webhook terlambat atau aplikasi kehilangan koneksi.

### Pencetakan
- Pilih printer yang dikenali Windows.
- Status online/offline jika informasi tersebut tersedia.
- Test print.
- Ukuran kertas 4R.
- Pengaturan jumlah copy, margin, orientasi, dan borderless sesuai kemampuan driver.
- Antrean pekerjaan cetak dan pencatatan kegagalan.
- Tombol cetak ulang bagi admin dengan pencatatan audit.

### Pengiriman Digital
- Galeri foto berbasis tautan privat.
- QR khusus untuk galeri, terpisah dari QR pembayaran.
- Tautan download yang memiliki token acak dan masa berlaku.
- Integrasi pengiriman Email (SMTP / Nodemailer).
- Status antrean pengiriman dan error.
- Pengaturan retensi foto yang dapat diubah admin.

### Panel Admin
- Login dengan PIN.
- Menu admin tersembunyi dari layar pelanggan.
- Pengelolaan branding.
- CRUD paket, template, kamera, dan konfigurasi printer.
- Pengelolaan harga serta biaya tambahan cetak.
- Pengaturan waktu, batas foto, dan jumlah sesi.
- Laporan pendapatan berdasarkan tanggal dan status pembayaran.
- Laporan transaksi berhasil, gagal, kedaluwarsa, serta pekerjaan cetak gagal.
- Ekspor laporan CSV.
- Log tindakan penting admin.

## 5. Persyaratan Nonfungsional

- Antarmuka mendukung touchscreen dan layar landscape.
- Tampilan modern, responsif, dan mudah dipahami.
- Animasi blur dan transisi tidak menghambat pengambilan foto.
- Proses cetak dan upload tidak membekukan UI.
- Foto asli tidak berubah saat pengguna melakukan crop atau filter.
- Rahasia pembayaran tidak disimpan di frontend.
- PIN tidak boleh disimpan dalam bentuk teks biasa.
- Admin dan endpoint sensitif harus memiliki autentikasi.
- Data foto harus dilindungi dengan token yang sulit ditebak dan retensi yang jelas.
- Kesalahan perangkat harus menghasilkan pesan yang mudah dipahami.
- Aplikasi dapat diperbarui tanpa menghapus foto, pengaturan, atau database lokal.
- Ada log error untuk proses debug.

## 6. Batasan Versi Pertama

Versi pertama fokus pada satu komputer Windows, satu kamera DSLR yang telah diuji, webcam, satu printer utama, QRIS, QR galeri, serta editor foto dasar.

Multi-kamera, berbagai merek DSLR, banyak printer dengan protokol khusus, efek background blur berbasis AI, dan fitur operasional lanjutan dikembangkan setelah alur dasar stabil.

## 7. Definisi Selesai

Aplikasi baru dinyatakan siap operasional setelah:
- Build installer Windows berhasil.
- Pembayaran sandbox dan produksi telah diuji.
- Webhook memvalidasi pembayaran dengan benar.
- Canon EOS 600D atau kamera target berhasil mengambil foto.
- Webcam dan virtual webcam telah diuji.
- Hasil edit dapat diekspor dengan resolusi yang sesuai.
- Test print menghasilkan foto 4R yang benar secara ukuran dan orientasi.
- QR galeri bisa dibuka dari ponsel lain.
- Pengiriman Email diuji pada server SMTP yang dikonfigurasi.
- Admin dapat mengubah paket dan tampilan tanpa mengedit kode.
- Transaksi gagal tidak membuka sesi.
- Kegagalan internet, kamera, dan printer dapat ditangani.
- Update aplikasi tidak merusak data yang sudah ada.

