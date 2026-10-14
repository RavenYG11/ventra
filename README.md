# Ventra

Aplikasi **stock barang sederhana** — web, 100% offline, data lokal di browser.
Dibangun oleh tim Virtual Office untuk Rama.

**Status (14 Okt 2026):** Spesifikasi MVP v1 **FINAL** (27 keputusan terkunci, tidak ada
pertanyaan terbuka). Build kode **v0.1 SELESAI** — edisi **WEB MURNI** (pivot dari Tauri
atas keputusan Rama 14 Okt 2026: tanpa install Rust, tanpa `.exe`): React + Vite +
SQLite-WASM, database + migrasi, login satu akun, master barang + kategori CRUD
(kode otomatis), layar login / daftar barang / kelola kategori ala Template B.

**Update 14 Okt 2026 (assignment #26):** fitur **Kode Barang** — entitas `kode_barang`
tersendiri + mapping M:N kategori↔kode barang (keputusan Rama Q2) + menu baru
**Product Management** (keputusan Rama Q1). Migrasi `003_kode_barang` berjalan otomatis
(backfill dari prefix kategori lama). Mockup: `docs/mockup-product-management.html`.

## Tech stack

- **TypeScript + React (Vite)** — aplikasi web murni, hasil build = file statis (`dist/`)
- **SQLite via WebAssembly** (`@sqlite.org/sqlite-wasm`) — database lokal di browser,
  persisten di **OPFS** (Origin-Private FileSystem), tanpa server
- Barcode: generate Code128 per item (**jsbarcode**, tampil di UI) + scan via kamera laptop (**@zxing/browser**)
- Export laporan: Excel (**SheetJS**) & PDF (**jsPDF**)
- Backup manual: tombol **"Unduh Backup"** → file `.db` tersimpan di folder Download
  (pengganti backup otomatis saat aplikasi ditutup — browser memblokir download saat tab ditutup)

## Fitur MVP (F1–F10)

Master barang (kode/SKU unik) → catat stok masuk → catat stok keluar
(**sistem menolak stok negatif**) → kartu stok / riwayat mutasi (audit trail
append-only) → dashboard + indikator stok menipis → laporan Excel/PDF →
stok opname → login satu akun → fondasi non-fungsional.

Detail lengkap: [`docs/stock-barang-mvp-v1.md`](docs/stock-barang-mvp-v1.md)

## Dokumen

| File | Isi |
|------|-----|
| `docs/stock-barang-mvp-v1.md` | Spesifikasi MVP final — 27 keputusan terkunci (+ revisi pivot web), fitur, acceptance criteria |
| `docs/tech-stack.md` | Rincian tech stack edisi web + alasan tiap pilihan (Sentot) |
| `docs/model-data.md` | Model data: tabel, SQL, validasi, contoh & kasus batas (Broto) |
| `docs/pendekatan-teknis-gunet.md` | Pendekatan teknis & rencana build v0.1 → v1.0 (Gunet) |
| `docs/desain-template-b.md` | Token desain Template B untuk implementasi (Prapto) |
| `docs/mvp-ventra.md` | Snapshot spesifikasi awal |
| `docs/PROGRESS.md` | Log progres build per tanggal |

## Struktur

```
src/            # React + TypeScript (UI, domain, lib)
  lib/
    db.ts       # SATU-SATUNYA tempat query SQLite — proxy main thread ke worker
    db-worker.ts# Engine SQLite di Web Worker (WASM + OPFS opfs-sahpool).
                # ATURAN: installOpfsSAHPoolVfs HANYA boleh di worker
                # (createSyncAccessHandle tidak ada di main thread).
    backup.ts   # Unduh backup database (.db)
migrasi/        # File migrasi SQL SQLite (skema TIDAK berubah dari edisi Tauri)
docs/           # Spesifikasi & keputusan terkunci
```

## Cara menjalankan (development)

**Kebutuhan:** Node.js 18+ (tidak perlu Rust, tidak perlu XAMPP untuk dev).

1. `git clone https://github.com/RavenYG11/ventra && cd ventra`
2. `npm install`
3. `npm run dev` — aplikasi jalan di browser (biasanya http://localhost:5173)

## Cara menjalankan versi produksi (di laptop Rama)

Aplikasi ini berupa file web statis yang diserve Apache XAMPP — **tanpa install apa pun** di laptop Rama selain XAMPP yang sudah umum dipakai.

**Kebutuhan:** XAMPP (Apache) + browser modern (Chrome/Edge terbaru).

1. Di mesin build: `npm run build` → hasil di folder `dist/`
2. Salin **isi** folder `dist/` ke `C:\xampp\htdocs\ventra\`
   (sehingga `C:\xampp\htdocs\ventra\index.html` ada)
3. Buka **XAMPP Control Panel** → **Start** Apache
4. Buka browser: **http://localhost/ventra**
5. **Setup pertama:** buat username + password → selesai. (Tidak ada kode pemulihan —
   reset password via username-check → unrestricted.)

**Catatan data:** database tersimpan di **OPFS browser** (penyimpanan privat per origin
`http://localhost`), bukan file yang terlihat di Explorer. Tetap 100% lokal & offline —
tidak ada data yang keluar dari laptop. Jangan buka Ventra di dua tab bersamaan
(satu file database = satu koneksi). Backup rutin via tombol **"Unduh Backup"**.

**Catatan kamera:** scan barcode memakai kamera laptop — browser meminta izin sekali.
Jalan di `http://localhost` (dianggap secure context oleh browser).

## Troubleshooting database (worker/WASM)

Database Ventra berjalan di **Web Worker** (`src/lib/db-worker.ts`) memakai
`@sqlite.org/sqlite-wasm` + VFS `opfs-sahpool` (data di OPFS browser).
Aturan arsitektur: `installOpfsSAHPoolVfs` **hanya boleh dipanggil di dalam worker**
(`createSyncAccessHandle` tidak tersedia di main thread Chrome) — jangan pindahkan
kembali ke `db.ts`. File `db.ts` hanyalah proxy via `postMessage`.

**Kode error (diawali `VDB-` atau `[FASE]`):**

| Kode | Arti | Tindakan |
|------|------|----------|
| `VDB-W01` | Worker crash saat load modul (import/bundling gagal). Detail: pesan, file, baris, kolom | Klik **Salin detail teknis**, kirim ke tim |
| `VDB-W02` | Error runtime tak tertangkap di dalam worker | Klik **Salin detail teknis**, kirim ke tim |
| `VDB-W03` | Inisialisasi melebihi 15 detik (timeout) | Muat ulang; bila tetap, tutup semua tab Ventra |
| `[IMPORT_FAILED]` | Satu/lebih modul worker gagal dimuat via dynamic import — kini menampilkan nama modul + pesan asli (bukan crash bisu) | Lihat detail teknis, kirim ke tim |
| `[WASM_LOAD_FAILED]` | `sqlite3.wasm` gagal dimuat (URL kosong/404) | `npm install` ulang; pastikan `dist/sqlite3.wasm` ada setelah build |
| `[OPFS_UNAVAILABLE]` | OPFS tidak bisa dibaca/ditulis (private mode, profil rusak, disk penuh) | Pakai window normal (bukan incognito); cek ruang disk |
| `[VFS_INSTALL_FAILED]` | Install VFS gagal | Lihat detail teknis |
| `[DB_OPEN_FAILED]` | File database terkunci (kemungkinan dua tab) | Tutup semua tab Ventra, buka satu tab baru |
| `[MIGRATION_FAILED]` | Migrasi skema gagal | Lihat detail teknis; jangan hapus data manual |

**Catatan:** warning console `Ignoring inability to install 'opfs'/'opfs-wl'
sqlite3_vfs` dan error bash Vite `sqlite3-opfs-async-proxy.js?vfs=...` berasal dari
auto-install dua VFS async bawaan sqlite-wasm yang tidak dipakai Ventra. Keduanya
sudah dinonaktifkan via query params `opfs-disable` & `opfs-wl-disable` pada URL
worker (`db.ts`, assignment #24) — dibaca `opfsUtil.initOptions()` di dalam worker.
Ventra hanya memakai VFS `opfs-sahpool`, yang tidak terpengaruh.

**Alur diagnosis bila layar menampilkan galat database:**

1. Klik **Salin detail teknis** → tempel ke laporan/chat.
2. Buka DevTools → tab **Console** → salin teks merah (`Uncaught ...`) bila ada.
3. Jangan buka Ventra di dua tab bersamaan (satu file database = satu koneksi).

## Verifikasi sebelum dinyatakan selesai

Kode v0.1 edisi web sudah ditulis dan direview, tapi **belum diverifikasi compile**
(tidak ada toolchain di mesin build) — wajib spike di laptop dev/Rama:

1. `npm install` (pastikan `@sqlite.org/sqlite-wasm` terunduh utuh)
2. `npm run build` (pastikan `tsc` lolos + `dist/` terbentuk, termasuk `sqlite3.wasm`)
3. Copy `dist/` → `C:\xampp\htdocs\ventra`, start Apache, buka http://localhost/ventra
4. Uji: setup akun → login → Product Management (tambah kode barang, hubungkan mapping) →
   tambah barang (pilih kategori → kode barang → kode auto-generate + preview) →
   muat ulang halaman (data tetap ada = OPFS jalan) → **Unduh Backup** (file .db terunduh)

## Keputusan terkunci (ringkas)

Satu akun + login (tanpa peran) · satuan pcs · tanpa multi-gudang ·
offline lokal (web, tanpa server) · barcode per item (display-only, tanpa printer) ·
scan via kamera · stok tidak boleh negatif · harga beli & jual manual, margin & nilai
stok otomatis (nilai stok = stok × harga beli) · laporan Excel & PDF ·
indikator visual stok menipis · reset password tanpa password lama ·
backup manual via tombol "Unduh Backup" (file .db) · internal only, tanpa integrasi.
