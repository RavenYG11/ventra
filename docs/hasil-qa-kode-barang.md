# Hasil QA — Fitur "Kode Barang" (Ventra)

**Pelaksana:** Testarossa (QA Engineer)
**Tanggal:** 14 Okt 2026
**Assignment:** #30 (Virtual Office)
**Metode:** analisis statis kode + verifikasi baca-balik via API GitHub (`get_file_contents`, branch `main`).
Bukan uji browser — uji jalan tetap tugas Rama di laptopnya (`git pull` → `npm install` → `npm run dev`).
**Acuan:** `docs/qa-kode-barang.md` (test plan #29) + skenario 22–28 `docs/QA-CHECKLIST.md` + 4 keputusan final Rama.
**Kode yang diuji:** implementasi Gunet #28 (commit `7b33567`, `0ba48ad`, `f5c60a4`).

---

## 1. Ringkasan eksekutif

| Kategori | Jumlah |
|---|---|
| LOLOS (analisis statis) | 42 |
| GAGAL / temuan | 6 (1 sedang-tinggi, 1 sedang, 4 rendah) |
| Diskrepansi info (bukan bug) | 1 |
| Tidak dapat diuji (butuh browser / fitur belum ada) | 7 |

**Keputusan QA: BELUM LULUS exit criteria.** Kriteria #1 ("semua kasus prioritas Tinggi lolos")
tidak terpenuhi karena **Q4-01 (prioritas Tinggi) gagal** — badge "⚠ TANPA KODE" + banner
tidak diimplementasikan. Temuan **migrasi tidak atomik (MIG-07)** juga wajib diperbaiki
sebelum rilis ke Rama karena berisiko membuat aplikasi tidak bisa boot.

**Yang sudah bagus:** skema migrasi 003 benar (M:N tanpa UNIQUE constraint sesuai Q2,
backfill via JOIN bukan parsing string, urutan langkah tepat), penomoran atomik
(`UPDATE...RETURNING` satu statement — bug lama WITH..UPDATE sudah diperbaiki),
semua validasi service-level ada, tidak ada referensi kolom lama yang tertinggal,
menu "Product Management" + 3 sub-tab sesuai mockup, tidak ada regresi terdeteksi.

---

## 2. Hasil per suite

Legenda: ✅ Lolos · ❌ Gagal/temuan · ⚠️ Parsial/catatan · ⏸️ Tidak dapat diuji (butuh browser)

### TS-MIG — Migrasi 003 (`migrasi/003_kode_barang.sql`)

| ID | Hasil | Bukti / catatan |
|---|---|---|
| MIG-01 | ✅ | `jalankanMigrasi` (`src/lib/db-worker.ts`) mencatat versi ke tabel `migrasi`, lewati bila sudah ada — berjalan tepat sekali. |
| MIG-02 | ✅ | `INSERT INTO kode_barang ... SELECT prefix_kode, ... FROM kategori`; `prefix_kode` sudah UNIQUE di skema lama jadi tidak ada risiko duplikat `kode`. |
| MIG-03 | ✅ | `INSERT INTO kategori_kode_barang SELECT k.id, kb.id ... JOIN kb.kode = k.prefix_kode` — relasi 1:1 awal benar. |
| MIG-04 | ✅ | `UPDATE barang SET kode_barang_id = (SELECT ... JOIN kategori ...)` — via JOIN kategori, bukan parsing string. Aman walau prefix pernah berubah. |
| MIG-05 | ✅ | `DROP VIEW` → rebuild `kategori` (tanpa `prefix_kode`/`nomor_urut_terakhir`) → `CREATE VIEW v_barang` + `kode_barang_kode`. Tidak ada kode non-komentar yang mereferensikan kolom lama (grep seluruh `src/`). |
| MIG-06 | ✅ | Rebuild menyalin `id, nama, aktif, dibuat_pada` utuh; `barang` tidak disentuh selain tambah kolom. |
| MIG-07 | ❌ | **TEMUAN-1** — migrasi tidak atomik (lihat §3). |

### TS-KB — CRUD `kode_barang` (`src/features/kode-barang/`)

| ID | Hasil | Bukti / catatan |
|---|---|---|
| KB-01 | ✅ | `buatKodeBarang` → INSERT, counter 0, aktif=1. |
| KB-02 | ⚠️ | **INFO** — huruf kecil TIDAK ditolak; dinormalisasi ke kapital (`toUpperCase()` di service + `onChange` di UI). Lihat §3 TEMUAN-7. |
| KB-03 | ✅ | Pola `/^[A-Z0-9-]{1,10}$/` menolak spasi. |
| KB-04 | ✅ | `maxLength={10}` di UI + pola `{1,10}` di service. |
| KB-05 | ✅ | Ditolak (pesan pola; bukan pesan khusus "wajib diisi" — minor, masih jelas). |
| KB-06 | ✅ | `UNIQUE(kode)` + catch → "Kode sudah dipakai kode barang lain." |
| KB-07 | ✅ | `validasiNama`: 1–50 karakter. |
| KB-08 | ✅ | Service tolak ubah kode bila `hitungSemuaBarangDiKodeBarang > 0`; UI disable field + hint "Kode tidak bisa diubah — sudah dipakai barang". |
| KB-09 | ✅ | Counter hanya tampil read-only ("No. Urut Terakhir"); tidak ada setter di repo/service. |
| KB-10 | ✅ | `nonaktifkanKodeBarang` (aktif=0); dropdown pakai `WHERE aktif=1`; barang lama utuh. |
| KB-11 | ✅ | N/A — tidak ada hapus permanen di UI/service (hanya soft delete). |
| KB-12 | ⏸️ | Butuh browser (DB kosong total). |

### TS-MAP — Mapping M:N (`repo-kode-barang.ts`, tab Mapping)

| ID | Hasil | Bukti / catatan |
|---|---|---|
| MAP-01 | ✅ | `hubungkanMapping` (INSERT OR IGNORE). |
| MAP-02 | ✅ | Skema **tanpa** `UNIQUE(kode_barang_id)` — 1 kode boleh ke banyak kategori (Q2). |
| MAP-03 | ✅ | Composite PK `(kategori_id, kode_barang_id)` + INSERT OR IGNORE mencegah ganda. |
| MAP-04 | ✅ | `lepasMapping` (DELETE) untuk non-terakhir. |
| MAP-05 | ✅ | `lepasKode`: tolak bila `hitungMappingAktif <= 1` — pesan jelas. |
| MAP-06 | ✅ | Daftar "Tersedia" filter `kb.aktif = 1`. |
| MAP-07 | ❌ | **TEMUAN-3** — dropdown kategori di tab Mapping tidak filter aktif. |
| MAP-08 | ✅ | `lepasMapping` tidak menyentuh `barang.kode_barang_id`. |

### TS-FORM — Form tambah barang (`src/pages/BarangPage.tsx`)

| ID | Hasil | Bukti / catatan |
|---|---|---|
| FORM-01 | ✅ | `daftarKodeAktifUntukKategori` — terfilter mapping + aktif. |
| FORM-02 | ⚠️ | Auto-fill jalan (`pilihKategori`: `length===1` → pilih otomatis + preview), tapi **tidak ada catatan "Terisi otomatis"** — TEMUAN-4. |
| FORM-03 | ✅ | `>1` → tidak ada yang terpilih otomatis; preview mengikuti pilihan. |
| FORM-04 | ✅ | `previewbox` "Kode berikutnya (auto-generate, final)" = `kodeBerikutnya()` (counter+1, 7 digit). |
| FORM-05 | ⚠️ | Warnbox + dropdown disabled ✅, tapi **tombol Simpan tidak disabled** — submit diblokir di service ("Pilih kode barang yang valid..."). Fungsional terblokir, harfiah test plan tidak. TEMUAN-5. |
| FORM-06 | ✅ | Alur: validasi → `tambahBarangAtomik` → kode final = preview. |
| FORM-07 | ✅ | `validasiForm` tolak nama kosong SEBELUM counter naik. |
| FORM-08 | ✅ | Tombol KATEGORI lama hilang; diganti link "Kelola di Product Management →". |

### TS-NUM — Penomoran atomik (`tambahBarangAtomik`)

| ID | Hasil | Bukti / catatan |
|---|---|---|
| NUM-01 | ✅ | `UPDATE kode_barang SET nomor_urut_terakhir = ... + 1 ... RETURNING` — satu statement atomik; independen per kode. |
| NUM-02 | ✅ | Atomik + satu koneksi + pesan worker berurutan → tidak ada interleaving. (Eksekusi 10x cepat butuh browser.) |
| NUM-03 | ✅ | Counter menempel di `kode_barang`; dipakai lintas kategori = satu urutan (M:N + Q2). |
| NUM-04 | ✅ | Preview dan aktual sama-sama `counter+1`; tidak ada race (single connection). |
| NUM-05 | ✅ | Tidak ada API UI untuk ubah counter. |
| NUM-06 | ✅ | Ubah kode diblokir bila sudah dipakai (KB-08). |

### TS-Q4 — Validasi "kategori wajib min. 1 kode aktif"

| ID | Hasil | Bukti / catatan |
|---|---|---|
| Q4-01 | ❌ | **TEMUAN-2** — tidak ada badge "⚠ TANPA KODE" dan tidak ada banner; hanya "—" dan infobox umum. |
| Q4-02 | ⚠️ | Panel "Terhubung" kosong hanya tampil "Belum ada kode terhubung." (netral), bukan peringatan eksplisit — TEMUAN-6. |
| Q4-03 | ❌ | Akar masalah sama dengan Q4-01 (tidak ada flag visual). |
| Q4-04 | ❌ | Akar masalah sama dengan Q4-01; pemblokiran form-nya sendiri jalan (FORM-05). |

### TS-BKP — Backup/restore

| ID | Hasil | Bukti / catatan |
|---|---|---|
| BKP-01 | ✅ | `unduhBackup` mengekspor file `.db` penuh (`eksporDatabase`) — tabel baru otomatis ikut. |
| BKP-02 | ⏸️ | **Fitur restore tidak ada di aplikasi** (hanya tombol Unduh) — tidak dapat diuji. |
| BKP-03 | ⏸️ | Sama — tidak ada fitur restore. |
| BKP-04 | ⏸️ | Butuh browser (restore → buat barang). |
| BKP-05 | ⏸️ | Butuh browser. |

### TS-REG — Regresi

| ID | Hasil | Bukti / catatan |
|---|---|---|
| REG-01 | ✅ | Kolom "Kode Barang" (`kode_barang_kode` dari `v_barang`) ada di tabel daftar barang. |
| REG-02 | ✅ | Pencarian `lower(nama)/lower(kode)` tidak berubah. |
| REG-03 | ✅ | `CHECK(stok >= 0)` tidak berubah. |
| REG-04 | ✅ | Tidak ada kolom barcode terpisah; barcode = kode (tetap). |
| REG-05 | ✅ | `nilai_stok = stok × harga_beli` di view tidak berubah. |
| REG-06 | ✅ | `hapusKategori` tolak bila kategori masih punya barang aktif. |

### Skenario QA-CHECKLIST 22–28

| # | Hasil |
|---|---|
| 22 (backfill) | ✅ |
| 23 (counter lanjut) | ✅ |
| 24 (CRUD + validasi) | ✅ dengan catatan KB-02 |
| 25 (M:N + tolak lepas terakhir) | ✅ |
| 26 (form baru) | ✅ dengan catatan FORM-02 |
| 27 (tolak nonaktifkan kategori berisi) | ✅ |
| 28 (restore backup lama) | ⏸️ tidak ada fitur restore |

---

## 3. Temuan untuk Gunet (jangan perbaiki sendiri — laporkan saja; sudah sesuai instruksi)

### TEMUAN-1 [SEDANG-TINGGI] Migrasi 003 tidak atomik — gagal di tengah membuat aplikasi tidak bisa boot
- **File:** `migrasi/003_kode_barang.sql`; `src/lib/db-worker.ts` → `jalankanMigrasi()`.
- **Masalah:** migrasi dijalankan via `database.exec(sql)` tanpa `BEGIN`/`COMMIT` eksplisit,
  jadi tiap statement auto-commit sendiri. Backfill langkah 3–5 (`INSERT INTO kode_barang`,
  `INSERT INTO kategori_kode_barang`, `UPDATE barang`) **tidak idempoten**.
  Bila migrasi gagal di tengah (mis. CHECK violation pada data tak terduga),
  perubahan parsial sudah ter-commit tetapi versi `003_kode_barang` tidak tercatat →
  boot berikutnya mengulang migrasi → gagal di `UNIQUE(kode)` → aplikasi stuck di
  `MIGRATION_FAILED` setiap dibuka (tidak bisa dipakai sama sekali; data tidak hilang
  tapi tidak bisa diakses).
- **Reproduksi (analisis statis):** butuh artefak migrasi 003 yang disengaja rusak —
  di luar branch utama, sesuai batas test plan MIG-07.
- **Saran perbaikan:** bungkus isi `003_kode_barang.sql` dalam `BEGIN; ... COMMIT;`
  (SQLite mendukung DDL transaksional), ATAU buat backfill idempoten
  (`INSERT OR IGNORE` + guard `WHERE NOT EXISTS`).

### TEMUAN-2 [SEDANG] Badge "⚠ TANPA KODE" + banner Q4 tidak diimplementasikan
- **File:** `src/pages/ProductManagementPage.tsx` → `function TabKategori`.
- **Masalah:** test plan Q4-01/Q4-03/Q4-04 (prioritas Tinggi) mengharuskan badge per baris
  dan banner kuning daftar kategori aktif tanpa kode barang. Yang ada: `ChipKode`
  hanya tampil "—" bila kosong, plus `infobox` penjelasan umum. Kategori tanpa kode
  tidak ter-flag secara visual — melanggar keputusan Q4 Rama yang eksplisit.
- **Saran perbaikan:** tambah badge di kolom Status/nama bila `jml_kode === 0`
  (data sudah tersedia via `petaKodePerKategori`), + banner kuning di atas tabel
  bila ada ≥1 kategori aktif tanpa kode.

### TEMUAN-3 [RENDAH] Kategori nonaktif tampil di dropdown tab Mapping (MAP-07)
- **File:** `src/pages/ProductManagementPage.tsx` → `function TabMapping`;
  `src/features/kategori/repo-kategori.ts` → `daftarKategoriRingkasan()` (tanpa filter `aktif`).
- **Masalah:** dropdown "Pilih Kategori" memuat semua kategori termasuk nonaktif.
  Form Tambah Barang sudah memfilter (`k.filter(x => x.aktif === 1)`), tab Mapping tidak —
  inkonsisten.
- **Saran perbaikan:** filter `aktif = 1` di `TabMapping` (atau parameter di repo).

### TEMUAN-4 [RENDAH] Tidak ada catatan "Terisi otomatis" (FORM-02)
- **File:** `src/pages/BarangPage.tsx` → `pilihKategori()`.
- **Masalah:** auto-fill jalan (pilih otomatis + preview), tetapi tidak ada teks penjelas
  seperti yang diminta test plan ("✔ Terisi otomatis — kategori ini hanya punya
  1 kode barang aktif"). User tidak tahu kenapa dropdown terisi sendiri.
- **Saran perbaikan:** tambah `hint` di bawah dropdown bila auto-fill terjadi.

### TEMUAN-5 [RENDAH] Tombol Simpan tidak disabled saat kategori tanpa kode (FORM-05)
- **File:** `src/pages/BarangPage.tsx` (form tambah barang).
- **Masalah:** warnbox + dropdown disabled sudah ada, tetapi tombol Simpan hanya
  `disabled={sibuk}`. Submit memang diblokir di service
  (`tambahBarangBaru` → "Pilih kode barang yang valid untuk kategori ini."),
  jadi fungsional aman — hanya tidak sesuai test plan harfiah.
- **Saran perbaikan:** `disabled={sibuk || (editId === null && kodeTersedia.length === 0)}`.

### TEMUAN-6 [RENDAH] Peringatan mapping kosong hanya teks netral (Q4-02)
- **File:** `src/pages/ProductManagementPage.tsx` → `function TabMapping`.
- **Masalah:** panel "Terhubung" yang kosong hanya tampil "Belum ada kode terhubung.",
  bukan peringatan eksplisit "Hubungkan minimal 1 kode barang aktif".
- **Saran perbaikan:** tampilkan `warnbox` bila kategori aktif dan `terhubung` kosong.

### TEMUAN-7 [INFO, bukan bug] Huruf kecil dinormalisasi, bukan ditolak (KB-02)
- **File:** `src/features/kode-barang/service-kode-barang.ts` (`validasiKode` +
  `toUpperCase()`); `ProductManagementPage.tsx` (`onChange={...toUpperCase()}`).
- **Masalah:** test plan mengharapkan `elk-` DITOLAK dengan pesan pola.
  Implementasi: diterima lalu disimpan sebagai `ELK-`. Constraint DB
  (`kode = upper(kode)`) tetap terjaga.
- **Rekomendasi QA:** ini UX yang lebih baik — **update test plan** (terima normalisasi),
  bukan ubah kode. Perlu keputusan Rama bila ingin perilaku tolak-mentah.

---

## 4. Yang tidak dapat diuji di VM (butuh laptop Rama / browser)

1. Eksekusi aktual semua skenario UI (klik, form, toast, navigasi tab).
2. `KB-12` (empty state DB kosong total).
3. `BKP-02`/`BKP-03` — **fitur restore belum ada** di aplikasi (hanya tombol Unduh backup);
   skenario restore tidak dapat dieksekusi sampai fitur restore dibuat (di luar scope v0.1).
4. `BKP-04`/`BKP-05`, `NUM-02` (10x cepat), skenario QA-CHECKLIST 28.
5. Migrasi 003 di database asli Rama (satu-satunya DB produksi).

---

## 5. Batas pengujian — jujur

- Analisis 100% statis + baca-balik API GitHub; tidak ada baris kode yang dijalankan.
- Tidak ada toolchain/browser di VM ini (tidak bisa `npm run dev`, tidak bisa OPFS).
- Uji konkuren lintas tab/perangkat di luar scope (aplikasi single-user, satu tab).
- Semua temuan di atas perlu dikonfirmasi ulang secara visual oleh Rama setelah
  `git pull` → `npm install` → `npm run dev`.

---

*Testarossa — QA Engineer. Melapor ke Manager (Muse).*
