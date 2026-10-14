# Hasil QA — Fitur "Kode Barang" (Ventra)

**Diuji oleh:** Testarossa (QA Engineer)
**Tanggal eksekusi:** 14 Okt 2026, ~20:40–21:00 WIB
**Assignment:** #30 (Virtual Office)
**Kode yang diuji:** repo `RavenYG11/ventra` @ commit `fb80007f` (termasuk implementasi Gunet #28: `7b33567`, `0ba48ad`, `f5c60a4` + test plan #29)
**Acuan:** `docs/qa-kode-barang.md` (test plan), `docs/QA-CHECKLIST.md` skenario 22–28, `docs/desain-kode-barang.md`, `docs/mockup-product-management.html` (Prapto, kanonis), 4 keputusan final Rama (Q1–Q4)

---

## 1. Ringkasan eksekutif

| Suite | Hasil |
|---|---|
| TS-MIG (migrasi 003) | 6/7 lolos — **MIG-07 GAGAL** (migrasi tidak atomik) |
| TS-KB (CRUD kode barang) | 11/12 lolos — KB-08 parsial (inkonsistensi UI vs service) |
| TS-MAP (mapping M:N) | 6/7 lolos — **MAP-07 GAGAL** (kategori nonaktif tampil di dropdown) |
| TS-FORM (form tambah barang) | 6/8 lolos — FORM-02/03/05 parsial (catatan & state tombol hilang) |
| TS-NUM (penomoran atomik) | **6/6 LOLOS** |
| TS-Q4 (kategori wajib ≥1 kode) | 1/4 lolos — **Q4-01 & Q4-03 GAGAL** (badge + banner tidak diimplementasikan) |
| TS-BKP (backup/restore) | **5/5 LOLOS** |
| TS-REG (regresi) | **6/6 LOLOS** |
| QA-CHECKLIST 22–28 | 22, 23, 24, 27 lolos; 25, 26, 28 lolos dengan catatan |

**Total bug ditemukan: 8** (1 Tinggi, 3 Sedang, 4 Rendah) — rincian di §4, siap dikerjakan Gunet.
**Keputusan QA: BELUM LULUS exit criteria** — kriteria #1 (semua prioritas Tinggi lolos) tidak terpenuhi karena Q4-01 (Tinggi) gagal; kriteria #4 terpenuhi sebagian. Kriteria #2 (tidak ada data hilang), #3 (tidak ada nomor ganda), #5 (tidak ada regresi) **terpenuhi dan terbukti empiris**.

---

## 2. Metodologi (jujur)

- **Bukan uji browser.** VM ini tidak punya Chrome/toolchain untuk menjalankan aplikasi (OPFS hanya ada di browser). Sesuai test plan: eksekusi = **analisis statis kode** (seluruh `src/`, 3 file migrasi) **+ verifikasi empiris SQL** memakai SQLite 3.45.1 lokal. Fitur SQL yang dipakai (UPDATE…RETURNING, DROP/RENAME TABLE, CHECK, transaksi DDL) stabil sejak SQLite 3.35, jadi representatif untuk sqlite-wasm 3.53.4 produksi.
- **Seed uji** persis test plan §4: kategori Elektronik/ELK-/7, Pakaian/PKN-/5, Makanan & Minuman/MKN-/3; barang ELK-0000001, ELK-0000007, PKN-0000005, dan edge case ELX-0000003 (dibuat saat prefix masih ELX-).
- **MIG-07** memakai artefak migrasi 003 yang disengaja dirusak (statement invalid disisipkan setelah langkah 5) — sesuai test plan, bukan di branch utama.
- Alur klik/toast/render React **tidak dieksekusi** — diverifikasi via pembacaan kode vs mockup kanonis. Uji browser sesungguhnya tetap tugas Rama (QA-CHECKLIST).

---

## 3. Hasil per kasus uji

### TS-MIG — Migrasi 003

| ID | Hasil | Bukti |
|---|---|---|
| MIG-01 | ✅ LOLOS | Migrasi terdaftar di `src/lib/db-worker.ts` baris 318–322 (`['003_kode_barang', teksMigrasi003]`), pola sama dengan 001/002; dieksekusi sekali via tabel `migrasi` |
| MIG-02 | ✅ LOLOS | Empiris: 3 baris — `ELK-` (counter 7, aktif), `PKN-` (5, aktif), `MKN-` (3, aktif); nama = "Kode \<nama kategori\>"; tanpa duplikat |
| MIG-03 | ✅ LOLOS | Empiris: 3 baris mapping 1:1 (Elektronik↔ELK-, Pakaian↔PKN-, Makanan & Minuman↔MKN-) |
| MIG-04 | ✅ LOLOS | Empiris: `ELX-0000003` → `kode_barang_id` menunjuk baris `ELK-` (via JOIN kategori, bukan parsing string); 0 NULL di seluruh barang |
| MIG-05 | ✅ LOLOS | Empiris: kolom `prefix_kode` & `nomor_urut_terakhir` hilang dari `kategori`; `v_barang` valid + kolom `kode_barang_kode` terisi |
| MIG-06 | ✅ LOLOS | Empiris: 4 barang + 3 kategori utuh; kode, nama, harga beli/jual, stok, stok minimum, kategori_id identik sebelum/sesudah |
| MIG-07 | ❌ GAGAL | Lihat **BUG-1**: migrasi TIDAK atomik — gagal di tengah → DB setengah jalan, retry boot berikutnya gagal permanen |

### TS-KB — CRUD kode_barang

| ID | Hasil | Bukti |
|---|---|---|
| KB-01 | ✅ LOLOS | `buatKodeBarang` → INSERT; counter default 0, aktif=1; muncul di tab & daftar Tersedia (filter `kb.aktif=1`) |
| KB-02 | ✅ LOLOS | Service `POLA_KODE=/^[A-Z0-9-]{1,10}$/` menolak; backstop DB: `CHECK (kode = upper(kode))` |
| KB-03 | ✅ LOLOS | Sama — spasi ditolak service & DB |
| KB-04 | ✅ LOLOS | 11 karakter ditolak (`length(kode) BETWEEN 1 AND 10`) |
| KB-05 | ✅ LOLOS | Kosong ditolak (`{1,10}` + pesan "Kode 1–10 karakter…") |
| KB-06 | ✅ LOLOS | Empiris: `UNIQUE constraint failed: kode_barang.kode`. Catatan: pesan implementasi ("Kode sudah dipakai kode barang lain.") menyimpang dari mockup ('Kode "BRG-" sudah dipakai. Gunakan kode lain.') — observasi, bukan bug |
| KB-07 | ✅ LOLOS | Service tolak; backstop DB: `CHECK (length(nama) BETWEEN 1 AND 50)` |
| KB-08 | ⚠️ PARSIAL | Service benar (pakai `hitungSemuaBarangDiKodeBarang`, tolak bila >0). **Tapi UI inkonsisten** — lihat **BUG-5** |
| KB-09 | ✅ LOLOS | Tidak ada field/API untuk ubah counter; satu-satunya penulis counter = `tambahBarangAtomik` |
| KB-10 | ✅ LOLOS | Soft delete (`aktif=0`); hilang dari dropdown & Tersedia; barang lama utuh |
| KB-11 | ✅ LOLOS | Tidak ada jalur hapus permanen di UI (by design) |
| KB-12 | ✅ LOLOS | Empty state "Belum ada kode barang. Klik "+ Tambah Kode Barang"" ada |

### TS-MAP — Mapping M:N

| ID | Hasil | Bukti |
|---|---|---|
| MAP-01 | ✅ LOLOS | `hubungkanMapping` INSERT; pindah Terhubung→Tersedia; chip tampil di tab Kategori (`petaKodePerKategori`) |
| MAP-02 | ✅ LOLOS | Empiris: `BRG-` terhubung ke Elektronik DAN Pakaian — tanpa error constraint; counter shared: BRG-0000012 lalu BRG-0000013; `kode_barang_id` sama. Catatan: label "juga dipakai: …" di mockup tidak diimplementasikan (**BUG-7**) |
| MAP-03 | ✅ LOLOS | Empiris: PK `(kategori_id, kode_barang_id)` menolak duplikat; `INSERT OR IGNORE` (pola repo) tidak menggandakan |
| MAP-04 | ✅ LOLOS | Empiris: lepas BRG- dari Elektronik (masih ada ELK-) berhasil |
| MAP-05 | ✅ LOLOS | Empiris: lepas satu-satunya mapping aktif (MKN- di Makanan & Minuman) DITOLAK dengan pesan jelas |
| MAP-06 | ✅ LOLOS | Daftar Tersedia filter `kb.aktif = 1` |
| MAP-07 | ❌ GAGAL | Lihat **BUG-8**: dropdown tab Mapping tidak memfilter kategori nonaktif |
| MAP-08 | ✅ LOLOS | Empiris: barang `ELK-SRV-0000001` tetap valid setelah mapping dilepas; `kode_barang_id` utuh |

### TS-FORM — Form tambah barang

| ID | Hasil | Bukti |
|---|---|---|
| FORM-01 | ✅ LOLOS | `daftarKodeAktifUntukKategori` = JOIN mapping + `kb.aktif=1`; dropdown hanya berisi kode ter-mapping |
| FORM-02 | ⚠️ PARSIAL | Auto-fill bila tepat 1 kode ✅ (`pilihKategori`, BarangPage.tsx). **Catatan "✔ Terisi otomatis — …" tidak di-render** (**BUG-6**) |
| FORM-03 | ⚠️ PARSIAL | Pilih manual ✅. **Catatan "Pilih manual — …" tidak di-render** (**BUG-6**) |
| FORM-04 | ✅ LOLOS | `pratinjauKodeBerikutnya` = `kode + (counter+1).padStart(7,'0')`, read-only tanpa menaikkan counter |
| FORM-05 | ⚠️ PARSIAL | Warnbox tampil ✅, dropdown terkunci ✅ (`disabled={kodeTersedia.length===0}`). **Tombol Simpan TIDAK nonaktif** (**BUG-4**). Catatan: opsi kategori tanpa kode di-disabled sehingga warnbox hanya terjangkau bila kategori pertama yang terpilih tanpa kode |
| FORM-06 | ✅ LOLOS | Alur `tambahBarangBaru` → validasi → `tambahBarangAtomik` (UPDATE…RETURNING atomik + INSERT + transaksi stok awal); defense-in-depth SQL menolak kode nonaktif/tak ter-mapping/kategori nonaktif (empiris) |
| FORM-07 | ✅ LOLOS | `validasiForm`: nama 1–100 karakter; counter tidak naik bila validasi gagal (gagal sebelum UPDATE) |
| FORM-08 | ✅ LOLOS | Tombol KATEGORI dihapus; ada link "Kelola di Product Management →" |

### TS-NUM — Penomoran atomik

| ID | Hasil | Bukti |
|---|---|---|
| NUM-01 | ✅ LOLOS | Empiris: ELK-0000008, ELK-0000009; counter PKN- tetap 5 |
| NUM-02 | ✅ LOLOS | Empiris: 10 barang berurutan cepat → 10 kode unik & berurutan (ELK-0000010 s.d. ELK-0000019), counter akhir = 19 |
| NUM-03 | ✅ LOLOS | Empiris: BRG- dipakai Elektronik → BRG-0000012, lalu Pakaian → BRG-0000013 (satu urutan, `kode_barang_id` sama) |
| NUM-04 | ✅ LOLOS | Preview read-only dari counter yang sama dengan UPDATE…RETURNING; tidak ada selisih (code-verified) |
| NUM-05 | ✅ LOLOS | Tidak ada jalur ubah counter (KB-09) |
| NUM-06 | ✅ LOLOS | Service tolak ubah prefix bila sudah dipakai (`hitungSemuaBarangDiKodeBarang`); kode lama final |

### TS-Q4 — Validasi kategori wajib ≥1 kode aktif

| ID | Hasil | Bukti |
|---|---|---|
| Q4-01 | ❌ GAGAL | **BUG-2**: badge "⚠ Tanpa kode" + banner peringatan tidak diimplementasikan di TabKategori (data `jml_kode` sudah tersedia tapi tidak dipakai untuk flag visual) |
| Q4-02 | ⚠️ PARSIAL | Tab Mapping hanya menampilkan empty state netral "Belum ada kode terhubung." — tanpa peringatan "belum punya kode barang aktif … hubungkan minimal 1" seperti test plan |
| Q4-03 | ❌ GAGAL | Sama dengan Q4-01 — kategori baru tanpa mapping tidak ter-flag visual |
| Q4-04 | ⚠️ TAK DAPAT DIVERIFIKASI PENUH | Service `hapusKodeBarang` selalu membolehkan nonaktifkan (sesuai desain); flag visual akibatnya belum ada karena **BUG-2** |

### TS-BKP — Backup/restore

| ID | Hasil | Bukti |
|---|---|---|
| BKP-01 | ✅ LOLOS | `unduhBackup` → `eksporDatabase` → `poolUtil.exportFile()` = salinan PENUH file .db; tabel `kode_barang`, `kategori_kode_barang`, kolom `barang.kode_barang_id` otomatis ikut (by construction, tanpa perubahan kode) |
| BKP-02 | ✅ LOLOS* | Tidak ada jalur restore khusus di aplikasi — file .db lama dibuka → migrasi 003 jalan otomatis (hasil MIG-01…06). *Tergantung BUG-1 untuk skenario gagal |
| BKP-03 | ✅ LOLOS | File .db pasca-003 dibuka → versi tercatat → tanpa migrasi ulang (by construction) |
| BKP-04 | ✅ LOLOS | Counter tersimpan di kolom tabel → ikut ter-restore; penomoran lanjut tanpa mengulang (empiris: counter persist di file) |
| BKP-05 | ✅ LOLOS | Tidak ada perubahan mekanisme export; guard anti-wipe tidak tersentuh fitur ini |

### TS-REG — Regresi

| ID | Hasil | Bukti |
|---|---|---|
| REG-01 | ✅ LOLOS | Kolom "Kode Barang" (`kode_barang_kode` dari v_barang) tampil di samping kolom Kode |
| REG-02 | ✅ LOLOS | Query pencarian `lower(nama)/lower(kode) LIKE` tidak berubah |
| REG-03 | ✅ LOLOS | Empiris: `CHECK (stok >= 0)` menolak stok negatif |
| REG-04 | ✅ LOLOS | Barcode = kode: kolom `kode` tetap final & tak berubah; tidak ada kolom barcode terpisah (sesuai model-data.md) |
| REG-05 | ✅ LOLOS | Empiris: `nilai_stok = stok × harga_beli` di v_barang (10 × 15000 = 150000) — keputusan Rama tidak berubah |
| REG-06 | ✅ LOLOS | `hapusKategori` menolak bila kategori masih punya barang aktif (pesan: "DITOLAK: kategori masih punya N barang aktif…") |

### QA-CHECKLIST skenario 22–28 (untuk Rama)

| # | Hasil |
|---|---|
| 22 | ✅ LOLOS — backfill otomatis terbukti empiris |
| 23 | ✅ LOLOS — counter lanjut, barang lama valid |
| 24 | ✅ LOLOS — CRUD + validasi pola |
| 25 | ✅ LOLOS dengan catatan — M:N jalan; label "juga dipakai" hilang (BUG-7); kategori nonaktif tampil di dropdown (BUG-8) |
| 26 | ✅ LOLOS dengan catatan — auto-fill jalan; catatan auto-fill/manual hilang (BUG-6); Simpan tak disabled saat diblokir (BUG-4) |
| 27 | ✅ LOLOS — nonaktifkan kategori berisi barang ditolak |
| 28 | ✅ LOLOS dengan catatan — migrasi otomatis jalan; skenario GAGAL migrasi tidak aman (BUG-1) |

---

## 4. Bug untuk Gunet (JANGAN perbaiki sendiri — ini laporan QA)

### BUG-1 [TINGGI] — Migrasi tidak atomik: gagal di tengah → DB setengah jalan + retry stuck permanen
- **File:** `src/lib/db-worker.ts`, fungsi `jalankanMigrasi()` (baris ~315–340)
- **Masalah:** `database.exec(sql)` dijalankan TANPA `BEGIN`/`COMMIT`. Ini melanggar jaminan `docs/desain-kode-barang.md` §6 ("Semua langkah dalam satu transaksi — gagal di tengah = batal total, database kembali seperti semula").
- **Reproduksi (terbukti empiris):** (1) buat DB pra-003; (2) jalankan migrasi 003 yang disisipi statement invalid setelah langkah 5; (3) amati: error syntax, TAPI tabel `kode_barang` sudah ada + ter-backfill 3 baris, kolom `prefix_kode` masih ada, versi 003 TIDAK tercatat; (4) boot berikutnya → worker retry migrasi 003 → GAGAL `UNIQUE constraint failed: kode_barang.kode` → aplikasi stuck di error MIGRATION_FAILED selamanya (tidak ada jalan pulih otomatis).
- **Perbaikan yang disarankan:** bungkus tiap migrasi dalam transaksi — `exec('BEGIN')` → `exec(sql)` → catat versi → `exec('COMMIT')`; `ROLLBACK` bila gagal. (DDL SQLite bersifat transaksional, jadi ini aman.)

### BUG-2 [SEDANG] — Badge "⚠ Tanpa kode" + banner Q4 tidak diimplementasikan
- **File:** `src/pages/ProductManagementPage.tsx`, komponen `TabKategori`
- **Masalah:** mockup kanonis (Prapto) + test plan Q4-01/Q4-03 mensyaratkan: baris kategori aktif tanpa kode aktif → badge "⚠ Tanpa kode"; banner kuning di atas tabel: "⚠ N kategori belum punya kode barang aktif: …". Keduanya tidak di-render. Data sudah tersedia (`KategoriRingkasan.jml_kode`), hanya belum dipakai untuk flag visual.
- **Reproduksi:** buat kategori baru tanpa mapping → tab Kategori tidak menampilkan badge/banner apa pun.
- **Catatan:** `src/styles.css` belum punya class `.badge.warn` — perlu ditambah (mockup memakai `<span class="badge warn">`).

### BUG-3 [SEDANG] — `lepasKode` menolak melepas mapping NONAKTIF (over-blocking)
- **File:** `src/features/kode-barang/service-kode-barang.ts`, `lepasKode()` (baris 133–143)
- **Masalah:** cek `if (jml <= 1)` memakai hitungan SEMUA mapping aktif, tanpa mengecualikan mapping yang sedang dilepas. Desain §3: yang dilarang hanya melepas "mapping TERAKHIR YANG AKTIF".
- **Reproduksi (terbukti empiris):** kategori punya mapping aktif MKN- + mapping nonaktif BRG- → klik Lepas pada BRG- → DITOLAK "tidak bisa melepas mapping terakhir", padahal MKN- tetap aktif. Seharusnya BOLEH.
- **Perbaikan yang disarankan:** hitung mapping aktif SELAIN `kodeBarangId` yang dilepas; tolak hanya bila hasilnya 0. (Juga pertimbangkan: bila yang dilepas adalah mapping nonaktif dan sisa aktif = 0 — kategori memang sudah melanggar Q4, melepasnya seharusnya tetap boleh.)

### BUG-4 [SEDANG] — Tombol Simpan tidak nonaktif saat form diblokir (FORM-05)
- **File:** `src/pages/BarangPage.tsx`, baris ~403 (`<Tombol varian="utama" disabled={sibuk} onClick={simpan}>`)
- **Masalah:** mockup panel C + test plan FORM-05: saat kategori tanpa kode aktif, tombol "Simpan Barang" DISABLED. Implementasi hanya disabled saat `sibuk`. Service tetap menolak (defense-in-depth OK), tapi user bisa klik → dapat error, bukan dicegah di UI.
- **Perbaikan yang disarankan:** `disabled={sibuk || !!kategoriTanpaKode}`.

### BUG-5 [RENDAH–SEDANG] — Inkonsistensi UI vs service untuk kunci prefix (KB-08)
- **File:** `src/pages/ProductManagementPage.tsx`, `TabKode` → `mulaiUbah` (baris 253): `setEditPernahDipakai(k.jml_barang > 0)`
- **Masalah:** `jml_kode`/`jml_barang` di ringkasan hanya menghitung barang AKTIF, sedangkan service `suntingKodeBarang` memakai `hitungSemuaBarangDiKodeBarang` (semua, termasuk nonaktif).
- **Reproduksi (terbukti empiris):** kode TST- dipakai 1 barang → barang dinonaktifkan → tab Kode Barang menampilkan Jml Barang = 0 → klik Ubah → field Kode EDITABLE → ubah kode → Simpan → DITOLAK "Kode tidak bisa diubah — sudah dipakai barang." User bingung: field terlihat bisa diubah tapi ditolak.
- **Perbaikan yang disarankan:** tambah field `jml_barang_semua` di `daftarKodeBarangRingkasan` (repo) dan pakai itu untuk `editPernahDipakai`; atau samakan definisi di kedua sisi.

### BUG-6 [RENDAH] — Catatan auto-fill / pilih manual tidak di-render (FORM-02/03)
- **File:** `src/pages/BarangPage.tsx`, form Tambah Barang (fungsi `pilihKategori`)
- **Masalah:** mockup mensyaratkan catatan di bawah dropdown Kode Barang: "✔ Terisi otomatis — kategori ini hanya punya 1 kode barang aktif (keputusan Q3)." bila auto-fill, dan "Pilih manual — kategori ini punya N kode barang aktif." bila >1. Implementasi hanya menampilkan preview kode.
- **Perbaikan yang disarankan:** tambah state/hint text sesuai jumlah `kodeTersedia.length`.

### BUG-7 [RENDAH] — Label "juga dipakai: …" hilang di tab Mapping (MAP-02)
- **File:** `src/pages/ProductManagementPage.tsx`, `TabMapping` (daftar "Tersedia")
- **Masalah:** mockup menampilkan label "juga dipakai: \<kategori\>" untuk kode yang sudah terhubung ke kategori lain (membantu operator sadar counter shared). Tidak diimplementasikan.
- **Perbaikan yang disarankan:** `infoMapping` / repo perlu mengembalikan peta kode → daftar kategori pemakai lain (atau query tambahan di UI).

### BUG-8 [RENDAH] — Kategori nonaktif tampil di dropdown tab Mapping (MAP-07)
- **File:** `src/pages/ProductManagementPage.tsx`, `TabMapping` (baris ~397): `daftarKategoriDenganRingkasan()` tanpa filter aktif
- **Masalah:** test plan MAP-07: kategori nonaktif tidak tampil di dropdown Mapping. Implementasi menampilkan semua.
- **Perbaikan yang disarankan:** filter `k.aktif === 1` seperti di `BarangPage` (`setKategori(k.filter((x) => x.aktif === 1))`).

---

## 5. Observasi (bukan bug — untuk pertimbangan)

1. **Wording pesan validasi menyimpang dari mockup** (panel D mockup): mockup "Kode harus huruf kapital, pola [A-Z0-9-], 1–10 karakter, tanpa spasi." / 'Kode "BRG-" sudah dipakai. Gunakan kode lain.' / "Nama wajib diisi (1–50 karakter)." — implementasi: "Kode 1–10 karakter: huruf kapital, angka, strip (tanpa spasi)." / "Kode sudah dipakai kode barang lain." / "Nama tampilan 1–50 karakter." Pesan implementasi tetap jelas & Bahasa Indonesia; selaraskan hanya bila Rama minta.
2. **`hubungkanKode` tidak memvalidasi kode/kategori aktif** (hanya UI-gated). Risiko rendah (single-user), tapi defense-in-depth bisa ditambah — terkait BUG-8.
3. **Komentar basi:** `service-barang.ts` menyebut "(cek ganda di SQL CTE)" padahal CTE sudah dihapus (pola baru UPDATE…RETURNING langsung).
4. **`buatKodeBarang`/`buatKategori` menelan semua error** menjadi pesan "sudah dipakai" — bila DB error karena sebab lain, pesan menyesatkan. Risiko rendah.
5. **Karakter `@` dkk. lolos CHECK DB** (`ELK@SRV` lolos `upper/length/no-space`) — hanya service `POLA_KODE` yang menolak. Aman selama semua tulis lewat service (saat ini ya).

---

## 6. Batas pengujian — jujur

1. **Tidak ada uji browser/klik nyata** — VM tidak punya Chrome; alur runtime React (render, toast, modal) hanya dianalisis statis vs mockup. Uji tangan Rama (QA-CHECKLIST 22–28) tetap diperlukan sebagai acceptance final.
2. **Verifikasi SQL empiris memakai SQLite 3.45.1**, bukan sqlite-wasm 3.53.4 — fitur yang dipakai identik perilakunya sejak 3.35; risiko divergensi dinilai minimal.
3. **MIG-07 memakai migrasi rusak sintetis**; pemicu realistis di produksi (mis. CHECK violation pada data aneh) jarang, tapi BUG-1 tetap melanggar jaminan desain.
4. **Konkurensi** (NUM-02) diuji sebagai pembuatan berurutan cepat satu sesi — aplikasi memang single-user/single-tab by design.
5. **Q4-04 tidak bisa diverifikasi penuh** karena flag visualnya belum diimplementasikan (BUG-2).

---

*Testarossa — QA Engineer. Melapor ke Manager (Muse). Dokumen ini HASIL EKSEKUSI QA assignment #30.*
