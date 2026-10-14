# QA Test Plan — Fitur "Kode Barang" (Ventra)

**Disusun oleh:** Testarossa (QA Engineer)
**Tanggal:** 14 Okt 2026
**Assignment:** #29 (Virtual Office)
**Status:** TEST PLAN — BELUM DIEKSEKUSI. Eksekusi QA berjalan di assignment terpisah setelah push implementasi Gunet.
**Acuan:**
- `docs/desain-kode-barang.md` (Kurniatot) + 4 keputusan final Rama
- `docs/mockup-product-management.html` (Prapto, Assignment #27)

---

## 1. Keputusan final Rama — acuan verifikasi

| # | Keputusan | Yang harus diverifikasi |
|---|-----------|------------------------|
| Q1 | Nama menu: **"Product Management"** | Label menu utama persis "Product Management" (bukan "Master Data" / "Komponen" / "Data Pokok"); judul halaman & tab konsisten |
| Q2 | Relasi **M:N fleksibel penuh** | 1 kode barang BOLEH terhubung ke >1 kategori; constraint `UNIQUE(kode_barang_id)` di tabel mapping **dihapus** dari migrasi 003; penomoran tetap per `kode_barang` (bukan per kategori) |
| Q3 | Dropdown auto-fill bila 1 | Kategori dengan tepat 1 kode barang aktif → dropdown "Kode Barang" di form tambah barang terisi otomatis + ada catatan "terisi otomatis"; bila >1 → tampil untuk dipilih manual |
| Q4 | Kategori wajib min. 1 kode barang aktif | Kategori aktif tanpa kode barang aktif: form tambah barang diblokir (dropdown terkunci + pesan + tombol Simpan nonaktif); badge ⚠ TANPA KODE di tab Kategori; banner peringatan; mapping aktif terakhir tidak boleh dilepas |

> Catatan: desain awal mengusulkan strict 1:N — keputusan Q2 membatalkannya. Test plan ini menguji **M:N penuh**.

---

## 2. Ruang lingkup

**Masuk:** migrasi 003 (skema + backfill), CRUD `kode_barang`, tab Mapping, form tambah barang (alur kategori → kode barang → preview), penomoran atomik, validasi Q4, kompatibilitas backup/restore, regresi area terdampak (daftar barang, pencarian, stok, barcode).

**Tidak masuk (di luar scope):** laporan Excel/PDF (belum ada — nanti), multi-user / konkurensi lintas perangkat (aplikasi single-user lokal), uji performa puluhan ribu SKU, printer fisik (barcode display-only).

---

## 3. Strategi & prasyarat eksekusi

- **Lingkungan:** laptop Rama, Chrome terbaru, `git pull` → `npm install` → `npm run dev` (http://localhost:5173), **satu tab saja**.
- **Pendekatan:** black-box dari sudut pandang operator toko; verifikasi isi DB dilakukan lewat fitur "Unduh backup" + inspeksi file (SQLite viewer) bila diperlukan — tanpa mengubah kode aplikasi.
- **Urutan eksekusi yang disarankan:** TS-MIG → TS-KB → TS-MAP → TS-FORM → TS-NUM → TS-Q4 → TS-BKP → TS-REG. TS-MIG wajib lolos dulu karena semua suite lain berdiri di atasnya.
- **Pelaporan bug:** tiap temuan wajib mencatat langkah reproduksi persis + screenshot/teks error console + data uji yang dipakai.

---

## 4. Data uji usulan (seed untuk eksekusi)

Seed ini meniru contoh di mockup agar hasil bisa dibandingkan:

**Kategori (pra-migrasi, format lama):**

| nama | prefix_kode | nomor_urut_terakhir | aktif |
|---|---|---|---|
| Elektronik | ELK- | 7 | 1 |
| Pakaian | PKN- | 5 | 1 |
| Makanan & Minuman | MKN- | 3 | 1 |

**Barang existing (pra-migrasi):** `ELK-0000001`, `ELK-0000007` (kategori Elektronik), `PKN-0000005` (kategori Pakaian) — lengkap dengan nama, harga beli/jual, stok.

**Edge case backfill:** satu barang `ELX-0000003` yang dibuat saat kategori "Elektronik" masih ber-prefix `ELX-` (prefix diubah menjadi `ELK-` setelah barang dibuat) — untuk memastikan backfill `kode_barang_id` lewat join kategori, bukan parsing string.

> Catatan seed: migrasi berjalan otomatis sekali. Siapkan DUA profil/origin bila perlu menguji migrasi berulang: (a) profil dengan DB lama (pra-003), (b) profil bersih.

---

## 5. Kasus uji

Format tiap kasus: **ID — Judul** (Prioritas: Tinggi/Sedang/Rendah) — prioritas berdasarkan risiko (kehilangan data & nomor ganda = tertinggi).

### TS-MIG — Migrasi 003

**MIG-01 — Migrasi berjalan otomatis sekali saat aplikasi dibuka setelah update** (Tinggi)
- Tujuan: migrasi 003 terdaftar & dieksekusi tepat sekali; user tidak perlu tindakan manual.
- Prasyarat: DB lama (pra-003; migrasi 001+002 sudah jalan).
- Data uji: seed §4.
- Langkah: 1) buka aplikasi (`npm run dev`, 1 tab); 2) tunggu boot selesai; 3) periksa tabel migrasi berisi entri 003; 4) tutup & buka ulang aplikasi.
- Hasil yang diharapkan: boot normal tanpa error; entri `003_kode_barang` tercatat; tabel `kode_barang` & `kategori_kode_barang` ada; buka ulang tidak menjalankan migrasi ulang (tidak ada error/duplikasi).

