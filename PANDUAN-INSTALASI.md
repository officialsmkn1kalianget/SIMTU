# 📋 Panduan Update — SIM TU Instant UX

Update performa dari versi REST API sebelumnya. **Tidak ada perubahan struktur data** — Spreadsheet & folder Drive yang sama tetap dipakai, aman untuk langsung di-deploy di atas instalasi yang sudah ada.

## Apa yang berubah?

| Sebelum | Sesudah |
|---|---|
| Setiap pindah menu → fetch ke server (1-3 detik) | Navigasi **instan (0ms)** — data sudah ada di cache browser |
| 5 kali panggilan server terpisah saat buka dashboard admin | **1 kali panggilan** ("bootstrap") saat login, sisanya dari cache |
| Kirim laporan → tunggu respons → fetch ulang daftar riwayat | **Optimistic UI** — tampilan update instan begitu server konfirmasi, tanpa fetch ulang |
| Buka app lagi besok → loading dari nol | **Cache lokal (localStorage)** — app langsung tampil dengan data lama sambil diam-diam disegarkan |
| `importStafBatch` looping satu-satu ke Sheets | Satu kali `setValues()` batch — jauh lebih cepat untuk import banyak data |
| Setiap baca data query ulang ke Google Sheets | **CacheService** di backend (milidetik, bukan ratusan ms) |

## === BACKEND ===

1. Buka proyek Apps Script SIM TU Anda.
2. **Replace seluruh isi file `Kode`** dengan isi `Kode_REST_API.gs` versi terbaru (sudah termasuk caching + bootstrap).
3. **Tidak perlu** menjalankan fungsi migrasi apa pun — ID Spreadsheet & folder di Script Properties tidak berubah.
4. **Deploy → Manage Deployments → ikon pensil → Version: New Version → Deploy.**
   - URL `/exec` Anda **tetap sama**, tidak perlu update `config.js` di frontend.

## === FRONTEND ===

1. Ekstrak ulang `SIM-TU-frontend.zip` yang baru.
2. **Salin isi `js/config.js` Anda yang lama** (yang sudah berisi `GAS_URL`) ke file `js/config.js` yang baru — atau cukup isi ulang `GAS_URL`-nya.
3. Replace seluruh isi folder `js/` dan `index.html` di repo GitHub Anda dengan versi baru.
4. Di PowerShell, dari dalam folder repo:
   ```
   git add .
   git commit -m "Upgrade: instant UX (caching + optimistic update)"
   git push
   ```
5. GitHub Pages otomatis update dalam 1-2 menit.

## === TEST ===

1. Login → pindah-pindah menu admin (Dashboard → Validasi Izin → Data Staf → Laporan Staf TU → Pengaturan). Seharusnya **tidak ada loading spinner** sama sekali setelah login pertama kali.
2. Validasi satu izin → status badge berubah **seketika**, tidak menunggu.
3. Tambah/edit/hapus staf → tabel update **seketika**.
4. Tutup browser, buka lagi → aplikasi harus langsung tampil (bukan loading kosong) sebelum data tersegarkan diam-diam.
5. Kirim laporan pekerjaan dari sisi staf → kembali ke Presensi, status "Sudah Lapor" harus **langsung** muncul tanpa delay.

## Catatan Cache

- Data di-cache di server (CacheService) selama 1-10 menit tergantung jenisnya, dan otomatis dihapus begitu ada perubahan (tambah/edit/hapus data).
- Data di-cache di browser (localStorage) selama 30 menit sebelum dianggap usang dan diambil ulang otomatis.
- Tombol **"Segarkan"/"Muat Ulang"** tersedia di tiap halaman admin untuk memaksa ambil data terbaru kapan saja.
