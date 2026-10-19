# 📋 Panduan Instalasi — SIM TU (Arsitektur REST API + GitHub Pages)

Migrasi dari versi lama (HtmlService + `google.script.run`, satu Web App GAS) ke arsitektur baru:
- **Backend**: Google Apps Script sebagai REST API murni (JSON)
- **Frontend**: file statis di GitHub Pages, berkomunikasi lewat `fetch()`

Data staf, laporan, dan izin yang sudah ada **tidak hilang** — backend baru memakai Spreadsheet & folder Drive yang sama.

---

## === BACKEND (Google Apps Script) ===

1. Buka proyek Apps Script SIM TU Anda yang **sudah ada** (jangan buat baru).
2. **Replace seluruh isi file `Kode`** dengan isi `Kode.gs` versi REST API yang diberikan terpisah di chat (bukan di dalam ZIP ini).
3. **Hapus file `Index.html`, `Stylesheet.html`, `JavaScript.html`** dari proyek Apps Script — sudah tidak dipakai lagi (frontend sekarang di GitHub Pages).
4. Jalankan fungsi **`migrasiKeRestAPI`** (BUKAN `setupAppEnvironment`, supaya data lama tidak tertimpa):
   - Dropdown fungsi di toolbar → pilih `migrasiKeRestAPI` → klik ▶ Run
   - Izinkan akses saat diminta
   - Cek Execution Log, harus muncul: `✅ Migrasi ke REST API selesai. Data staf/laporan/izin lama tetap aman.`
   - ⚠️ Kalau Anda justru instalasi BARU (belum pernah ada data sama sekali), jalankan `setupAppEnvironment` sebagai gantinya.
5. **Deploy → New Deployment** (buat deployment BARU, bukan edit yang lama, karena jenis aplikasinya berubah total):
   - Pilih tipe **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** → **copy URL yang berakhiran `/exec`**

---

## === FRONTEND (GitHub Pages) ===

1. Ekstrak ZIP frontend yang diberikan — folder hasil ekstrak **adalah** folder yang nanti di-`git init` (ada `index.html` langsung di dalamnya, tidak ada folder pembungkus lagi di luar itu).
2. Buka `js/config.js` di folder tersebut, ganti baris:
   ```js
   const GAS_URL = 'PASTE_URL_DEPLOY_APPS_SCRIPT_ANDA_DI_SINI';
   ```
   dengan URL `/exec` dari langkah Backend #5 di atas.
3. Ikuti panduan deploy ke GitHub Pages langkah demi langkah di chat (buat repo, `git init`, `git add .`, `git commit`, `git push`, aktifkan Pages di Settings → Pages).
4. Setelah online, situs akan muncul di `https://USERNAME.github.io/NAMA-REPO/`.

---

## === TEST ===

1. Buka URL GitHub Pages Anda.
2. Halaman login harus muncul (bukan macet loading) — ini tandanya `fetch()` ke backend berhasil.
3. Login sebagai staf (NIP) → coba kirim laporan dengan foto kamera → cek apakah muncul di Google Sheets `LaporanPekerjaan`.
4. Login sebagai admin → cek Dashboard, Validasi Izin, Data Master Staf, Laporan Staf TU, Pengaturan — semua harus menampilkan data yang sama seperti sebelumnya.
5. Buka Chrome DevTools (F12) → tab **Console** dan **Network** → pastikan tidak ada error CORS merah.

## Troubleshooting singkat

| Gejala | Kemungkinan Penyebab |
|---|---|
| Halaman blank / macet loading | `GAS_URL` di `js/config.js` belum diisi atau salah |
| Error CORS di Console | Deployment GAS belum "Anyone" akses, atau URL bukan yang `/exec` |
| Data tidak tampil tapi tidak ada error | Backend belum di-`migrasiKeRestAPI()`, Script Properties kosong |
| Foto gagal terkirim | Folder Drive lama tidak ketemu — cek `migrasiKeRestAPI()` berhasil menampilkan Spreadsheet URL di log |