**MIG-02 — Backfill `kode_barang` 1:1 dari kategori** (Tinggi)
- Tujuan: setiap kategori menghasilkan tepat 1 `kode_barang` dengan counter & status yang sama.
- Prasyarat: MIG-01 lolos.
- Data uji: seed §4.
- Langkah: 1) unduh backup / inspeksi DB; 2) bandingkan isi `kode_barang` vs data kategori lama.
- Hasil yang diharapkan: 3 baris — `ELK-` (counter 7, aktif), `PKN-` (counter 5, aktif), `MKN-` (counter 3, aktif); kolom `nama` terisi ("Kode " + nama kategori); tidak ada baris ganda; `nomor_urut_terakhir` ≥ 0.

**MIG-03 — Backfill mapping 1:1** (Tinggi)
- Data uji: seed §4.
- Langkah: inspeksi tabel `kategori_kode_barang`.
- Hasil yang diharapkan: 3 baris mapping — tiap kategori ↔ kode hasil konversinya (Elektronik↔ELK-, Pakaian↔PKN-, Makanan & Minuman↔MKN-); tidak ada pasangan duplikat.

**MIG-04 — Backfill `barang.kode_barang_id` via join kategori, bukan parsing string** (Tinggi)
- Tujuan: barang existing tetap menunjuk `kode_barang` yang benar walau prefix kategori pernah berubah.
- Data uji: barang `ELX-0000003` (dibuat saat prefix kategori masih `ELX-`).
- Langkah: inspeksi `barang.kode_barang_id` untuk barang tersebut dan semua barang existing.
- Hasil yang diharapkan: `kode_barang_id` menunjuk baris kode `ELK-` (hasil konversi kategori saat ini) — BUKAN null dan BUKAN hasil parsing teks "ELX-"; semua barang existing punya `kode_barang_id` terisi (tidak ada NULL).

**MIG-05 — Kolom lama dihapus & view diperbarui** (Sedang)
- Langkah: inspeksi skema tabel `kategori` dan view `v_barang`; buka halaman daftar barang.
- Hasil yang diharapkan: kolom `prefix_kode` & `nomor_urut_terakhir` tidak ada di `kategori`; `v_barang` tetap bisa di-query dan memuat kolom tampilan kode barang (JOIN `kode_barang`); daftar barang di UI tampil normal.

