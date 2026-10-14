# Progress Build — Ventra v0.1

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
