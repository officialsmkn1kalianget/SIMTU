// ============================================================
// SIM TU — Logika Aplikasi (Frontend)
// Diadaptasi dari versi HtmlService: seluruh pemanggilan
// google.script.run sudah diganti fungsi dari api.js (fetch-based).
// Pastikan config.js (GAS_URL) dan api.js dimuat SEBELUM file ini.
// ============================================================

// ════════════════════════════════════════════════════════
// STATE GLOBAL
// ════════════════════════════════════════════════════════
const AppState = {
  role: null,          // 'staf' | 'admin'
  user: null,          // objek staf / admin aktif
  config: {},
  riwayatHariIni: [],
  fotoCapture: { base64: null, mime: null, fileName: null },
  gpsCapture: { lat: null, lng: null, valid: false, jarak: null },
  izinFoto: { base64: null, mime: null, fileName: null },
  chartInstances: {},
  dataStafCache: [],
  dataIzinCache: [],
  rekapCache: []
};

const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

// ════════════════════════════════════════════════════════
// INISIALISASI
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('simtu_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('darkModeToggleAdmin') && (document.getElementById('darkModeToggleAdmin').checked = savedTheme === 'dark');

  getAllConfig()
    .then(res => {
      document.getElementById('loadingOverlay').style.display = 'none';

      if (!res) {
        showAuthScreen();
        showToast('Perhatian', 'Backend mengembalikan respons kosong (null). Cek: (1) tidak ada file "Code.gs" default yang tersisa selain "Kode", (2) jalankan setupAppEnvironment() lalu Deploy ulang (New Version).', 'danger');
        return;
      }

      if (res.success) AppState.config = res.data;
      else showToast('Perhatian', res.message || 'Konfigurasi belum siap. Jalankan setupAppEnvironment() terlebih dahulu.', 'warning');

      const savedSession = JSON.parse(localStorage.getItem('simtu_session') || 'null');
      if (savedSession) {
        AppState.role = savedSession.role;
        AppState.user = savedSession.user;
        enterApp();
      } else {
        showAuthScreen();
      }
    })
    .catch(err => {
      document.getElementById('loadingOverlay').style.display = 'none';
      showAuthScreen();
      showToast('Perhatian', 'Gagal memuat konfigurasi: ' + err.message + '. Jalankan setupAppEnvironment() terlebih dahulu.', 'danger');
    });
});

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('stafShell').style.display = 'none';
  document.getElementById('adminShell').style.display = 'none';
  if (AppState.config.namaSekolah) {
    document.getElementById('authAppSub').textContent = AppState.config.namaSekolah;
  }
}

function switchAuthTab(role) {
  document.querySelectorAll('#authTabs .nav-link').forEach(b => b.classList.toggle('active', b.dataset.role === role));
  document.getElementById('formLoginStaf').style.display = role === 'staf' ? 'block' : 'none';
  document.getElementById('formLoginAdmin').style.display = role === 'admin' ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════
// AUTENTIKASI
// ════════════════════════════════════════════════════════
function handleLoginStaf(e) {
  e.preventDefault();
  const nip = document.getElementById('nipInput').value.trim();
  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, 'Memeriksa...');
  loginStaf(nip)
    .then(res => {
      resetBtn(btn, '<i class="bi bi-box-arrow-in-right"></i> Masuk sebagai Staf');
      if (!res) { showToast('Gagal Masuk', 'Respons kosong dari server.', 'danger'); return; }
      if (res.success) {
        AppState.role = 'staf';
        AppState.user = res.data;
        localStorage.setItem('simtu_session', JSON.stringify({ role: 'staf', user: res.data }));
        enterApp();
      } else {
        showToast('Gagal Masuk', res.message, 'danger');
      }
    })
    .catch(err => { resetBtn(btn, '<i class="bi bi-box-arrow-in-right"></i> Masuk sebagai Staf'); showToast('Error', err.message, 'danger'); });
}

function handleLoginAdmin(e) {
  e.preventDefault();
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value;
  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, 'Memeriksa...');
  loginAdmin(u, p)
    .then(res => {
      resetBtn(btn, '<i class="bi bi-shield-lock"></i> Masuk sebagai Admin');
      if (!res) { showToast('Gagal Masuk', 'Respons kosong dari server.', 'danger'); return; }
      if (res.success) {
        AppState.role = 'admin';
        AppState.user = res.data;
        localStorage.setItem('simtu_session', JSON.stringify({ role: 'admin', user: res.data }));
        enterApp();
      } else {
        showToast('Gagal Masuk', res.message, 'danger');
      }
    })
    .catch(err => { resetBtn(btn, '<i class="bi bi-shield-lock"></i> Masuk sebagai Admin'); showToast('Error', err.message, 'danger'); });
}

function handleLogout() {
  localStorage.removeItem('simtu_session');
  AppState.role = null; AppState.user = null;
  document.getElementById('stafShell').style.display = 'none';
  document.getElementById('adminShell').style.display = 'none';
  showAuthScreen();
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  const nama = AppState.config.namaSekolah || 'SIM TU';
  if (AppState.role === 'staf') {
    document.getElementById('stafShell').style.display = 'flex';
    document.getElementById('adminShell').style.display = 'none';
    navigateStaf('presensi');
  } else {
    document.getElementById('adminShell').style.display = 'flex';
    document.getElementById('stafShell').style.display = 'none';
    document.getElementById('adminSchoolName').textContent = nama;
    navigateAdmin('dashboard');
  }
}

// ════════════════════════════════════════════════════════
// UTILITAS UMUM
// ════════════════════════════════════════════════════════
function showToast(title, msg, type) {
  const toastEl = document.getElementById('appToast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastBody').textContent = msg;
  toastEl.className = 'toast text-bg-' + (type || 'primary');
  new bootstrap.Toast(toastEl, { delay: 3500 }).show();
}

function setBtnLoading(btn, text) {
  btn.dataset.original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-inline"></span> ' + text;
  btn.disabled = true;
}
function resetBtn(btn, fallback) {
  btn.innerHTML = btn.dataset.original || fallback;
  btn.disabled = false;
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('simtu_theme', next);
  const chk = document.getElementById('darkModeToggleAdmin');
  if (chk) chk.checked = next === 'dark';
  Object.values(AppState.chartInstances).forEach(c => c && c.update && c.update());
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('show'); }