**MIG-06 — Tidak ada data hilang** (Tinggi)
- Langkah: bandingkan sebelum/sesudah migrasi — jumlah baris barang & kategori; nilai kode, nama, harga beli/jual, stok, stok minimum tiap barang.
- Hasil yang diharapkan: semua sama persis; tidak ada baris hilang atau nilai berubah.

**MIG-07 — Gagal di tengah → rollback total** (Sedang)
- Tujuan: migrasi atomik dalam satu transaksi.
- Prasyarat: artefak uji khusus berisi migrasi 003 yang disengaja rusak (statement SQL invalid di tengah) — disiapkan terpisah, BUKAN di branch utama.
- Langkah: jalankan aplikasi dengan migrasi rusak.
- Hasil yang diharapkan: aplikasi menampilkan error migrasi yang jelas; DB kembali ke kondisi pra-003 (tabel lama utuh, tidak setengah jalan); tidak ada file database yang ter-wipe (guard anti-wipe tetap berlaku).

### TS-KB — CRUD `kode_barang`

**KB-01 — Tambah kode valid** (Tinggi)
- Data uji: kode `ELK-SRV-`, nama "Kode khusus servis", keterangan "Unit servis & sparepart".
- Langkah: Product Management → tab Kode Barang → Tambah → isi & simpan.
- Hasil yang diharapkan: tersimpan; counter 0; aktif=1; muncul di tab Kode Barang dan di daftar "Tersedia" tab Mapping.

**KB-02 — Tolak huruf kecil** (Tinggi)
- Data uji: kode `elk-`.
- Langkah: coba simpan.
- Hasil yang diharapkan: ditolak; pesan "Kode harus huruf kapital, pola [A-Z0-9-], 1–10 karakter, tanpa spasi."; tidak ada baris tersimpan.

**KB-03 — Tolak spasi** (Tinggi)
- Data uji: kode `ELK SRV-`.
- Hasil yang diharapkan: ditolak dengan pesan pola yang sama seperti KB-02.

**KB-04 — Tolak kode >10 karakter** (Sedang)
- Data uji: `ABCDEFGHIJK` (11 karakter).
- Hasil yang diharapkan: ditolak dengan pesan pola.

**KB-05 — Tolak kode kosong** (Sedang)
- Hasil yang diharapkan: ditolak; pesan "Kode wajib diisi."

**KB-06 — Tolak duplikat global** (Tinggi)
- Tujuan: `kode` unik GLOBAL, bukan per kategori.
- Data uji: kode `BRG-` yang sudah ada (dipakai kategori Elektronik).
- Langkah: coba tambah `BRG-` lagi.
- Hasil yang diharapkan: ditolak; pesan 'Kode "BRG-" sudah dipakai. Gunakan kode lain.'

**KB-07 — Nama wajib 1–50 karakter** (Sedang)
- Data uji: nama kosong; nama 51 karakter.
- Hasil yang diharapkan: keduanya ditolak dengan pesan yang jelas.

**KB-08 — Field kode terkunci bila sudah dipakai, boleh diubah bila belum** (Tinggi)
- Data uji: `ELK-SRV-` (sudah dipakai ≥1 barang); `KSM-` baru (pakai=0).
- Langkah: 1) ubah `ELK-SRV-` → field kode disabled + catatan "Kode dikunci — sudah dipakai N barang (kode historis tidak berubah)"; ubah nama/keterangan → simpan; 2) ubah `KSM-` → field kode masih bisa diedit.
- Hasil yang diharapkan: (1) nama/keterangan berubah, kode barang lama (`ELK-SRV-0000001` dst.) tidak berubah; (2) kode `KSM-` bisa diganti sebelum dipakai.

