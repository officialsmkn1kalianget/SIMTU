// ============================================================
// API LAYER — pengganti google.script.run, memakai fetch() murni
// ke backend GAS REST API. Setiap fungsi di sini punya nama &
// signature PERSIS sama seperti fungsi backend sebelumnya, supaya
// app.js tinggal pakai .then()/.catch() alih-alih withSuccessHandler.
// ============================================================

async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  try {
    const res = await fetch(`${GAS_URL}?${qs}`);
    return await res.json();
  } catch (err) {
    return Promise.reject(err);
  }
}

async function apiPost(action, data = {}) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // WAJIB text/plain — Content-Type: application/json memicu CORS
      // preflight (OPTIONS) yang tidak didukung GAS Web App.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data })
    });
    return await res.json();
  } catch (err) {
    return Promise.reject(err);
  }
}

// ── Autentikasi ──
function loginStaf(nip) { return apiPost('loginStaf', { nip }); }
function loginAdmin(username, password) { return apiPost('loginAdmin', { username, password }); }

// ── Geofence ──
function cekRadiusGPS(lat, lng) { return apiGet('cekRadiusGPS', { lat, lng }); }

// ── Laporan Pekerjaan ──
function kirimLaporanPekerjaan(payload) { return apiPost('kirimLaporanPekerjaan', payload); }
function getRiwayatLaporanHariIni(nip) { return apiGet('getRiwayatLaporanHariIni', { nip }); }

// ── Laporan Izin ──
function kirimLaporanIzin(payload) { return apiPost('kirimLaporanIzin', payload); }
function getAllLaporanIzin() { return apiGet('getAllLaporanIzin'); }
function validasiIzin(id, status, validator) { return apiPost('validasiIzin', { id, status, validator }); }

// ── CRUD generik ──
function getAllData(sheetName) { return apiGet('getAllData', { sheetName }); }
function addRecord(sheetName, record) { return apiPost('addRecord', { sheetName, record }); }
function updateRecord(sheetName, record) { return apiPost('updateRecord', { sheetName, record }); }
function deleteRecord(sheetName, id) { return apiPost('deleteRecord', { sheetName, id }); }
function importStafBatch(records) { return apiPost('importStafBatch', { records }); }

// ── Konfigurasi ──
function getAllConfig() { return apiGet('getAllConfig'); }
function setConfigBatch(configObj) { return apiPost('setConfigBatch', configObj); }

// ── Dashboard & Rekap ──
function getDashboardData() { return apiGet('getDashboardData'); }
function getRekapLaporan(periode, awal, akhir, nip) { return apiGet('getRekapLaporan', { periode: periode || '', awal: awal || '', akhir: akhir || '', nip: nip || '' }); }

// ── Bootstrap (gas-instant-ux): satu panggilan ambil semua data awal ──
function getBootstrapAdmin() { return apiGet('getBootstrapAdmin'); }
function getBootstrapStaf(nip) { return apiGet('getBootstrapStaf', { nip }); }
