# Pendekatan Teknis + Rencana Build — Ventra (Aplikasi Stock Barang Web Offline)

**Disusun oleh:** Gunet (Software Engineer)
**Tanggal:** 2026-10-14
**Revisi:** 2026-10-14 (Assignment #10) — disesuaikan dengan 6 jawaban final Rama;
**2026-10-14 (Assignment #18) — PIVOT WEB: Tauri/desktop DIBATALKAN** (keputusan Rama:
tanpa install Rust). Aplikasi menjadi web murni: React + Vite + SQLite-WASM
(`@sqlite.org/sqlite-wasm`, persistensi OPFS), diserve XAMPP (`http://localhost/ventra`).
**Status:** Draf rencana — 6 keputusan build terkunci (lihat bagian 1, poin 5); masih menunggu konvergensi tech stack Sentot (Meeting #2) untuk keputusan bahasa/framework & library
**Dokumen terkait:** Meeting #1 (spesifikasi MVP & 18 jawaban final Rama), Meeting #2 (konvergensi tech stack — sedang berjalan)

---

## 1. Sumber Keputusan Terkunci

Pendekatan ini dibangun di atas keputusan yang sudah dikunci, BUKAN asumsi:

1. **Meeting #1** — master barang + kode unik/SKU, catat stok masuk/keluar, lihat sisa stok, riwayat & laporan; target offline di laptop Rama, desktop-first, satu akun pengguna. (Sumber: data meeting #1, status completed, 2026-10-14)
2. **18 jawaban final Rama** — satu akun + login, satuan pcs saja, tanpa multi-gudang, barcode per item + scan, tolak stok negatif, harga beli & jual input manual, laporan Excel & PDF, indikator visual stok menipis, reset password tanpa password lama. (Sumber: assignment Broto/Testarossa/Kurniatot, 2026-10-14)
3. **Model data (Broto, sedang dikerjakan)** — tabel barang, transaksi stok (masuk/keluar/penyesuaian), user, pengaturan; harga beli/jual manual dengan margin & nilai stok auto-calculate; audit trail (siapa/kapan/jenis/jumlah/stok sebelum-sesudah).
4. **Tech stack (Sentot, sedang dikerjakan, Meeting #2)** — 10 poin konvergensi: bahasa/framework, database lokal, pendekatan desktop offline, library barcode, scan, export Excel, export PDF, packaging, backup, struktur modul.
5. **6 jawaban final Rama (Assignment Gunet #10, 2026-10-14)** — keputusan build yang mengunci scope teknis:
   - **Tanpa alur cetak/print barcode** — barcode hanya di-generate & ditampilkan di UI.
   - **Scan barcode HANYA via kamera laptop** — pendekatan USB keyboard-wedge dihapus.
   - **Backup MANUAL via tombol "Unduh Backup"** (file `.db`) — revisi pivot #18: mekanisme lama "otomatis saat aplikasi ditutup" DIBATALKAN karena browser memblokir download saat tab ditutup; tanpa flashdisk/cloud.
   - **Target: Windows 10/11 64-bit + browser modern (Chrome/Edge)** — tanpa `.exe`/installer.
   - **Asumsi volume: < 10.000 SKU.**
   - **Struktur build tetap sederhana.**
   - **PIVOT WEB (Assignment #18):** Tauri/desktop DIBATALKAN — tanpa Rust; web murni diserve XAMPP.

> **Catatan:** rekomendasi final Sentot sudah selesai (tech-stack.md, Meeting #2): **Tauri 2 + TypeScript + React (Vite) + SQLite** — kemudian **direvisi via PIVOT WEB (assignment #18, keputusan Rama): Tauri DIBATALKAN**, diganti web murni (TypeScript + React + SQLite-WASM + OPFS, diserve XAMPP). Semua penanda tertunda di bawah sudah diselesaikan.

---

## 2. Prinsip Arsitektur (Selaras dengan Rekomendasi Sentot)

1. **Satu keputusan per poin.** Tidak ada dua opsi yang tetap terbuka — setiap bagian modul punya satu pemilik dan satu tanggung jawab.
2. **Modular per domain.** Kode dipecah berdasarkan domain bisnis (barang, transaksi, laporan, pengguna), bukan berdasarkan lapisan teknologi saja. Alasannya: perubahan bisnis (mis. aturan validasi stok) tidak menyebar ke seluruh codebase.
3. **Lapisan tipis dan tegas.** Alur data selalu satu arah: `UI → Service (logika bisnis) → Repository (akses data) → Database`. UI tidak pernah bicara langsung ke database.
4. **File kecil dan mudah dipahami.** Satu file maksimal ~300–500 baris. Jika mendekati batas, pecah. Tidak ada satu file >1000 baris.
5. **Database lokal tunggal.** Satu akun, satu database file lokal — tidak ada server, tidak ada sinkronisasi jaringan. Ini menyederhanakan arsitektur secara drastis (tidak perlu API server, auth token, retry network).
6. **Stok tidak pernah dihitung ulang dari riwayat.** Kolom `stok_saat_ini` disimpan di tabel barang dan diupdate di dalam satu transaksi database bersamaan dengan pencatatan transaksi. Jika transaksi dibatalkan, keduanya batal bersamaan — data tidak pernah setengah jalan.

---

## 3. Struktur Kode Modular per Domain

```
ventra/
├── src/
│   ├── main.tsx                     # Entry point aplikasi web (React)
│   │
│   ├── lib/                         # Pondasi — dipakai semua domain
│   │   ├── db.ts                    # SATU-SATUNYA tempat query SQLite
│   │   │                            #   (via @sqlite.org/sqlite-wasm + OPFS, VFS opfs-sahpool)
│   │   ├── backup.ts                # Tombol "Unduh Backup" → file .db ke folder Download
│   │   │                            #   (pengganti backup otomatis saat aplikasi ditutup —
│   │   │                            #   tidak mungkin di browser; keputusan pivot #18)
│   │   ├── kesalahan.ts             # Tipe error aplikasi (mis. StokTidakCukup, DataTidakValid)
│   │   └── konstanta.ts             # Nilai tetap: satuan "pcs", nama aplikasi, versi
│   │
│   ├── domain/                      # ← Inti aplikasi: satu folder per domain bisnis
│   │   │
│   │   ├── barang/                  # Domain: data master barang
│   │   │   ├── skema-barang.js      # Definisi struktur data barang (kode/SKU unik, nama, barcode,
│   │   │   │                        #   harga_beli, harga_jual, stok_awal, stok_saat_ini, stok_minimum)
│   │   │   ├── repo-barang.js       # Baca/tulis tabel barang (hanya SQL/query, tanpa logika bisnis)
│   │   │   ├── service-barang.js    # Logika: tambah/ubah barang, validasi SKU unik, hitung margin
│   │   │   └── barcode-barang.js    # Generate barcode Code128 per item (jsbarcode), ditampilkan di UI saja
│   │   │                            #   (TANPA alur cetak/print — keputusan final Rama).
│   │   │
│   │   ├── transaksi/               # Domain: stok masuk, keluar, penyesuaian
│   │   │   ├── skema-transaksi.js   # Struktur: jenis (masuk/keluar/sesuai), jumlah, stok sebelum/sesudah,
│   │   │   │                        #   waktu, catatan
│   │   │   ├── repo-transaksi.js    # Baca/tulis tabel transaksi_stok
│   │   │   ├── service-transaksi.js # Logika KUNCI: tolak stok negatif, update stok_saat_ini + catat
│   │   │   │                        #   transaksi dalam satu paket atomik, tulis audit trail
│   │   │   └── validasi-stok.js     # Aturan: jumlah > 0, stok keluar ≤ stok tersedia, dsb.
│   │   │
│   │   ├── laporan/                 # Domain: laporan & export
│   │   │   ├── service-laporan.js   # Susun data laporan: sisa stok, riwayat, nilai stok (auto-calc)
│   │   │   ├── export-excel.js      # Export ke Excel (SheetJS xlsx)
│   │   │   ├── export-pdf.js        # Export laporan ke PDF (jsPDF + autotable)
│   │   │   └── indikator-stok.js    # Logika indikator visual stok menipis (stok_saat_ini ≤ stok_minimum)
│   │   │
│   │   ├── pengguna/                # Domain: satu akun + login + keamanan
│   │   │   ├── skema-pengguna.js    # Struktur: username, hash password, info reset
│   │   │   ├── repo-pengguna.js     # Baca/tulis tabel user & pengaturan
│   │   │   ├── service-login.js      # Verifikasi login (bandingkan hash) [MENUNGGU CIPHER: skema hash]
│   │   │   └── service-reset.js      # Reset password tanpa password lama (FINAL 14 Okt 2026: username → cek akun → unrestricted)
│   │   │
│   │   └── audit/                   # Domain: jejak audit
│   │       ├── skema-audit.js       # Struktur: siapa, kapan, aksi, detail (stok sebelum/sesudah)
│   │       ├── repo-audit.js        # Tulis/baca tabel audit
│   │       └── service-audit.js     # API pencatatan: dipanggil service lain, bukan UI langsung
│   │
│   ├── ui/                          # Tampilan — hanya memanggil service-*, tidak ada logika bisnis
│   │   ├── layar-login/             # Halaman login (satu akun)
│   │   ├── layar-dashboard/         # Ringkasan stok + indikator stok menipis
│   │   ├── layar-barang/            # Daftar/tambah/ubah barang + tampil barcode di UI (tanpa cetak)
│   │   ├── layar-transaksi/         # Form stok masuk/keluar + scan barcode via kamera laptop
│   │   ├── layar-laporan/           # Riwayat, laporan, tombol export Excel/PDF
│   │   └── komponen/                # Komponen dipakai ulang: tabel, tombol, dialog, badge stok
│   │
│   └── infrastruktur/               # (Dihapus di implementasi — digabung ke lib/)
│
├── migrasi/                         # File SQL per versi: 001_awal.sql, 002_audit_keamanan.sql, ...
├── tests/                           # Test per domain, mirror struktur src/features/
│   ├── transaksi/service-transaksi.test.ts
│   └── barang/service-barang.test.ts
├── docs/
│   ├── PROGRESS.md                   # Dokumentasi progress (lihat bagian 7)
│   └── KEPUTUSAN.md                  # Log keputusan terkunci (rujukan ke Kurniatot)
└── package.json (React + Vite + @sqlite.org/sqlite-wasm — TANPA Tauri/Rust sejak pivot #18)
```

> **Catatan implementasi (build #17 + pivot #18):** struktur aktual memakai
> `src/features/<domain>/{repo,service}-*.ts`, `src/pages/*.tsx`, `src/lib/`,
> `src/components/`, `src/types/` — pemetaan 1:1 dari `domain/`, `ui/`, `core/`
> pada pohon rencana di atas. Aturan import di bawah tetap berlaku dengan
> pemetaan: `ui/*` → `pages/*` + `components/*`; `core/*` → `lib/*`.

### Aturan import (agar tidak kusut di kemudian hari)

| Boleh | Tidak boleh |
|---|---|
| `ui/*` import dari `domain/*/service-*` | `ui/*` import langsung dari `repo-*` atau `database.js` |
| `service-*` import dari `repo-*` dan `core/*` | `service-*` import dari `ui/*` |
| `repo-*` import dari `core/*` | `repo-*` berisi logika bisnis (validasi, hitung margin) |
| `domain/audit/service-audit.js` dipanggil service domain lain | UI memanggil `service-audit.js` langsung |

### Contoh alur data end-to-end: "Catat stok keluar 5 pcs"

```
UI (layar-transaksi)
  └─> panggil service-transaksi.catatKeluar(kodeBarang, 5)
        ├─> validasi-stok: jumlah > 0? stok tersedia ≥ 5? (tolak jika tidak → error StokTidakCukup)
        ├─> transaksi-db (SATU paket atomik):
        │     ├─> repo-barang: stok_saat_ini = stok_saat_ini − 5
        │     ├─> repo-transaksi: catat (keluar, 5, stok_sebelum, stok_sesudah, waktu)
        │     └─> repo-audit: catat (siapa, kapan, "stok_keluar", detail)
        └─> kembalikan hasil ke UI → tampilkan sisa stok terbaru
```

Jika langkah mana pun gagal, seluruh paket dibatalkan — stok tidak berkurang tanpa catatan, dan sebaliknya.

---

## 4. Aturan Penamaan & Gaya Kode (mudah dipelajari junior)

- **Bahasa Indonesia untuk nama domain:** `service-barang.js`, `catatStokMasuk()`, `stokMinimum`. Kode dibaca seperti bahasa sehari-hari.
- **Bahasa Inggris hanya untuk istilah teknis baku:** `database`, `repository`, `export`, `hash` — karena library dan dokumentasi resmi memakai istilah itu.
- **Satu fungsi = satu pekerjaan.** Nama fungsi diawali kata kerja: `tambahBarang()`, `hitungMargin()`, `validasiJumlah()`.
- **Tidak ada "angka ajaib".** Nilai seperti batas stok minimum selalu dari database/pengaturan, bukan angka yang ditulis langsung di kode.
- **Setiap service punya komentar 1–3 baris** menjelaskan "fungsi ini dipakai di layar apa".

---

## 5. Tahapan Build v0.1 → v1.0

Definisi versi mengacu pada Kurniatot (spesifikasi MVP final, sedang dikerjakan). Tahapan di bawah disusun agar **setiap versi bisa dipakai**, bukan setengah jadi.

### v0.1 — Fondasi bisa jalan (target: aplikasi terbuka, login, data tersimpan)

| # | Pekerjaan | Kriteria selesai | Ketergantungan |
|---|---|---|---|
| 1 | Setup proyek + entry point web | Aplikasi terbuka di browser via `npm run dev` | React + Vite; target: browser modern (Chrome/Edge) di Windows 10/11 64-bit |
| 2 | `lib/db.ts` + migrasi awal | Database OPFS terbentuk otomatis saat pertama dibuka | Model data Broto; `@sqlite.org/sqlite-wasm` (VFS opfs-sahpool) |
| 3 | Domain `pengguna`: login satu akun | Bisa login dengan password; password tersimpan sebagai hash, bukan teks biasa | Skema hash Cipher |
| 4 | Domain `barang`: CRUD master barang | Tambah/ubah/hapus barang; kode/SKU unik divalidasi; harga beli & jual manual | Model data Broto |
| 5 | Layar login + layar daftar barang | Dua layar bisa dibuka dan berfungsi | Mockup Prapto (referensi visual) |

**Definisi selesai v0.1:** Rama bisa buka `http://localhost/ventra`, login, dan mengelola daftar barang. Belum ada transaksi stok.

### v0.2 — Transaksi stok inti

| # | Pekerjaan | Kriteria selesai | Ketergantungan |
|---|---|---|---|
| 1 | Domain `transaksi`: catat masuk/keluar | Stok masuk & keluar tercatat; `stok_saat_ini` terupdate atomik | — |
| 2 | `validasi-stok.js`: tolak stok negatif | Stok keluar melebihi stok tersedia DITOLAK dengan pesan jelas | Acceptance criteria Testarossa |
| 3 | Domain `audit`: pencatatan otomatis | Setiap transaksi menulis audit (siapa/kapan/jenis/jumlah/sebelum/sesudah) | Kebijakan audit Cipher |
| 4 | Layar transaksi + scan barcode via kamera laptop | Form masuk/keluar berfungsi; scan via kamera laptop mengisi kode barang | Library scan kamera (Sentot/Magna) |
| 5 | Dashboard: sisa stok + indikator menipis | Barang dengan stok ≤ stok minimum tampil dengan indikator visual | — |

**Definisi selesai v0.2:** alur harian gudang bisa jalan penuh (masuk → keluar → pantau sisa).

### v0.3 — Barcode, laporan, export

| # | Pekerjaan | Kriteria selesai | Ketergantungan |
|---|---|---|---|
| 1 | `barcode-barang.js`: generate Code128 | Barcode setiap barang di-generate & ditampilkan di UI (tanpa alur cetak — keputusan final Rama) | jsbarcode |
| 2 | Scan barcode via kamera laptop | Scan kamera mengisi otomatis kolom kode barang di form transaksi; input manual tetap tersedia sebagai cadangan | @zxing/browser |
| 3 | Domain `laporan`: riwayat + nilai stok | Laporan sisa stok, riwayat transaksi, nilai stok (harga_beli × stok) auto-calculate | — |
| 4 | `export-excel.js` & `export-pdf.js` | Laporan bisa diunduh sebagai .xlsx dan .pdf | SheetJS xlsx / jsPDF + autotable |
| 5 | Margin otomatis | Margin = harga_jual − harga_beli tampil otomatis per barang | — |

### v0.4 — Keamanan, backup, instalasi (siap dipakai harian)

| # | Pekerjaan | Kriteria selesai | Ketergantungan |
|---|---|---|---|
| 1 | Reset password tanpa password lama | Username → cek keberadaan akun → jika ada, field reset unrestricted (langsung set password baru). Event reset dicatat di audit log | **FINAL 14 Okt 2026** (Cipher — lihat stock-barang-mvp-v1.md §8) |
| 2 | Backup manual database lokal | Tombol "Unduh Backup" mengunduh file `.db`; tanpa flashdisk/cloud; restore teruji | **Gunet** (implementasi) + **Epthal** (runbook restore) |
| 3 | Deploy → XAMPP | `npm run build` → salin `dist/` ke `C:\xampp\htdocs\ventra` → Start Apache → `http://localhost/ventra` jalan di laptop Rama | Tanpa `.exe`/installer (pivot #18) |
| 4 | Runbook operasional | Dokumen: cara install, backup/restore, apa yang dilakukan saat data bermasalah | **Epthal** |

**Definisi selesai v0.4 = v1.0 (siap produksi):** deploy sekali ke XAMPP, Rama pakai harian offline via browser, data aman dengan backup manual rutin.

### Setelah v1.0 (backlog, bukan janji)

- Penyesuaian stok (stock opname) sebagai jenis transaksi resmi.
- Multi-satuan (selain pcs) — saat ini dikunci pcs saja.
- Riwayat harga beli (saat ini harga beli manual per barang, satu nilai).

---

## 6. Strategi Pengujian (sejalan dengan Testarossa)

1. **Test otomatis untuk logika kritis** (`tests/`): tolak stok negatif, keunikan SKU, perhitungan margin & nilai stok, atomicity transaksi. Dijalankan sebelum setiap rilis versi.
2. **Test manual per layar** mengikuti acceptance criteria Testarossa: kasus normal, kasus batas, kasus gagal.
3. **Aturan rilis:** tidak naik versi jika ada test kritis yang gagal. Bug diperbaiki di akar masalah (mis. validasi bocor → perbaiki `validasi-stok.js`, bukan tambal di UI).

---

## 7. Dokumentasi Progress (format baku setiap update)

File `docs/PROGRESS.md` diupdate setiap ada pekerjaan selesai. Format per entri:

```markdown
## [2026-10-14] v0.1 — #2 core/database.js + migrasi awal
- Selesai: koneksi SQLite lokal, migrasi 001_awal.sql jalan otomatis.
- Test: buka aplikasi → file database terbentuk; hapus file → terbentuk ulang.
- Kendala: tidak ada.
- Berikutnya: #3 domain pengguna (login).
```

Prinsip: **progres dinilai dari hasil yang terverifikasi** (bisa didemokan/ditest), bukan klaim "sudah 80%".

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tech stack belum konvergen (Sentot) | Struktur deploy & packaging tertunda | Struktur `features/` & `lib/` dikerjakan dulu — tidak bergantung stack |
| Database (OPFS) korup/rusak | Data hilang | Backup manual rutin via tombol "Unduh Backup" (biasakan tiap akhir hari kerja); tulis database selalu lewat transaksi atomik |
| Dua tab Ventra terbuka bersamaan | Tab kedua gagal buka database (satu file = satu koneksi) | Pesan galat jelas di UI; SOP: pakai satu tab saja |
| Kamera laptop tidak tersedia/rusak | Scan barcode tidak jalan | Scan HANYA via kamera laptop (keputusan final Rama — USB keyboard-wedge dihapus); input kode barang manual selalu tersedia sebagai cadangan di form transaksi |
| Volume SKU melampaui 10.000 | Query melambat, file DB membengkak | Asumsi terkunci < 10.000 SKU (keputusan final Rama); test beban ringan di v0.2 dengan 10.000 data dummy; evaluasi ulang index/skema bila asumsi berubah |
| Scope merayap (tambah fitur di tengah jalan) | v1.0 tidak selesai | Fitur baru masuk backlog pasca-v1.0; yang dikunci 18 jawaban Rama tidak diubah tanpa persetujuan Rama |

---

## 9. Keputusan Terkunci Baru & Pertanyaan Terbuka

**Terkunci (keputusan final Rama, Assignment Gunet #10, 2026-10-14):**

1. **Target OS: Windows 10/11 64-bit + browser modern (Chrome/Edge)** — tidak lagi pertanyaan terbuka; tanpa `.exe`/installer (pivot #18: web via XAMPP).
2. **Tanpa alur cetak/print barcode** — barcode di-generate & ditampilkan di UI saja. Pertanyaan "printer label tersedia atau tidak" dihapus.
3. **Scan barcode HANYA via kamera laptop** — USB keyboard-wedge dihapus dari rencana.
4. **Backup MANUAL via tombol "Unduh Backup" (file `.db`)** — tanpa flashdisk/cloud. Mekanisme lama "otomatis saat aplikasi ditutup" DIBATALKAN (pivot #18 — browser memblokir download saat tab ditutup). Detail runbook restore tetap dikerjakan Epthal.
5. **Asumsi volume < 10.000 SKU** — database OPFS tunggal cukup; tidak perlu server.
6. **Struktur build tetap sederhana** — tidak ada modul/fitur di luar yang terkunci di dokumen ini tanpa persetujuan Rama.
7. **PIVOT WEB (Assignment #18):** Tauri/desktop DIBATALKAN — tanpa Rust, tanpa `.exe`; web murni diserve XAMPP (`http://localhost/ventra`); SQLite via WASM + OPFS (VFS opfs-sahpool).

**Masih terbuka:**

7. Skema hash password & mekanisme reset — **FINAL 14 Okt 2026** (username → cek keberadaan akun → unrestricted; lihat stock-barang-mvp-v1.md §8).
8. Detail implementasi backup (format file, lokasi folder, runbook restore) — **menunggu Epthal**, di dalam batas keputusan #4 di atas.

---

## 10. Sumber

1. Data `listoffice` virtual-office, 2026-10-14: Meeting #1 (completed) — spesifikasi MVP stock barang; Meeting #2 (gathering) — 10 poin konvergensi tech stack; 9 assignment aktif (Sentot, Prapto, Kurniatot, Cipher, Testarossa, Epthal, Gunet, Magna, Broto).
2. 18 jawaban final Rama — dirujuk dari assignment Kurniatot/Broto/Testarossa (satu akun, pcs, tanpa multi-gudang, barcode+scan, tolak stok negatif, harga manual, Excel/PDF, indikator menipis, reset tanpa password lama).
3. 6 jawaban final Rama (Assignment Gunet #10, 2026-10-14) — tanpa alur cetak barcode, scan hanya via kamera laptop, backup lokal otomatis saat aplikasi ditutup retensi 7 hari (tanpa flashdisk/cloud), target Windows 10/11 64-bit, asumsi < 10.000 SKU, struktur build sederhana.
3. Prinsip arsitektur modular per domain & aturan file kecil — standar praktik rekayasa perangkat lunak (pemisahan domain/lapisan, single responsibility).
4. Perbandingan Tauri/Electron/SQLite/library barcode & export — **menunggu hasil riset Magna + konvergensi Sentot**; tidak diklaim di dokumen ini.

---

*Dokumen ini adalah rencana kerja Gunet sebagai Software Engineer. Implementasi kode dimulai setelah tech stack konvergen (Sentot) dan model data final (Broto).*