**KB-09 — Counter read-only** (Tinggi)
- Langkah: buka form ubah kode barang; periksa seluruh UI/aksi terkait.
- Hasil yang diharapkan: tidak ada field untuk mengubah `nomor_urut_terakhir`; tidak ada aksi UI yang mengubah counter selain pembuatan barang; nilai counter tidak pernah turun/reset.

**KB-10 — Nonaktifkan & aktifkan kembali (soft delete)** (Tinggi)
- Data uji: `ELK-SRV-` (sudah dipakai barang).
- Langkah: 1) nonaktifkan → 2) cek dropdown form tambah barang & daftar "Tersedia" → 3) cek daftar barang lama → 4) aktifkan kembali.
- Hasil yang diharapkan: (1) hilang dari dropdown form barang & daftar "Tersedia"; (2) barang lama yang memakainya tetap tampil utuh; (3) muncul kembali di dropdown setelah diaktifkan.

**KB-11 — Hapus permanen ditolak bila sudah dipakai** (Sedang)
- Langkah: bila UI menyediakan hapus permanen, coba hapus kode yang sudah dipakai barang.
- Hasil yang diharapkan: ditolak (`ON DELETE RESTRICT`) dengan arahan "nonaktifkan saja"; data barang tidak terpengaruh.

**KB-12 — State kosong** (Rendah)
- Prasyarat: DB tanpa satu pun `kode_barang`.
- Hasil yang diharapkan: tab menampilkan empty state "BELUM ADA KODE BARANG" + tombol "Tambah Kode Barang".

### TS-MAP — Mapping M:N

**MAP-01 — Hubungkan kode ke kategori** (Tinggi)
- Data uji: kategori Elektronik; kode `KSM-` (aktif, belum ter-mapping).
- Langkah: tab Mapping → pilih Elektronik → hubungkan `KSM-`.
- Hasil yang diharapkan: `KSM-` pindah ke "Terhubung"; hilang dari "Tersedia"; kolom "Kode Barang Terhubung" di tab Kategori menampilkan chip `KSM-`.

**MAP-02 — M:N: kode yang sama dihubungkan ke kategori kedua** (Tinggi) — keputusan Q2
- Data uji: `BRG-` sudah terhubung ke Elektronik.
- Langkah: tab Mapping → pilih Pakaian → hubungkan `BRG-`.
- Hasil yang diharapkan: BERHASIL (tidak ada error constraint); `BRG-` tampil di "Tersedia" Pakaian dengan label "juga dipakai: Elektronik"; kedua kategori kini memakai `BRG-`. (Desain lama strict 1:N akan menolak — pastikan tidak ditolak.)

**MAP-03 — Tolak mapping duplikat** (Sedang)
- Langkah: kode yang sudah terhubung ke suatu kategori tidak muncul lagi di "Tersedia" kategori yang sama.
- Hasil yang diharapkan: tidak bisa dihubungkan 2x; tidak ada baris ganda di tabel mapping.

**MAP-04 — Lepas mapping (bukan yang terakhir)** (Tinggi)
- Data uji: Elektronik punya ELK-, ELK-SRV-, BRG-.
- Langkah: lepas ELK-SRV-.
- Hasil yang diharapkan: berhasil; ELK-SRV- kembali ke "Tersedia"; form tambah barang untuk Elektronik kini hanya menawarkan 2 kode.

**MAP-05 — Tolak lepas mapping aktif terakhir** (Tinggi) — keputusan Q4
- Data uji: Makanan & Minuman hanya punya MKN-.
- Langkah: klik "Lepas" pada MKN-.
- Hasil yang diharapkan: DITOLAK dengan pesan jelas ("ini satu-satunya kode barang aktif untuk kategori ini … Hubungkan kode lain dulu"); mapping tetap ada.

**MAP-06 — Kode nonaktif tidak muncul di "Tersedia"** (Sedang)
- Data uji: `ATK-` (aktif=0).
- Hasil yang diharapkan: tidak tampil di daftar "Tersedia" kategori mana pun.