function previewFoto(url, title) {
  document.getElementById('previewTitle').textContent = title || 'Pratinjau Foto';
  document.getElementById('previewContent').innerHTML = `<img src="${url}" class="img-fluid rounded" style="max-height:70vh;">`;
  new bootstrap.Modal(document.getElementById('previewModal')).show();
}

function confirmAction(title, body, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  const btn = document.getElementById('confirmActionBtn');
  btn.onclick = () => { modal.hide(); onConfirm(); };
  modal.show();
}

function formatTanggalIndo(tglStr) {
  const d = new Date(tglStr + 'T00:00:00');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// ════════════════════════════════════════════════════════
// LOGIKA SESI LAPORAN
// ════════════════════════════════════════════════════════
function getJadwalSesiHariIni() {
  const now = new Date();
  const isJumat = now.getDay() === 5;
  const cfg = AppState.config || {};
  const d = (v, fb) => (v ? v : fb); // fallback jika config belum termuat dari server
  const semua = [
    { sesi: 1, mulai: d(cfg.sesi1Mulai, '06:00'), selesai: d(cfg.sesi1Selesai, '10:00'), label: 'Sesi 1: Presensi Pagi' },
    { sesi: 2, mulai: d(cfg.sesi2Mulai, '10:30'), selesai: d(cfg.sesi2Selesai, '12:30'), label: 'Sesi 2: Progres Siang' },
    { sesi: 3, mulai: d(cfg.sesi3Mulai, '13:00'), selesai: d(cfg.sesi3Selesai, '16:00'), label: 'Sesi 3: Laporan Akhir' }
  ];
  return isJumat ? semua.slice(0, 2) : semua;
}

// Pastikan AppState.config selalu yang terbaru dari server sebelum render
// (dipakai terutama oleh halaman Pengaturan agar tidak tampil kosong).
function refreshConfigThenRender(callback) {
  getAllConfig()
    .then(res => { if (res && res.success) AppState.config = res.data; callback(); })
    .catch(x => { callback(); });
}

function waktuKeMenit(hhmm) { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + m; }

function statusSesiSaatIni(sesi) {
  const now = new Date();
  const menitSekarang = now.getHours() * 60 + now.getMinutes();
  const mulai = waktuKeMenit(sesi.mulai), selesai = waktuKeMenit(sesi.selesai);
  const sudahLapor = AppState.riwayatHariIni.some(r => Number(r.Sesi) === sesi.sesi);
  if (sudahLapor) return 'selesai';
  if (menitSekarang < mulai) return 'terkunci';
  if (menitSekarang > selesai) return 'lewat';
  return 'aktif';
}

// ════════════════════════════════════════════════════════
// NAVIGASI STAF
// ════════════════════════════════════════════════════════
function navigateStaf(section) {
  document.querySelectorAll('.staf-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  document.getElementById('staf-section-' + section).classList.add('active');

  if (section === 'presensi') renderStafPresensi();
  else if (section === 'laporan') renderStafLaporan();
  else if (section === 'izin') renderStafIzin();
  else if (section === 'profil') renderStafProfil();
}

function loadRiwayatHariIni(callback) {
  getRiwayatLaporanHariIni(AppState.user.NIP)
    .then(res => { AppState.riwayatHariIni = res.success ? res.data : []; callback(); })
    .catch(x => { AppState.riwayatHariIni = []; callback(); });
}

function renderStafPresensi() {
  const el = document.getElementById('staf-section-presensi');
  el.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
  loadRiwayatHariIni(() => {
    const jadwal = getJadwalSesiHariIni();
    const now = new Date();
    const hariLabel = HARI_ID[now.getDay()] + ', ' + formatTanggalIndo(now.toISOString().slice(0,10));

    let cardsHtml = jadwal.map(s => {
      const st = statusSesiSaatIni(s);
      const cls = st === 'selesai' ? 'done-session' : st === 'aktif' ? 'active-session' : 'locked-session';
      const pill = st === 'selesai' ? '<span class="status-pill status-success"><i class="bi bi-check-circle"></i> Sudah Lapor</span>'
        : st === 'aktif' ? '<span class="status-pill status-warning"><i class="bi bi-clock"></i> Sesi Aktif</span>'
        : st === 'lewat' ? '<span class="status-pill status-danger"><i class="bi bi-x-circle"></i> Terlewat</span>'
        : '<span class="status-pill" style="background:var(--border-color);color:var(--text-secondary);"><i class="bi bi-lock"></i> Belum Dibuka</span>';
      return `
        <div class="card-simtu session-card ${cls}">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>${s.label}</strong>
              <div class="small text-muted-simtu">${s.mulai} - ${s.selesai} WIB</div>
            </div>
            ${pill}
          </div>
          ${st === 'aktif' ? `<button class="btn btn-sm btn-primary mt-2" onclick="navigateStaf('laporan')"><i class="bi bi-camera"></i> Isi Laporan Sekarang</button>` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="card-simtu" style="background:var(--accent-light);border:none;">
        <strong>${AppState.user.Nama}</strong>
        <div class="small text-muted-simtu">NIP. ${AppState.user.NIP} &middot; ${AppState.user.BidangTugas || '-'}</div>
      </div>
      <h6 class="mb-2">Siklus Laporan Harian</h6>
      <div class="small text-muted-simtu mb-2">${hariLabel}</div>
      ${cardsHtml}
      <div class="card-simtu">
        <strong>Riwayat Laporan Hari Ini</strong>
        <div class="mt-2">${renderDaftarRiwayat()}</div>
      </div>
    `;
  });
}

function renderDaftarRiwayat() {
  if (!AppState.riwayatHariIni.length) return '<div class="text-muted-simtu small">Belum ada laporan hari ini.</div>';
  return AppState.riwayatHariIni.map(r => `
    <div class="d-flex align-items-center gap-2 mb-2 pb-2" style="border-bottom:1px solid var(--border-color);">
      <img src="${r.FotoURL}" class="thumb-foto" onclick="previewFoto('${r.FotoURL}','Sesi ${r.Sesi}')">
      <div class="flex-grow-1">
        <div class="small fw-bold">Sesi ${r.Sesi} &middot; ${r.JamLapor}</div>
        <div class="small text-muted-simtu">${r.Keterangan}</div>
      </div>
      <span class="status-pill ${r.Status === 'Tepat Waktu' ? 'status-success' : 'status-warning'}">${r.Status}</span>
    </div>`).join('');
}

function renderStafLaporan() {
  const el = document.getElementById('staf-section-laporan');
  const jadwal = getJadwalSesiHariIni();
  const sesiAktif = jadwal.find(s => statusSesiSaatIni(s) === 'aktif');

  if (!sesiAktif) {
    el.innerHTML = `<div class="card-simtu text-center py-5"><i class="bi bi-hourglass-split fs-1 text-muted-simtu"></i>
      <p class="mt-3 text-muted-simtu">Tidak ada sesi laporan yang aktif saat ini. Silakan cek jadwal di tab Presensi.</p></div>`;
    return;
  }

  AppState.fotoCapture = { base64: null, mime: null, fileName: null };
  AppState.gpsCapture = { lat: null, lng: null, valid: false, jarak: null };

  el.innerHTML = `
    <div class="card-simtu">
      <strong>Input Laporan ${sesiAktif.label}</strong>
      <div class="small text-muted-simtu mb-2">Wajib foto langsung dari kamera &amp; lokasi tervalidasi GPS.</div>
      <div id="gpsBannerBox" class="gps-banner" style="background:var(--border-color);color:var(--text-secondary);">
        <i class="bi bi-geo-alt"></i> <span id="gpsBannerText">Mengecek lokasi Anda...</span>
      </div>

      <div class="camera-box" id="cameraBoxLaporan">
        <div class="camera-placeholder"><i class="bi bi-camera fs-2"></i><div>Ambil foto pekerjaan yang sedang dikerjakan</div></div>
      </div>
      <input type="file" accept="image/*" capture="environment" id="inputFotoLaporan" style="display:none;" onchange="handleCaptureFoto(event,'laporan')">
      <button class="btn-camera" onclick="document.getElementById('inputFotoLaporan').click()">
        <i class="bi bi-camera-fill"></i> Ambil Foto Langsung (Kamera)
      </button>
      <div class="no-gallery-note"><i class="bi bi-shield-lock"></i> Unggah dari galeri dinonaktifkan sesuai kebijakan sekolah.</div>

      <div class="mt-3">
        <label class="form-label">Keterangan Pekerjaan yang Dikerjakan</label>
        <textarea class="form-control" id="keteranganLaporan" rows="3" minlength="10" placeholder="Rincikan pekerjaan secara spesifik" required></textarea>
      </div>

      <button class="btn-submit-laporan mt-3" id="btnKirimLaporan" onclick="submitLaporanPekerjaan(${sesiAktif.sesi})" disabled>
        <i class="bi bi-send"></i> Kirim Laporan Sesi ${sesiAktif.sesi}
      </button>
    </div>
  `;

  ambilLokasiDanValidasi();
}

function ambilLokasiDanValidasi() {
  if (!navigator.geolocation) {
    document.getElementById('gpsBannerText').textContent = 'Perangkat tidak mendukung GPS.';
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    AppState.gpsCapture.lat = pos.coords.latitude;
    AppState.gpsCapture.lng = pos.coords.longitude;
    cekRadiusGPS(pos.coords.latitude, pos.coords.longitude)
    .then(res => {
        const box = document.getElementById('gpsBannerBox');
        const txt = document.getElementById('gpsBannerText');
        if (!box) return;
        if (res.success && res.data.valid) {
          box.className = 'gps-banner gps-ok';
          txt.textContent = `Dalam radius sekolah (${res.data.jarak}m dari titik pusat)`;
          AppState.gpsCapture.valid = true;
        } else {
          box.className = 'gps-banner gps-fail';
          txt.textContent = `Di luar radius sekolah (${res.data ? res.data.jarak : '?'}m). Mendekatlah ke area sekolah.`;
          AppState.gpsCapture.valid = false;
        }
        evaluasiTombolKirim();
      })
    .catch(x => {
        document.getElementById('gpsBannerText').textContent = 'Gagal memvalidasi lokasi ke server.';
      });
  }, () => {
    const box = document.getElementById('gpsBannerBox');
    if (box) { box.className = 'gps-banner gps-fail'; document.getElementById('gpsBannerText').textContent = 'Izin lokasi ditolak. Aktifkan GPS untuk melapor.'; }
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function evaluasiTombolKirim() {
  const btn = document.getElementById('btnKirimLaporan');
  if (!btn) return;
  btn.disabled = !(AppState.fotoCapture.base64 && AppState.gpsCapture.valid);
}

// ── Kompresi & capture foto (kamera only, tanpa galeri) ──
function handleCaptureFoto(event, tujuan) {
  const file = event.target.files[0];
  if (!file) return;
  compressImage(file, 1000, 0.65, (base64, mime) => {
    const target = tujuan === 'laporan' ? 'fotoCapture' : 'izinFoto';
    AppState[target] = { base64, mime, fileName: 'simtu_' + Date.now() + '.jpg' };
    const boxId = tujuan === 'laporan' ? 'cameraBoxLaporan' : 'cameraBoxIzin';
    const box = document.getElementById(boxId);
    if (box) box.innerHTML = `<img src="data:${mime};base64,${base64}">`;
    if (tujuan === 'laporan') evaluasiTombolKirim();
    else evaluasiTombolKirimIzin();
  });
}

function compressImage(file, maxDim, quality, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(dataUrl.split(',')[1], 'image/jpeg');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function submitLaporanPekerjaan(sesi) {
  const keterangan = document.getElementById('keteranganLaporan').value.trim();
  if (keterangan.length < 10) { showToast('Peringatan', 'Keterangan minimal 10 karakter.', 'warning'); return; }
  if (!AppState.fotoCapture.base64) { showToast('Peringatan', 'Ambil foto terlebih dahulu.', 'warning'); return; }

  const btn = document.getElementById('btnKirimLaporan');
  setBtnLoading(btn, 'Mengirim...');

  kirimLaporanPekerjaan({
      nip: AppState.user.NIP, nama: AppState.user.Nama, sesi,
      keterangan, lat: AppState.gpsCapture.lat, lng: AppState.gpsCapture.lng,
      fotoBase64: AppState.fotoCapture.base64, mimeType: AppState.fotoCapture.mime, fileName: AppState.fotoCapture.fileName
    })
    .then(res => {
      if (res.success) {
        showToast('Berhasil', res.message, 'success');
        navigateStaf('presensi');
      } else {
        resetBtn(btn, '<i class="bi bi-send"></i> Kirim Laporan Sesi ' + sesi);
        showToast('Gagal', res.message, 'danger');
      }
    })
    .catch(err => { resetBtn(btn, '<i class="bi bi-send"></i> Kirim Laporan Sesi ' + sesi); showToast('Error', err.message, 'danger'); });
}

// ── Izin ──
function renderStafIzin() {
  AppState.izinFoto = { base64: null, mime: null, fileName: null };
  const el = document.getElementById('staf-section-izin');
  el.innerHTML = `
    <div class="card-simtu">
      <strong>Ajukan Izin / Surat Dokter</strong>
      <div class="small text-muted-simtu mb-2">Unggah foto surat izin/keterangan. Akan divalidasi oleh Kepala TU.</div>

      <label class="form-label small mt-2">Kategori Izin</label>
      <select class="form-select mb-2" id="kategoriIzin" onchange="evaluasiTombolKirimIzin()">
        <option value="Sakit">Sakit</option>
        <option value="Izin Pribadi/Mendesak">Izin Kepentingan Pribadi / Mendesak</option>
        <option value="Dinas Luar">Dinas Luar / Pelatihan Resmi</option>
      </select>

      <label class="form-label small">Alasan / Keterangan</label>
      <textarea class="form-control mb-2" id="keteranganIzin" rows="3" minlength="10" placeholder="Jelaskan alasan izin secara singkat (min. 10 karakter)" oninput="evaluasiTombolKirimIzin()"></textarea>

      <label class="form-label small">Lampiran Bukti (Surat Dokter/Tugas)</label>
      <div class="camera-box" id="cameraBoxIzin"><div class="camera-placeholder"><i class="bi bi-file-earmark-image fs-2"></i><div>Foto surat izin / dokter</div></div></div>
      <input type="file" accept="image/*" capture="environment" id="inputFotoIzin" style="display:none;" onchange="handleCaptureFoto(event,'izin')">
      <button class="btn-camera" onclick="document.getElementById('inputFotoIzin').click()"><i class="bi bi-camera-fill"></i> Ambil Foto Surat (Kamera)</button>
      <button class="btn-submit-laporan mt-3" id="btnKirimIzin" onclick="submitLaporanIzin()" disabled><i class="bi bi-send"></i> Kirim Pengajuan Izin</button>
    </div>
    <div class="card-simtu">
      <strong>Riwayat Pengajuan Izin</strong>
      <div id="riwayatIzinStaf" class="mt-2"><div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>
    </div>
  `;
  getAllLaporanIzin()
    .then(res => {
      const box = document.getElementById('riwayatIzinStaf');
      if (!res || !res.success) { box.innerHTML = `<div class="small text-danger">Gagal memuat riwayat: ${res ? res.message : 'Respons kosong dari server.'}</div>`; return; }
      const list = (res.data || []).filter(r => String(r.NIP) === String(AppState.user.NIP)).reverse();
      if (!list.length) { box.innerHTML = '<div class="small text-muted-simtu">Belum ada riwayat izin.</div>'; return; }
      box.innerHTML = list.map(r => {
        const pill = r.StatusValidasi === 'Disetujui' ? 'status-success' : r.StatusValidasi === 'Ditolak' ? 'status-danger' : 'status-warning';
        return `<div class="d-flex justify-content-between align-items-start mb-2 pb-2" style="border-bottom:1px solid var(--border-color);">
          <div>
            <div class="small fw-bold">${r.KategoriIzin || 'Izin'} &middot; ${formatTanggalIndo(r.Tanggal)}</div>
            <div class="small text-muted-simtu">${r.Keterangan || '-'}</div>
          </div>
          <span class="status-pill ${pill}">${r.StatusValidasi}</span>
        </div>`;
      }).join('');
    })
    .catch(err => {
      const box = document.getElementById('riwayatIzinStaf');
      if (box) box.innerHTML = `<div class="small text-danger">Gagal memuat riwayat: ${err.message}</div>`;
    });
}

function evaluasiTombolKirimIzin() {
  const btn = document.getElementById('btnKirimIzin');
  if (!btn) return;
  const ket = document.getElementById('keteranganIzin');
  btn.disabled = !(AppState.izinFoto.base64 && ket && ket.value.trim().length >= 10);
}

function submitLaporanIzin() {
  const keterangan = document.getElementById('keteranganIzin').value.trim();
  const kategori = document.getElementById('kategoriIzin').value;
  if (keterangan.length < 10) { showToast('Peringatan', 'Keterangan izin minimal 10 karakter.', 'warning'); return; }

  const btn = document.getElementById('btnKirimIzin');
  setBtnLoading(btn, 'Mengirim...');
  kirimLaporanIzin({
      nip: AppState.user.NIP, nama: AppState.user.Nama, kategori, keterangan,
      fotoBase64: AppState.izinFoto.base64, mimeType: AppState.izinFoto.mime, fileName: AppState.izinFoto.fileName
    })
    .then(res => {
      resetBtn(btn, '<i class="bi bi-send"></i> Kirim Pengajuan Izin');
      if (res.success) { showToast('Terkirim', res.message, 'success'); navigateStaf('izin'); }
      else showToast('Gagal', res.message, 'danger');
    })
    .catch(err => { resetBtn(btn, '<i class="bi bi-send"></i> Kirim Pengajuan Izin'); showToast('Error', err.message, 'danger'); });
}

function renderStafProfil() {
  const el = document.getElementById('staf-section-profil');
  el.innerHTML = `
    <div class="card-simtu text-center">
      <i class="bi bi-person-circle fs-1 text-muted-simtu"></i>
      <h5 class="mt-2 mb-0">${AppState.user.Nama}</h5>
      <div class="small text-muted-simtu">NIP. ${AppState.user.NIP}</div>
      <div class="small text-muted-simtu">${AppState.user.BidangTugas || '-'}</div>
    </div>
    <div class="card-simtu">
      <div class="d-flex justify-content-between align-items-center">
        <span><i class="bi bi-moon-stars"></i> Mode Gelap</span>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" ${document.documentElement.getAttribute('data-theme')==='dark'?'checked':''} onchange="toggleDarkMode()">
        </div>
      </div>
    </div>
    <button class="btn btn-outline-danger w-100" onclick="confirmAction('Keluar Sistem','Yakin ingin keluar dari SIM TU?', handleLogout)"><i class="bi bi-box-arrow-left"></i> Keluar dari Sistem</button>
  `;
}

// ════════════════════════════════════════════════════════
// NAVIGASI ADMIN
// ════════════════════════════════════════════════════════
function navigateAdmin(section) {
  document.querySelectorAll('.admin-shell .sidebar-nav .nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === section));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + section).classList.add('active');
  document.getElementById('sidebar').classList.remove('show');
  const titles = { dashboard: 'Monitoring Dashboard', validasi: 'Validasi Izin', masterStaf: 'Data Master Staf', cetak: 'Laporan Staf TU', pengaturan: 'Pengaturan Sistem' };
  const pt = document.getElementById('adminPageTitle'); if (pt) pt.textContent = titles[section];

  if (section === 'dashboard') renderAdminDashboard();
  else if (section === 'validasi') renderAdminValidasi();
  else if (section === 'masterStaf') renderAdminMasterStaf();
  else if (section === 'cetak') renderAdminCetak();
  else if (section === 'pengaturan') refreshConfigThenRender(renderAdminPengaturan);
}

function renderAdminDashboard() {
  const el = document.getElementById('section-dashboard');
  el.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;
  getDashboardData()
    .then(res => {
      if (!res.success) { el.innerHTML = `<div class="alert alert-danger">${res.message}</div>`; return; }
      const d = res.data;
      el.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-6 col-lg-3"><div class="kpi-card"><div class="kpi-label">Total Staf TU</div><div class="kpi-value">${d.totalStaf}</div></div></div>
          <div class="col-6 col-lg-3"><div class="kpi-card"><div class="kpi-label">Sudah Lapor</div><div class="kpi-value" style="color:var(--success-solid)">${d.sudahLapor}</div></div></div>
          <div class="col-6 col-lg-3"><div class="kpi-card"><div class="kpi-label">Belum Lapor</div><div class="kpi-value" style="color:var(--danger-solid)">${d.belumLapor}</div></div></div>
          <div class="col-6 col-lg-3"><div class="kpi-card"><div class="kpi-label">Izin Hari Ini</div><div class="kpi-value" style="color:var(--warning-solid)">${d.izinCount}</div></div></div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-lg-4"><div class="kpi-card"><strong>Kepatuhan Hari Ini</strong><canvas id="chartDonut" height="200" class="mt-2"></canvas></div></div>
          <div class="col-lg-4"><div class="kpi-card"><strong>Tren 7 Hari Terakhir</strong><canvas id="chartTren" height="200" class="mt-2"></canvas></div></div>
          <div class="col-lg-4">
            <div class="kpi-card mb-3"><strong><i class="bi bi-trophy text-warning"></i> Staf Paling Rajin</strong>
              ${d.topRajin.map((r,i)=>`<div class="d-flex justify-content-between small mt-2"><span>${i+1}. ${r.nama}</span><strong>${r.jumlah}x</strong></div>`).join('') || '<div class="small text-muted-simtu mt-2">Belum ada data.</div>'}
            </div>
            <div class="kpi-card"><strong><i class="bi bi-calendar-x text-danger"></i> Paling Sering Izin</strong>
              ${d.topIzin.map((r,i)=>`<div class="d-flex justify-content-between small mt-2"><span>${i+1}. ${r.nama}</span><strong>${r.jumlah}x</strong></div>`).join('') || '<div class="small text-muted-simtu mt-2">Belum ada data.</div>'}
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <strong><i class="bi bi-lightbulb text-warning"></i> Ringkasan Otomatis</strong>
          <ul class="mt-2 mb-0 small">${d.insights.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
      `;
      renderChartDonut(d);
      renderChartTren(d.tren);
    })
    .catch(err => { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; });
}

function renderChartDonut(d) {
  const ctx = document.getElementById('chartDonut'); if (!ctx) return;
  if (AppState.chartInstances.donut) AppState.chartInstances.donut.destroy();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  AppState.chartInstances.donut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Sudah Lapor','Belum Lapor','Izin'], datasets: [{ data: [d.sudahLapor, d.belumLapor, d.izinCount], backgroundColor: ['#16A34A','#DC2626','#D97706'], borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#e4e4e7' : '#334155' } } } }
  });
}
function renderChartTren(tren) {
  const ctx = document.getElementById('chartTren'); if (!ctx) return;
  if (AppState.chartInstances.tren) AppState.chartInstances.tren.destroy();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  AppState.chartInstances.tren = new Chart(ctx, {
    type: 'bar',
    data: { labels: tren.map(t => t.label), datasets: [{ label: '% Lapor', data: tren.map(t => t.pct), backgroundColor: '#2563EB', borderRadius: 6 }] },
    options: { scales: { y: { beginAtZero: true, max: 100, ticks: { color: isDark ? '#e4e4e7' : '#334155' } }, x: { ticks: { color: isDark ? '#e4e4e7' : '#334155' } } }, plugins: { legend: { display: false } } }
  });
}

// ── Validasi Izin ──
function renderAdminValidasi() {
  const el = document.getElementById('section-validasi');
  el.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;
  getAllLaporanIzin()
    .then(res => {
      if (!res || !res.success) {
        el.innerHTML = `<div class="alert alert-danger">Gagal memuat data izin: ${res ? res.message : 'Respons kosong dari server.'}</div>`;
        return;
      }
      AppState.dataIzinCache = res.data || [];
      const pending = AppState.dataIzinCache.filter(r => r.StatusValidasi === 'Menunggu Validasi');
      const sudahDiproses = AppState.dataIzinCache.filter(r => r.StatusValidasi !== 'Menunggu Validasi');
      const badge = document.getElementById('badgeIzin');
      if (pending.length) { badge.style.display = 'inline-block'; badge.textContent = pending.length; } else { badge.style.display = 'none'; }

      const kartuPending = pending.map(r => `
        <div class="col-md-6">
          <div class="kpi-card">
            <div class="d-flex justify-content-between"><strong>${r.Nama}</strong><span class="status-pill status-warning">Menunggu</span></div>
            <div class="small text-muted-simtu mb-1">NIP ${r.NIP} &middot; ${formatTanggalIndo(r.Tanggal)}</div>
            <div class="small fw-bold mb-2">${r.KategoriIzin || 'Izin'}: <span class="fw-normal">${r.Keterangan || '-'}</span></div>
            <img src="${r.FotoURL}" class="img-fluid rounded mb-2" style="max-height:180px;cursor:pointer;" onclick="previewFoto('${r.FotoURL}','Surat Izin ${r.Nama}')">
            <div class="d-flex gap-2">
              <button class="btn btn-success btn-sm flex-fill" onclick="prosesValidasiIzin('${r.ID}','Disetujui')"><i class="bi bi-check"></i> Setujui</button>
              <button class="btn btn-outline-danger btn-sm flex-fill" onclick="prosesValidasiIzin('${r.ID}','Ditolak')"><i class="bi bi-x"></i> Tolak</button>
            </div>
          </div>
        </div>`).join('');

      const barisRiwayat = sudahDiproses.slice().reverse().map(r => {
        const pill = r.StatusValidasi === 'Disetujui' ? 'status-success' : 'status-danger';
        return `<tr>
          <td>${formatTanggalIndo(r.Tanggal)}</td><td>${r.Nama}</td><td>${r.KategoriIzin || '-'}</td>
          <td>${r.Keterangan || '-'}</td><td><span class="status-pill ${pill}">${r.StatusValidasi}</span></td>
          <td><img src="${r.FotoURL}" class="thumb-foto" onclick="previewFoto('${r.FotoURL}','Surat Izin ${r.Nama}')"></td>
        </tr>`;
      }).join('');

      el.innerHTML = `
        <h6 class="mb-2">Menunggu Validasi (${pending.length})</h6>
        ${pending.length ? `<div class="row g-3 mb-4">${kartuPending}</div>` : `<div class="kpi-card text-center py-4 mb-4"><i class="bi bi-check-circle fs-1 text-success"></i><p class="mt-2 text-muted-simtu mb-0">Tidak ada pengajuan izin menunggu validasi.</p></div>`}
        <h6 class="mb-2">Riwayat Izin Sudah Divalidasi</h6>
        <div class="kpi-card" style="overflow-x:auto;">
          <table class="table-simtu">
            <thead><tr><th>Tanggal</th><th>Nama</th><th>Kategori</th><th>Keterangan</th><th>Status</th><th>Foto</th></tr></thead>
            <tbody>${barisRiwayat || '<tr><td colspan="6" class="text-center small text-muted-simtu py-3">Belum ada riwayat.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .catch(err => { el.innerHTML = `<div class="alert alert-danger">Gagal memuat data izin: ${err.message}</div>`; });
}

function prosesValidasiIzin(id, status) {
  validasiIzin(id, status, AppState.user.Nama)
    .then(res => { showToast(res.success ? 'Berhasil' : 'Gagal', res.message, res.success ? 'success' : 'danger'); renderAdminValidasi(); })
    .catch(err => { showToast('Error', err.message, 'danger'); });
}

// ── Master Data Staf ──
function renderAdminMasterStaf() {
  const el = document.getElementById('section-masterStaf');
  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <input type="text" class="form-control" style="max-width:280px;" placeholder="Cari nama atau NIP..." id="searchStaf" oninput="filterTabelStaf()">
      <div class="d-flex gap-2">
        <input type="file" id="inputImportExcel" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleImportExcel(event)">
        <button class="btn btn-outline-primary btn-sm" onclick="document.getElementById('inputImportExcel').click()"><i class="bi bi-file-earmark-excel"></i> Import Excel</button>
        <button class="btn btn-primary btn-sm" onclick="showFormTambahStaf()"><i class="bi bi-person-plus"></i> Tambah Staf</button>
      </div>
    </div>
    <div id="formStafContainer"></div>
    <div class="kpi-card" style="overflow-x:auto;">
      <table class="table-simtu" id="tabelStaf">
        <thead><tr><th>Nama</th><th>NIP</th><th>Bidang Tugas</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody><tr><td colspan="5" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr></tbody>
      </table>
    </div>
  `;
  loadDataStaf();
}

function loadDataStaf() {
  const tbody = document.querySelector('#tabelStaf tbody');
  getAllData('DataStaf')
    .then(res => {
      if (!res || !res.success) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center small text-danger py-3">Gagal memuat data staf: ${res ? res.message : 'Respons kosong dari server.'}</td></tr>`;
        return;
      }
      AppState.dataStafCache = res.data || [];
      renderTabelStaf(AppState.dataStafCache);
    })
    .catch(err => {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center small text-danger py-3">Gagal memuat data staf: ${err.message}</td></tr>`;
    });
}

function renderTabelStaf(list) {
  const tbody = document.querySelector('#tabelStaf tbody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center small text-muted-simtu py-3">Belum ada data staf.</td></tr>'; return; }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td>${s.Nama}</td><td>${s.NIP}</td><td>${s.BidangTugas || '-'}</td>
      <td><span class="status-pill ${s.Status === 'Aktif' ? 'status-success' : 'status-danger'}">${s.Status}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-secondary" onclick='editStaf(${JSON.stringify(s)})'><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusStaf('${s.ID}','${s.Nama.replace(/'/g,"")}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('');
}

function filterTabelStaf() {
  const q = document.getElementById('searchStaf').value.toLowerCase();
  renderTabelStaf(AppState.dataStafCache.filter(s => s.Nama.toLowerCase().includes(q) || String(s.NIP).includes(q)));
}

function showFormTambahStaf(existing) {
  const s = existing || { ID: '', Nama: '', NIP: '', BidangTugas: '' };
  document.getElementById('formStafContainer').innerHTML = `
    <div class="kpi-card mb-3">
      <strong>${existing ? 'Edit Staf' : 'Tambah Staf Baru'}</strong>
      <div class="row g-2 mt-1">
        <div class="col-md-4"><input class="form-control" id="fNama" placeholder="Nama Lengkap" value="${s.Nama}"></div>
        <div class="col-md-3"><input class="form-control" id="fNIP" placeholder="NIP" value="${s.NIP}" ${existing ? 'readonly' : ''}></div>
        <div class="col-md-3"><input class="form-control" id="fBidang" placeholder="Bidang Tugas" value="${s.BidangTugas}"></div>
        <div class="col-md-2 d-flex gap-2">
          <button class="btn btn-primary flex-fill" onclick="simpanStaf('${s.ID}')"><i class="bi bi-save"></i> Simpan</button>
        </div>
      </div>
    </div>`;
}
function editStaf(s) { showFormTambahStaf(s); }

function simpanStaf(id) {
  const record = { Nama: document.getElementById('fNama').value.trim(), NIP: document.getElementById('fNIP').value.trim(), BidangTugas: document.getElementById('fBidang').value.trim() };
  if (!record.Nama || !record.NIP) { showToast('Peringatan', 'Nama dan NIP wajib diisi.', 'warning'); return; }
  const action = id ? 'updateRecord' : 'addRecord';
  if (id) record.ID = id;
  window[action]('DataStaf', record)
    .then(res => {
      if (!res) { showToast('Gagal', 'Respons kosong dari server.', 'danger'); return; }
      showToast(res.success ? 'Berhasil' : 'Gagal', res.message, res.success ? 'success' : 'danger');
      if (res.success) { document.getElementById('formStafContainer').innerHTML = ''; loadDataStaf(); }
    })
    .catch(err => { showToast('Error', err.message, 'danger'); });
}

function hapusStaf(id, nama) {
  confirmAction('Hapus Staf', `Hapus data staf "${nama}"? Tindakan ini tidak dapat dibatalkan.`, () => {
    deleteRecord('DataStaf', id)
    .then(res => { if (!res) { showToast('Gagal', 'Respons kosong dari server.', 'danger'); return; } showToast(res.success ? 'Berhasil' : 'Gagal', res.message, res.success ? 'success' : 'danger'); loadDataStaf(); })
    .catch(err => { showToast('Error', err.message, 'danger'); });
  });
}

function handleImportExcel(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const records = rows.map(r => ({ Nama: r.Nama || r.NAMA || r.nama, NIP: r.NIP || r.nip, BidangTugas: r.BidangTugas || r['Bidang Tugas'] || r.bidangtugas || '' }));
    if (!records.length) { showToast('Peringatan', 'File Excel kosong atau format kolom tidak sesuai (Nama, NIP, BidangTugas).', 'warning'); return; }
    importStafBatch(records)
    .then(res => {
        if (!res) { showToast('Gagal', 'Respons kosong dari server.', 'danger'); return; }
        showToast(res.success ? 'Import Selesai' : 'Gagal', res.message, res.success ? 'success' : 'danger');
        loadDataStaf();
      })
    .catch(err => { showToast('Error', err.message, 'danger'); });
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

// ── Laporan Staf TU (dulu "Cetak / Ekspor Laporan") ──
// Begitu halaman dibuka, data laporan HARI INI langsung tampil otomatis
// (tanpa perlu klik tombol) — tombol "Tampilkan" hanya dipakai jika admin
// ingin mengganti rentang tanggal/filter staf.
function renderAdminCetak() {
  const el = document.getElementById('section-cetak');
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="kpi-card">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <strong>Laporan Staf TU</strong>
          <div class="small text-muted-simtu">Menampilkan laporan hari ini secara otomatis. Ubah tanggal untuk melihat periode lain.</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-danger btn-sm" onclick="eksporPDF()"><i class="bi bi-filetype-pdf"></i> Unduh PDF</button>
          <button class="btn btn-outline-success btn-sm" onclick="eksporExcel()"><i class="bi bi-filetype-xlsx"></i> Unduh Excel</button>
        </div>
      </div>
      <div class="row g-3 align-items-end mt-1">
        <div class="col-md-3"><label class="form-label">Dari Tanggal</label><input type="date" class="form-control" id="rekapAwal" value="${today}" onchange="muatRekap()"></div>
        <div class="col-md-3"><label class="form-label">Sampai Tanggal</label><input type="date" class="form-control" id="rekapAkhir" value="${today}" onchange="muatRekap()"></div>
        <div class="col-md-3"><label class="form-label">Staf (Opsional)</label>
          <select class="form-select" id="rekapNIP" onchange="muatRekap()"><option value="">Semua Staf</option>${AppState.dataStafCache.map(s=>`<option value="${s.NIP}">${s.Nama}</option>`).join('')}</select>
        </div>
        <div class="col-md-3"><button class="btn btn-primary w-100" onclick="muatRekap()"><i class="bi bi-arrow-clockwise"></i> Muat Ulang</button></div>
      </div>
    </div>
    <div class="kpi-card mt-3" style="overflow-x:auto;">
      <table class="table-simtu" id="tabelRekap">
        <thead><tr><th>Foto</th><th>Tanggal</th><th>NIP</th><th>Nama</th><th>Sesi</th><th>Jam</th><th>Status</th><th>Keterangan</th></tr></thead>
        <tbody><tr><td colspan="8" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr></tbody>
      </table>
    </div>
  `;

  // Langsung tampilkan laporan hari ini tanpa menunggu klik.
  muatRekap();

  if (!AppState.dataStafCache.length) {
    getAllData('DataStaf')
    .then(res => {
        if (res && res.success) {
          AppState.dataStafCache = res.data || [];
          const sel = document.getElementById('rekapNIP');
          if (sel) sel.innerHTML = '<option value="">Semua Staf</option>' + AppState.dataStafCache.map(s => `<option value="${s.NIP}">${s.Nama}</option>`).join('');
        }
      })
    .catch(x => { showToast('Peringatan', 'Gagal memuat daftar staf untuk filter.', 'warning'); });
  }
}

function muatRekap() {
  const awal = document.getElementById('rekapAwal').value, akhir = document.getElementById('rekapAkhir').value, nip = document.getElementById('rekapNIP').value;
  const tbody = document.querySelector('#tabelRekap tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
  getRekapLaporan('custom', awal, akhir, nip)
    .then(res => {
      if (!res || !res.success) { tbody.innerHTML = `<tr><td colspan="8" class="text-center small text-danger py-3">Gagal memuat rekap: ${res ? res.message : 'Respons kosong dari server.'}</td></tr>`; return; }
      AppState.rekapCache = res.data || [];
      if (!res.data.length) { tbody.innerHTML = '<tr><td colspan="8" class="text-center small text-muted-simtu py-3">Tidak ada data pada rentang ini.</td></tr>'; return; }
      tbody.innerHTML = res.data.map(r => `<tr>
        <td><img src="${r.FotoURL}" class="thumb-foto" onclick="previewFoto('${r.FotoURL}','Laporan ${r.Nama} - Sesi ${r.Sesi}')"></td>
        <td>${r.Tanggal}</td><td>${r.NIP}</td><td>${r.Nama}</td><td>${r.Sesi}</td><td>${r.JamLapor}</td>
        <td><span class="status-pill ${r.Status === 'Tepat Waktu' ? 'status-success' : 'status-warning'}">${r.Status}</span></td>
        <td>${r.Keterangan}</td>
      </tr>`).join('');
    })
    .catch(err => { tbody.innerHTML = `<tr><td colspan="8" class="text-center small text-danger py-3">Gagal memuat rekap: ${err.message}</td></tr>`; });
}

function eksporPDF() {
  if (!AppState.rekapCache || !AppState.rekapCache.length) { showToast('Peringatan', 'Tampilkan data rekap terlebih dahulu.', 'warning'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text('Rekapitulasi Laporan Kinerja Staf TU', 14, 15);
  doc.setFontSize(10); doc.text(AppState.config.namaSekolah || '', 14, 22);
  doc.autoTable({
    startY: 28,
    head: [['Tanggal','NIP','Nama','Sesi','Jam','Status','Keterangan']],
    body: AppState.rekapCache.map(r => [r.Tanggal, r.NIP, r.Nama, r.Sesi, r.JamLapor, r.Status, r.Keterangan]),
    styles: { fontSize: 8 }, headStyles: { fillColor: [30, 64, 175] }
  });
  doc.save('Rekap_Laporan_SIMTU.pdf');
}

function eksporExcel() {
  if (!AppState.rekapCache || !AppState.rekapCache.length) { showToast('Peringatan', 'Tampilkan data rekap terlebih dahulu.', 'warning'); return; }
  const ws = XLSX.utils.json_to_sheet(AppState.rekapCache);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Laporan');
  XLSX.writeFile(wb, 'Rekap_Laporan_SIMTU.xlsx');
}

// ── Pengaturan ──
function renderAdminPengaturan() {
  const el = document.getElementById('section-pengaturan');
  const c = AppState.config;
  el.innerHTML = `
    <div class="row g-3">
      <div class="col-lg-6">
        <div class="kpi-card">
          <strong><i class="bi bi-building"></i> Profil & Identitas Sekolah</strong>
          <div class="mt-2"><label class="form-label small">Nama Sekolah</label><input class="form-control" id="cfgNamaSekolah" value="${c.namaSekolah||''}"></div>
          <div class="mt-2"><label class="form-label small">URL Logo</label><input class="form-control" id="cfgLogoUrl" value="${c.logoUrl||''}"></div>
        </div>
        <div class="kpi-card mt-3">
          <strong><i class="bi bi-geo"></i> Geofencing & GPS Presensi</strong>
          <div class="row g-2 mt-1">
            <div class="col-6"><label class="form-label small">Latitude</label><input class="form-control" id="cfgLat" value="${c.latSekolah||''}"></div>
            <div class="col-6"><label class="form-label small">Longitude</label><input class="form-control" id="cfgLong" value="${c.longSekolah||''}"></div>
          </div>
          <div class="mt-2"><label class="form-label small">Radius Toleransi (meter)</label><input type="number" class="form-control" id="cfgRadius" value="${c.radiusGPS||35}"></div>
          <button class="btn btn-sm btn-outline-secondary mt-2" onclick="ambilLokasiPerangkatUntukPengaturan()"><i class="bi bi-crosshair"></i> Ambil Lokasi Perangkat Saat Ini</button>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="kpi-card">
          <strong><i class="bi bi-clock-history"></i> Jadwal Sesi Laporan Harian</strong>
          ${[1,2,3].map(n => `
            <div class="row g-2 mt-1 align-items-center">
              <div class="col-5 small">Sesi ${n}</div>
              <div class="col-3"><input type="time" class="form-control form-control-sm" id="cfgSesi${n}Mulai" value="${c['sesi'+n+'Mulai']||''}"></div>
              <div class="col-3"><input type="time" class="form-control form-control-sm" id="cfgSesi${n}Selesai" value="${c['sesi'+n+'Selesai']||''}"></div>
            </div>`).join('')}
          <div class="small text-muted-simtu mt-2"><i class="bi bi-info-circle"></i> Hari Jumat otomatis menggunakan Sesi 1 &amp; 2 saja.</div>
        </div>
      </div>
    </div>
    <button class="btn btn-primary mt-3" id="btnSimpanPengaturan" onclick="simpanPengaturan()"><i class="bi bi-save"></i> Simpan Semua Perubahan</button>
  `;
}

function ambilLokasiPerangkatUntukPengaturan() {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('cfgLat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('cfgLong').value = pos.coords.longitude.toFixed(6);
    showToast('Berhasil', 'Lokasi perangkat berhasil diambil.', 'success');
  }, () => showToast('Gagal', 'Tidak bisa mengambil lokasi perangkat.', 'danger'));
}

function simpanPengaturan() {
  const btn = document.getElementById('btnSimpanPengaturan');
  setBtnLoading(btn, 'Menyimpan...');
  const payload = {
    namaSekolah: document.getElementById('cfgNamaSekolah').value,
    logoUrl: document.getElementById('cfgLogoUrl').value,
    latSekolah: document.getElementById('cfgLat').value,
    longSekolah: document.getElementById('cfgLong').value,
    radiusGPS: document.getElementById('cfgRadius').value,
    sesi1Mulai: document.getElementById('cfgSesi1Mulai').value, sesi1Selesai: document.getElementById('cfgSesi1Selesai').value,
    sesi2Mulai: document.getElementById('cfgSesi2Mulai').value, sesi2Selesai: document.getElementById('cfgSesi2Selesai').value,
    sesi3Mulai: document.getElementById('cfgSesi3Mulai').value, sesi3Selesai: document.getElementById('cfgSesi3Selesai').value
  };
  setConfigBatch(payload)
    .then(res => {
      resetBtn(btn, '<i class="bi bi-save"></i> Simpan Semua Perubahan');
      showToast(res.success ? 'Tersimpan' : 'Gagal', res.message, res.success ? 'success' : 'danger');
      if (res.success) Object.assign(AppState.config, payload);
    })
    .catch(err => { resetBtn(btn, '<i class="bi bi-save"></i> Simpan Semua Perubahan'); showToast('Error', err.message, 'danger'); });
}
