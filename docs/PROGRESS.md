# Progress Build — Ventra v0.1

## [2026-10-14] v0.1 — PIVOT WEB: hapus Tauri, SQLite via WASM + OPFS (assignment #18)
- Selesai (keputusan Rama: tanpa install Rust — Tauri/desktop DIBATALKAN):
  - `src-tauri/` dihapus total dari repo (5 file: `src/main.rs`, `tauri.conf.json`,
    `Cargo.toml`, `build.rs`, `capabilities/default.json`).
  - `package.json`: dependensi `@tauri-apps/*` (api, plugin-sql, cli) dihapus;
    script `tauri` & `build:all` dihapus; tambah `@sqlite.org/sqlite-wasm`
    (pin eksak `3.53.4-build2`).
  - `src/lib/db.ts` ditulis ulang: SQLite sebagai WASM di browser, persisten di
    OPFS via VFS resmi `opfs-sahpool` (`installOpfsSAHPoolVfs()` →
    `poolUtil.OpfsSAHPoolDb('/stok.db')`); antarmuka `select<T>/execute` dengan
    placeholder `$1` dipertahankan (dinormalisasi ke `?1` di adapter) sehingga
    repo-*.ts TIDAK berubah; skema DB & migrasi 001+002 TIDAK berubah; file
    `sqlite3.wasm` diserve via `?url` + `locateFile` (pola bundler resmi).
  - Backup: mekanisme "otomatis saat aplikasi ditutup" DIGANTI tombol
    **"Unduh Backup"** (toolbar Daftar Barang) → `src/lib/backup.ts`:
    `poolUtil.exportFile()` → file `ventra-backup-YYYYMMDD-HHMMSS.db` ke folder
    Download. Alasan: browser memblokir download saat tab ditutup.
  - `vite.config.ts`: `base: './'` (bisa diserve dari subpath XAMPP
    `http://localhost/ventra`); header COOP/COEP di dev server (mengikuti demo
    resmi; tidak wajib untuk opfs-sahpool).
  - Nol sisa `@tauri-apps` di `src/` (hanya `src/lib/db.ts` yang memakai import
    itu; komentar lama di `repo-barang.ts` disesuaikan dengan koneksi tunggal
    main-thread). `@zxing/browser` & `bcryptjs` jalan native di browser.
  - `.gitignore`: seksi Tauri/Rust dihapus.
  - Docs ikut update (aturan realtime): README (cara jalan web + deploy XAMPP),
    `docs/tech-stack.md` (arsitektur web), `docs/stock-barang-mvp-v1.md`
    (backup manual, tanpa `.exe`), `docs/pendekatan-teknis-gunet.md` (revisi
    pivot), `docs/PROGRESS.md` (entri ini).
- Test: review kode manual per file + verifikasi silang ke dokumentasi resmi
  sqlite-wasm (`sqlite.org/wasm/doc/trunk/persistence.md` — VFS opfs-sahpool:
  tanpa COOP/COEP, path absolut, `exportFile`; pola init demo resmi
  `github.com/sqlite/sqlite-wasm`).
  BELUM compile — tidak ada toolchain di VM ini.
- Kendala / catatan jujur:
  1. `npm install` + `npm run build` BELUM pernah jalan — wajib sebagai langkah
     spike di laptop dev/Rama: pastikan `sqlite3.wasm` ikut ter-bundle ke
     `dist/`, lalu deploy ke XAMPP dan uji di `http://localhost/ventra`
     (setup akun → tambah barang → reload = data persist → Unduh Backup).
  2. Pola `locateFile` + `?url` mengikuti kode sumber resmi paket
     (`dist/index.mjs` → `findWasmBinary()`), tapi belum teruji di build nyata.
  3. Jangan buka Ventra di dua tab bersamaan (satu file OPFS = satu koneksi) —
     tab kedua mendapat pesan galat yang jelas, bukan corrupt.
  4. Versi `@sqlite.org/sqlite-wasm` di-pin eksak (`3.53.4-build2`, Okt 2026).
- Berikutnya: spike install & uji jalan di laptop Rama → v0.2 (transaksi stok
  masuk/keluar + dashboard + tolak stok negatif; fitur restore backup).