**MAP-07 — Kategori nonaktif tidak tampil di dropdown Mapping** (Rendah)
- Data uji: kategori "Kosmetik" (aktif=0).
- Hasil yang diharapkan: tidak ada di dropdown pilih kategori tab Mapping.

**MAP-08 — Barang lama tetap valid setelah lepas mapping** (Tinggi)
- Prasyarat: MAP-04 lolos.
- Langkah: periksa barang existing berkode `ELK-SRV-0000001`.
- Hasil yang diharapkan: tetap tampil dengan kode & `kode_barang_id` utuh; tidak ada NULL.

### TS-FORM — Form tambah barang

**FORM-01 — Dropdown Kode Barang terfilter mapping kategori** (Tinggi)
- Data uji: Elektronik ter-mapping ke ELK- & BRG- (setelah MAP-04).
- Langkah: Tambah Barang → pilih kategori Elektronik.
- Hasil yang diharapkan: dropdown hanya berisi ELK- & BRG- (tidak ada MKN-/PKN-); ganti pilihan → preview kode berubah mengikuti.

**FORM-02 — Auto-fill bila tepat 1 kode aktif** (Tinggi) — keputusan Q3
- Data uji: Makanan & Minuman hanya punya MKN- (counter 3).
- Langkah: pilih kategori tersebut.
- Hasil yang diharapkan: dropdown otomatis terpilih MKN- + catatan "✔ Terisi otomatis — kategori ini hanya punya 1 kode barang aktif"; preview tampil `MKN-0000004`.

**FORM-03 — Lebih dari 1 kode → pilih manual** (Sedang)
- Data uji: Elektronik punya 2 kode aktif.
- Hasil yang diharapkan: dropdown menampilkan semua pilihan + catatan "Pilih manual — kategori ini punya 2 kode barang aktif"; tidak ada yang terpilih otomatis secara diam-diam; preview mengikuti pilihan aktif.

**FORM-04 — Preview kode berikutnya** (Tinggi)
- Data uji: kode BRG- dengan counter 11.
- Hasil yang diharapkan: preview menampilkan `BRG-0000012`; format `{kode}{7 digit zero-padded}`.

**FORM-05 — Kategori tanpa kode → form diblokir** (Tinggi) — keputusan Q4
- Data uji: kategori "Alat Tulis" (aktif, tanpa kode).
- Langkah: pilih kategori tersebut di form tambah barang.
- Hasil yang diharapkan: dropdown Kode Barang terkunci ("— tidak tersedia —"); pesan merah "kategori belum punya kode barang aktif. Hubungkan dulu di Product Management → Mapping"; tombol Simpan nonaktif.

**FORM-06 — Simpan barang end-to-end** (Tinggi)
- Data uji: kategori Elektronik + kode BRG- + nama "Kabel HDMI 2m" + harga beli/jual + stok awal 10.
- Langkah: isi form & simpan.
- Hasil yang diharapkan: tersimpan; kode final persis seperti preview (`BRG-0000012`); counter BRG- naik menjadi 12; barang tercatat dengan `kategori_id` & `kode_barang_id` yang benar.

**FORM-07 — Validasi nama kosong** (Sedang)
- Langkah: kosongkan nama → simpan.
- Hasil yang diharapkan: ditolak dengan pesan; tidak ada barang tercipta; counter tidak naik.

**FORM-08 — Tombol KATEGORI lama dihapus** (Rendah)
- Langkah: buka halaman Barang.
- Hasil yang diharapkan: tidak ada lagi tombol KATEGORI; yang ada link kecil "Kelola di Product Management".

### TS-NUM — Penomoran atomik

**NUM-01 — Nomor naik per kode, independen antar kode** (Tinggi)
- Langkah: buat 2 barang dengan ELK-; periksa counter ELK-SRV-.
- Hasil yang diharapkan: `ELK-0000008`, `ELK-0000009`; counter ELK-SRV- tetap (tidak ikut naik).

**NUM-02 — Tidak ada nomor ganda** (Tinggi)
- Langkah: buat 10 barang berurutan cepat dengan kode yang sama.
- Hasil yang diharapkan: 10 kode unik & berurutan tanpa lompat/ganda; counter akhir = awal + 10.

**NUM-03 — Kode shared lintas kategori memakai satu counter** (Tinggi) — M:N + Q2
- Prasyarat: MAP-02 lolos (BRG- dipakai Elektronik & Pakaian).
- Langkah: buat barang di Elektronik pakai BRG- → catat kode; buat barang di Pakaian pakai BRG- → catat kode; periksa `kode_barang_id` keduanya.
- Hasil yang diharapkan: `BRG-0000012` lalu `BRG-0000013` (satu urutan, tidak ada cabang per kategori); kedua barang punya `kode_barang_id` yang sama (baris BRG-).

**NUM-04 — Preview = kode aktual yang tersimpan** (Tinggi)
- Langkah: untuk 5 barang, catat preview sebelum simpan, bandingkan dengan kode final.
- Hasil yang diharapkan: semuanya persis sama; tidak ada selisih.

**NUM-05 — Counter tidak bisa diubah manual** (Sedang)
- Hasil yang diharapkan: tidak ada field/API UI untuk mengubah `nomor_urut_terakhir`; nilai tidak pernah turun/reset (lihat juga KB-09).

**NUM-06 — Kode historis tidak berubah** (Sedang)
- Prasyarat: KB-08 lolos (kode `KSM-` diubah menjadi `KSMX-` sebelum dipakai).
- Langkah: buat barang dengan kode baru; periksa barang lama.
- Hasil yang diharapkan: barang baru memakai pola baru; barang existing tidak berubah.

### TS-Q4 — Validasi "kategori wajib min. 1 kode aktif"

**Q4-01 — Badge & banner di tab Kategori** (Tinggi)
- Data uji: kategori aktif "Alat Tulis" tanpa kode.
- Hasil yang diharapkan: baris menampilkan badge "⚠ TANPA KODE"; banner kuning di atas tabel mencantumkan nama kategori ("1 kategori belum punya kode barang aktif: Alat Tulis…").

**Q4-02 — Peringatan di tab Mapping** (Sedang)
- Langkah: pilih kategori tanpa mapping di tab Mapping.
- Hasil yang diharapkan: panel "Terhubung" kosong + peringatan "belum punya kode barang aktif … Hubungkan minimal 1 dari daftar Tersedia".

**Q4-03 — Kategori baru langsung ter-flag** (Sedang)
- Langkah: tambah kategori baru "Mainan" (tanpa mapping).
- Hasil yang diharapkan: langsung muncul badge ⚠ TANPA KODE + masuk hitungan banner (tidak silent).

**Q4-04 — Nonaktifkan satu-satunya kode → kategori ter-flag** (Tinggi)
- Data uji: Makanan & Minuman hanya punya MKN-.
- Langkah: nonaktifkan MKN- → cek tab Kategori & form tambah barang → aktifkan kembali.
- Hasil yang diharapkan: kategori otomatis ter-flag ⚠ TANPA KODE; form tambah barang untuk kategori itu terblokir seperti FORM-05; flag hilang setelah kode diaktifkan kembali.

### TS-BKP — Kompatibilitas backup/restore

**BKP-01 — Unduh backup memuat tabel baru** (Tinggi)
- Prasyarat: fitur berjalan (ada `kode_barang` + mapping + barang baru).
- Langkah: "Unduh backup" → restore file ke profil/origin bersih → inspeksi.
- Hasil yang diharapkan: tabel `kode_barang`, `kategori_kode_barang`, dan kolom `barang.kode_barang_id` ada; jumlah baris sama; counter konsisten.