## [2026-10-14] v0.1 — review & perbaikan Gunet (atomicity + kepatuhan spec)
- Selesai:
  - `tambahBarangAtomik` ditulis ulang: SATU statement SQL (CTE: UPDATE counter
    kategori → INSERT barang → INSERT transaksi "Stok awal") — atomik penuh.
    Alasan: BEGIN/COMMIT lewat beberapa execute() terpisah TIDAK aman di
    @tauri-apps/plugin-sql (tiap panggilan bisa mendarat di koneksi pool yang
    beda — keterbatasan resmi tauri-apps/plugins-workspace#886). Satu statement
    = satu koneksi = atomik menurut jaminan SQLite.
  - Audit keamanan (§8 spec, Cipher): migrasi `002_audit_keamanan.sql` (tabel
    `audit_keamanan` append-only) + pencatatan event `login` (berhasil/gagal)
    dan `password_reset` (berhasil). Catatan §8 tetap berlaku: log mencatat
    BAHWA reset terjadi, bukan SIAPA pelakunya.
  - Kepatuhan model-data.md: kolom `barcode` terpisah DIHAPUS dari migrasi 001
    (barcode = kode, satu identifier); seed prefix 'BRG' → 'BRG-' (cth.
    BRG-0000001); prefix kategori BOLEH diubah (kode lama tidak berubah);
    nonaktifkan kategori SELALU boleh walau masih punya barang (riwayat utuh).
    Aman: belum ada database yang pernah terbentuk dari migrasi ini.
  - `dibuat_oleh` transaksi "Stok awal" = username sesi (sebelumnya 'sistem').
  - src-tauri: `tauri-plugin-sql` + fitur `sqlite`; `build.rs`;
    `capabilities/default.json` (`sql:default` + `sql:allow-execute` — tanpa
    ini semua tulis ke DB ditolak); `bundle.icon` standar.
- Test: review kode manual per file + verifikasi silang ke model-data.md,
  stock-barang-mvp-v1.md §8, dan dokumentasi resmi plugin-sql v2
  (placeholder `$1`, `Database.load('sqlite:stok.db')`, capability).
  BELUM compile — tidak ada toolchain Node/Rust di VM ini.
- Kendala / catatan jujur:
  1. `npm install` + `npm run tauri dev` BELUM pernah jalan — wajib sebagai
     langkah spike di laptop dev/Rama sebelum v0.1 dinyatakan selesai.
     Verifikasi spesifik: (a) CTE atomik tambah-barang (DML di WITH +
     UPDATE...RETURNING) jalan di SQLite bundled plugin-sql; (b) migrasi
     001+002 teraplikasi berurutan; (c) audit_keamanan tercatat saat
     login/reset; (d) WebView2 di laptop Rama.
  2. Versi dependensi di package.json adalah pilihan saat scaffold; kunci
     versi final setelah `npm install` pertama (catat versi terpasang;
     verifikasi lisensi `xlsx` Apache-2.0 sebelum dipakai di v0.3).
  3. Ikon aplikasi (src-tauri/icons/*) belum ada — generate via
     `npm run tauri icon` sebelum packaging `Ventra-setup.exe`.
  4. nilai_stok = stok × harga_beli (keputusan FINAL Rama 14 Okt 2026).
- Berikutnya: spike install & uji jalan → v0.2 (transaksi stok masuk/keluar +
  dashboard + tolak stok negatif, pola CTE atomik yang sama).

## [2026-10-14] v0.1 — scaffold + database + login + master barang
- Selesai: scaffold Tauri 2 + React (Vite) + TypeScript; migrasi SQL 001_awal
  (kategori, barang, transaksi_stok, pengguna, pengaturan, view v_barang);
  `src/lib/db.ts` satu-satunya akses DB (plugin-sql) + runner migrasi;
  login satu akun (bcryptjs) + setup awal + lupa password (username-check →
  unrestricted reset, keputusan final Rama); kategori CRUD + validasi prefix;
  master barang CRUD + auto-generate kode atomik (prefix + 7 digit, cth.
  BRG-0000001) + catat "Stok awal"; layar login + daftar barang (cari, badge
  status, Template B); package.json (react, plugin-sql, jsbarcode,
  @zxing/browser, xlsx, jspdf, jspdf-autotable, bcryptjs).
- Test: BELUM — tidak ada toolchain Node/Rust di VM ini. Verifikasi yang
  dilakukan: review kode manual per file, konsistensi dengan model-data.md.
- Kendala / catatan jujur:
  1. `npm install` + `npm run tauri dev` BELUM pernah jalan — wajib sebagai
     langkah spike di laptop dev/Rama sebelum dinyatakan v0.1 selesai.
  2. Versi dependensi di package.json adalah pilihan saat scaffold; kunci
     versi final setelah `npm install` pertama (perintah: `npm install`,
     lalu catat versi terpasang; verifikasi lisensi `xlsx` Apache-2.0).
  3. Ikon aplikasi (src-tauri/icons/*) belum ada — wajib sebelum packaging
     `Ventra-setup.exe`.
  4. Audit log event password_reset BELUM diimplementasikan (menunggu tabel
     audit keamanan — ranah Cipher, v0.4).
  5. nilai_stok = stok × harga_beli (keputusan FINAL Rama 14 Okt 2026).
- Berikutnya: spike install & uji jalan → v0.2 (transaksi stok masuk/keluar +
  dashboard + tolak stok negatif).

## Format baku entri berikutnya
## [YYYY-MM-DD] vX.Y — judul pekerjaan
- Selesai: ...
- Test: ...
- Kendala: ...
- Berikutnya: ...