**BKP-02 — Restore backup lama → migrasi 003 berjalan** (Tinggi)
- Data uji: file backup dari versi SEBELUM fitur (pra-003).
- Langkah: restore ke aplikasi baru (mengikuti mekanisme restore yang diimplementasikan Gunet) → buka aplikasi.
- Hasil yang diharapkan: migrasi 003 berjalan otomatis; data utuh (MIG-02 s.d. MIG-06 terpenuhi).

**BKP-03 — Restore backup baru → langsung jalan** (Sedang)
- Data uji: backup dari versi sesudah 003.
- Langkah: restore → buka aplikasi.
- Hasil yang diharapkan: boot tanpa migrasi ulang; relasi kategori↔kode↔barang utuh.

**BKP-04 — Counter konsisten setelah restore** (Tinggi)
- Data uji: backup diambil saat counter BRG- = 12.
- Langkah: restore → buat barang baru pakai BRG-.
- Hasil yang diharapkan: kode `BRG-0000013` (tidak mengulang nomor lama).

**BKP-05 — Integritas file setelah restore** (Sedang)
- Langkah: setelah restore, buka aplikasi dan navigasi ke semua halaman utama.
- Hasil yang diharapkan: boot normal tanpa error VDB; tidak ada tabel hilang.

### TS-REG — Regresi area terdampak

**REG-01 — Kolom "Kode Barang" di daftar barang** (Sedang)
- Hasil yang diharapkan: tabel daftar barang menampilkan kolom pola (mis. `BRG-`) di samping kolom Kode (`BRG-0000012`).

**REG-02 — Pencarian tetap berfungsi** (Sedang)
- Langkah: cari by nama dan by kode.
- Hasil yang diharapkan: hasil benar dan konsisten.

**REG-03 — Stok tidak boleh negatif** (Tinggi)
- Langkah: coba transaksi yang membuat stok negatif.
- Hasil yang diharapkan: ditolak (aturan lama tidak berubah).

**REG-04 — Barcode = kode** (Sedang)
- Hasil yang diharapkan: barcode yang ditampilkan berasal dari kode final barang.

**REG-05 — Nilai stok memakai harga beli** (Sedang)
- Hasil yang diharapkan: keputusan nilai stok tidak berubah oleh fitur ini.

**REG-06 — Nonaktifkan kategori yang masih punya barang → ditolak** (Sedang)
- Langkah: coba nonaktifkan kategori yang masih dipakai barang aktif.
- Hasil yang diharapkan: ditolak (aturan lama dipertahankan).

---

## 6. Kriteria lulus (exit criteria)

1. Semua kasus prioritas **Tinggi** lolos.
2. Tidak ada data hilang pada skenario migrasi maupun backup/restore.
3. Tidak ada nomor kode ganda pada semua skenario penomoran.
4. Semua pesan penolakan (Q4, validasi pola, duplikat) tampil jelas dalam Bahasa Indonesia dan mengarahkan user ke tindakan berikutnya.
5. Tidak ada regresi: daftar barang, pencarian, stok non-negatif, barcode tetap berfungsi.

---

## 7. Batas pengujian — jujur

- Test plan ini disusun dari desain + mockup + 4 keputusan final Rama; **belum dieksekusi** — hasil aktual menyusul di assignment QA berikutnya setelah push Gunet.
- Eksekusi membutuhkan laptop Rama (Chrome + `npm run dev`); VM ini tidak bisa menjalankan aplikasi (tidak ada toolchain/browser nyata untuk OPFS).
- Uji rollback migrasi (MIG-07) butuh artefak migrasi yang disengaja rusak — disiapkan terpisah, tidak di branch utama.
- Aplikasi single-user lokal: uji "konkurensi" (NUM-02) terbatas pada pembuatan berurutan cepat dalam satu sesi, bukan konkurensi lintas perangkat.
- Restore backup lama (BKP-02) mengikuti mekanisme restore yang diimplementasikan Gunet; langkah detail disesuaikan saat eksekusi.

---

*Testarossa — QA Engineer. Melapor ke Manager (Muse).*
