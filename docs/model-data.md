# Model Data — Ventra (Aplikasi Stock Barang) — v1.0 Final

**Disusun oleh:** Broto (Data Analyst) — 14 Okt 2026
**Revisi:** 14 Okt 2026 (Assignment #14) — entitas `kategori` baru; kode barang auto-generate per kategori (prefix + 7 digit); keputusan barcode = kode; mekanisme reset password final.
**Status:** Final draf untuk review lintas jobdesk
**Sumber keputusan:** Instruksi assignment #9 + keputusan terkunci paralel (satu akun + login, pcs, tanpa multi-gudang, offline lokal, barcode per item + scan, tolak stok negatif, harga beli/jual manual, laporan Excel & PDF, indikator visual stok menipis, reset password tanpa password lama) + 4 keputusan final Rama 14 Okt 2026 (Template B sebagai referensi desain; reset = username-check → unrestricted; pola kode dikonfigurasi per kategori + auto-generate sekuensial).
**Catatan jujur:** Bagian **8. Fakta vs Asumsi vs Belum Terkonfirmasi** memisahkan ketiganya secara eksplisit — tidak ada yang dikarang sebagai "jawaban Rama".

---

## 1. Daftar Tabel

| # | Tabel | Fungsi |
|---|-------|--------|
| 1 | `kategori` | Master kategori barang — pola kode per kategori + counter nomor urut (CRUD) |
| 2 | `barang` | Master data barang (satu baris = satu SKU; kode auto-generate dari kategorinya) |
| 3 | `transaksi_stok` | Riwayat pergerakan stok: masuk / keluar / penyesuaian (append-only = audit trail) |
| 4 | `pengguna` | Satu akun pemilik aplikasi (login) |
| 5 | `pengaturan` | Konfigurasi aplikasi (key–value) |

Relasi: satu `kategori` → banyak `barang`; satu `barang` → banyak `transaksi_stok`. `pengguna` dan `pengaturan` berdiri sendiri. **Tidak ada tabel gudang** (tanpa multi-gudang — keputusan terkunci).

---

## 2. Tabel `kategori` (entitas BARU — keputusan final Rama 14 Okt 2026)

Kategori bisa CRUD dari aplikasi. Setiap kategori menyimpan **pola kode** (prefix) dan **counter nomor urut** — kode barang baru selalu di-generate dari kategorinya, tidak diketik manual.

```sql
CREATE TABLE kategori (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nama                TEXT NOT NULL UNIQUE,   -- nama kategori (cth. 'Umum', 'Elektronik')
  prefix_kode         TEXT NOT NULL UNIQUE,   -- pola kode, cth. 'BRG-'; 1-10 karakter [A-Z0-9-]
  nomor_urut_terakhir INTEGER NOT NULL DEFAULT 0 CHECK (nomor_urut_terakhir >= 0),
  aktif               INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),  -- 1=aktif, 0=nonaktif (soft delete)
  dibuat_pada         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### Aturan validasi `kategori`

| Kolom | Aturan |
|-------|--------|
| `nama` | Wajib. 1–50 karakter setelah di-trim. Unik. |
| `prefix_kode` | Wajib. 1–10 karakter, pola `[A-Z0-9-]` (huruf kapital, angka, strip; tanpa spasi). **UNIK antar kategori** — dua kategori tidak boleh berbagi prefix, supaya kode barang tetap unik secara global. Contoh: `BRG-`, `ELK-`, `MKN-`. |
| `nomor_urut_terakhir` | ≥ 0, bilangan bulat. Counter internal — **hanya berubah lewat pembuatan barang** (atomik, lihat §9). Tidak boleh diedit manual dari UI. |
| `aktif` | Soft delete: kategori nonaktif disembunyikan dari pilihan kategori dan **tidak bisa dipakai untuk barang baru**, tetapi barang lama yang merujuknya tetap utuh (riwayat tidak patah). Kategori yang masih punya barang **tidak bisa dihapus permanen** (`ON DELETE RESTRICT` dari `barang`). |

### Aturan auto-generate kode barang (FINAL)

1. Saat barang baru dibuat, user **wajib memilih kategori** (kategori harus aktif).
2. Sistem menaikkan `nomor_urut_terakhir` kategori tersebut sebesar 1 — **di dalam transaksi database yang sama** dengan INSERT barang (atomik; tidak ada dua barang mendapat nomor yang sama, lihat §9).
3. `kode` barang = `prefix_kode` + nomor urut **7 digit zero-padded**. Contoh: kategori prefix `BRG-`, counter 0 → 1 → kode **`BRG-0000001`**; barang berikutnya `BRG-0000002`.
4. `kode` bersifat **final** setelah dibuat — tidak bisa diubah (menjaga konsistensi audit trail dan barcode).
5. Jika `prefix_kode` kategori diubah belakangan, kode barang yang **sudah ada tidak berubah** (historis); hanya barang baru yang memakai prefix baru. `nomor_urut_terakhir` tidak di-reset oleh perubahan prefix.

### Keputusan barcode (FINAL — satu identifier)

**Barcode = kode.** Tidak ada kolom barcode terpisah. Barcode Code128 yang ditampilkan di UI (display-only, tanpa cetak) meng-encode nilai `kode` barang. Scan barcode = lookup `kode`. Keputusan ini menggantikan desain lama (kolom `barcode` terpisah) — satu identifier untuk kode & barcode, tidak ada duplikasi.

---

## 3. Tabel `barang`

```sql
CREATE TABLE barang (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT NOT NULL UNIQUE,   -- auto-generate: prefix_kode kategori + 7 digit (cth. BRG-0000001)
  kategori_id   INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  nama          TEXT NOT NULL,
  satuan        TEXT NOT NULL DEFAULT 'pcs',  -- TERKUNCI: selalu 'pcs', tidak bisa diubah
  harga_beli    INTEGER NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),  -- Rupiah, input manual
  harga_jual    INTEGER NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),  -- Rupiah, input manual
  stok          INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),        -- saldo berjalan
  stok_awal     INTEGER NOT NULL DEFAULT 0 CHECK (stok_awal >= 0),   -- referensi saldo awal
  stok_minimum  INTEGER NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),-- ambang peringatan menipis
  keterangan    TEXT,                   -- catatan bebas, opsional
  aktif         INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),   -- 1=aktif, 0=nonaktif (soft delete)
  dibuat_pada   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  diubah_pada   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_barang_kode_nocase ON barang(kode COLLATE NOCASE);
CREATE INDEX idx_barang_kategori ON barang(kategori_id);
```

### Aturan validasi `barang`

| Kolom | Aturan |
|-------|--------|
| `kode` | **Auto-generate** saat barang dibuat (aturan §2): `prefix_kode` kategori + 7 digit zero-padded (cth. `BRG-0000001`). **Tidak diisi manual, tidak bisa diubah** setelah dibuat. Unik global (dijaga pola prefix unik + counter atomik + constraint UNIQUE sebagai pengaman). |
| `kategori_id` | Wajib. Harus merujuk kategori yang **aktif** (`aktif = 1`). Kategori nonaktif tidak bisa dipilih untuk barang baru. `ON DELETE RESTRICT`: kategori yang masih punya barang tidak bisa dihapus. |
| `nama` | Wajib. 1–100 karakter setelah di-trim. Boleh sama antar barang (pembeda tetap `kode`). |
| `satuan` | Selalu `'pcs'`. Kolom dikunci di aplikasi (read-only); tidak ada pilihan satuan lain. |
| `harga_beli`, `harga_jual` | Wajib diisi manual (keputusan terkunci — tidak ada auto dari riwayat). Bilangan bulat Rupiah ≥ 0, tanpa desimal. Boleh 0 (mis. barang hibah). Perubahan harga tidak mengubah riwayat transaksi lama. |
| `stok_awal` | ≥ 0, bilangan bulat. Diisi sekali saat barang dibuat. **Saat barang dibuat dengan `stok_awal` > 0, aplikasi otomatis mencatat satu transaksi** `jenis='masuk'`, `keterangan='Stok awal'`, `stok_sebelum=0`, `stok_sesudah=stok_awal` — supaya audit trail lengkap dari nol. |
| `stok_minimum` | ≥ 0, bilangan bulat. Default 0 = tanpa peringatan. |
| `stok` | Saldo berjalan, ≥ 0 (tidak pernah negatif — lihat §4). Hanya berubah lewat `transaksi_stok`, tidak boleh diedit langsung. |
| `aktif` | Soft delete: barang nonaktif disembunyikan dari daftar & tidak bisa ditransaksikan, tapi riwayatnya tetap utuh. Tidak ada hapus permanen barang yang sudah punya transaksi. |

**Catatan barcode:** tidak ada kolom `barcode` — barcode = `kode` (keputusan §2). Barcode Code128 di-generate dari `kode` dan ditampilkan di UI (display-only).

### Kolom turunan (auto-calculate — TIDAK disimpan, dihitung aplikasi/laporan)

| Turunan | Rumus | Catatan |
|---------|-------|---------|
| `margin_rp` | `harga_jual − harga_beli` | Boleh negatif → aplikasi beri peringatan "margin negatif". |
| `margin_persen` | `(harga_jual − harga_beli) / harga_beli × 100`, dibulatkan 2 desimal | `NULL` bila `harga_beli = 0` (tidak bisa dibagi nol). |
| `nilai_stok` | `stok × harga_beli` | Nilai persediaan berjalan per barang; total = jumlah semua barang. **Catatan:** definisi final (× harga beli vs × harga jual) MASIH MENUNGGU pilihan Rama — sampai dikunci, dokumen memakai × harga beli sebagai asumsi sementara. |
| `status_stok` | `stok = 0` → **habis**; `0 < stok ≤ stok_minimum` → **menipis**; selain itu → **aman** | Dasar indikator visual stok menipis. Jika `stok_minimum = 0`, status "menipis" tidak pernah muncul (hanya "habis"). |

---

## 4. Tabel `transaksi_stok` (audit trail)

```sql
CREATE TABLE transaksi_stok (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  barang_id    INTEGER NOT NULL REFERENCES barang(id) ON DELETE RESTRICT,
  jenis        TEXT NOT NULL CHECK (jenis IN ('masuk','keluar','penyesuaian')),
  jumlah       INTEGER NOT NULL,   -- bertanda; aturan per jenis di bawah
  stok_sebelum INTEGER NOT NULL CHECK (stok_sebelum >= 0),
  stok_sesudah INTEGER NOT NULL CHECK (stok_sesudah >= 0),
  referensi    TEXT,               -- no. nota/faktur/sumber, opsional
  keterangan   TEXT,               -- WAJIB untuk jenis 'penyesuaian'
  dibuat_oleh  TEXT NOT NULL,      -- nama_pengguna yang mencatat (audit: siapa)
  dibuat_pada  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))  -- audit: kapan
);
CREATE INDEX idx_transaksi_barang ON transaksi_stok(barang_id, id);
```

### Aturan validasi `transaksi_stok`

| Jenis | `jumlah` | Dampak ke stok | Aturan tolak |
|-------|----------|----------------|--------------|
| `masuk` | bilangan bulat **> 0** | `stok_sesudah = stok_sebelum + jumlah` | `jumlah ≤ 0` |
| `keluar` | bilangan bulat **> 0** | `stok_sesudah = stok_sebelum − jumlah` | `jumlah ≤ 0`, atau `jumlah > stok_sebelum` (**tolak stok negatif** — keputusan terkunci) |
| `penyesuaian` | bilangan bulat **≠ 0**, boleh negatif | `stok_sesudah = stok_sebelum + jumlah` | `jumlah = 0`, `keterangan` kosong (alasan koreksi wajib), atau hasil `< 0` |

### Aturan audit (append-only)

1. **Tidak ada UPDATE dan tidak ada DELETE** pada `transaksi_stok` — koreksi kesalahan hanya lewat transaksi `penyesuaian` baru. Ini yang membuat kolom siapa/kapan/jenis/jumlah/stok sebelum–sesudah bisa dipercaya sebagai audit trail.
2. Setiap pencatatan transaksi **wajib dalam satu transaksi database**: `INSERT` ke `transaksi_stok` + `UPDATE barang.stok = stok_sesudah` berjalan atomik (semua berhasil atau semua batal).
3. `barang_id` tidak boleh menunjuk barang nonaktif (`aktif = 0`) atau barang yang sudah dihapus.
4. `dibuat_pada` tidak boleh diubah; urutan `id` = urutan kronologis.

---

## 5. Tabel `pengguna` (satu akun)

```sql
CREATE TABLE pengguna (
  id              INTEGER PRIMARY KEY CHECK (id = 1),  -- hanya boleh ada SATU baris
  nama_pengguna   TEXT NOT NULL UNIQUE,   -- username untuk login
  kata_sandi_hash TEXT NOT NULL,          -- TIDAK PERNAH menyimpan password mentah
  dibuat_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  diubah_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### Aturan validasi `pengguna`

| Kolom | Aturan |
|-------|--------|
| `id` | Selalu 1. Aplikasi menolak pembuatan akun kedua. |
| `nama_pengguna` | Wajib, 3–30 karakter `[a-z0-9-_]`, unik. |
| `kata_sandi_hash` | Wajib. Hash bcrypt/argon2. Mekanisme reset **FINAL (14 Okt 2026):** link "Lupa password?" → user memasukkan username → sistem mengecek keberadaan akun → jika ada, field reset password menjadi **unrestricted** (langsung set password baru tanpa password lama). **Tidak ada kolom token/kode pemulihan** — tidak dibutuhkan oleh mekanisme ini. Event reset dicatat di audit log. Detail alur & catatan risiko: `stock-barang-mvp-v1.md` §8 (Cipher). |

---

## 6. Tabel `pengaturan` (key–value)

```sql
CREATE TABLE pengaturan (
  kunci       TEXT PRIMARY KEY,
  nilai       TEXT NOT NULL,
  diubah_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### Kunci bawaan (seed saat instalasi)

| Kunci | Nilai default | Fungsi |
|-------|---------------|--------|
| `nama_toko` | `''` | Nama usaha, tampil di kop laporan Excel/PDF |
| `stok_minimum_default` | `'0'` | Nilai awal `stok_minimum` tiap barang baru |
| `peringatan_stok_menipis` | `'1'` | `1` = tampilkan indikator visual stok menipis; `0` = matikan |

Kunci lain (jalur backup, preferensi cetak label, dsb.) ditambahkan mengikuti spesifikasi Epthal/Cipher — bukan ranah model data ini.

---

## 7. Contoh data & hasil acuan (untuk pengujian Testarossa)

**Kategori contoh:**

| id | nama | prefix_kode | nomor_urut_terakhir | aktif |
|----|------|-------------|---------------------|-------|
| 1 | Umum | BRG- | 2 | 1 |
| 2 | Elektronik | ELK- | 1 | 1 |

**Barang contoh:**

| kode | kategori | nama | harga_beli | harga_jual | stok_awal | stok | stok_minimum | margin_rp | margin_persen | nilai_stok | status |
|------|----------|------|------------|------------|-----------|------|--------------|-----------|---------------|------------|--------|
| BRG-0000001 | Umum | Kopi Tubruk 250g | 18000 | 25000 | 50 | 37 | 10 | 7000 | 38.89% | 666000 | aman |
| BRG-0000002 | Umum | Gula Pasir 1kg | 16500 | 16000 | 20 | 8 | 10 | −500 | −3.03% | 132000 | menipis ⚠️ |
| ELK-0000001 | Elektronik | Kabel USB-C 1m | 25000 | 40000 | 100 | 100 | 20 | 15000 | 60.00% | 2500000 | aman |

**Transaksi contoh (BRG-0000001):** stok awal 50 → keluar 10 (sisa 40) → masuk 5 (sisa 45) → keluar 8 (sisa 37). Setiap baris mencatat `dibuat_oleh`, `dibuat_pada`, `stok_sebelum`, `stok_sesudah`.

**Kasus batas yang harus lolos/ditolak:**

| Kasus | Harapan |
|-------|----------|
| Keluar tepat = sisa stok (37 dari 37) | Lolos, stok menjadi 0, status "habis" |
| Keluar 1 pcs melebihi sisa | **Ditolak** — stok negatif tidak boleh terjadi |
| Penyesuaian −37 dari stok 37 | Lolos (hasil tepat 0), `keterangan` wajib diisi |
| Penyesuaian −38 dari stok 37 | **Ditolak** |
| Buat barang tanpa memilih kategori | **Ditolak** (kategori wajib) |
| Buat barang di kategori nonaktif | **Ditolak** |
| Hapus permanen kategori yang masih punya barang | **Ditolak** (`ON DELETE RESTRICT`) |
| Buat kategori dengan prefix yang sudah dipakai (`BRG-`) | **Ditolak** (prefix unik antar kategori) |
| Ubah `kode` barang setelah dibuat | **Ditolak** (kode final) |
| Ubah `prefix_kode` kategori yang sudah punya barang | Lolos, tetapi kode barang lama **tidak berubah**; hanya barang baru memakai prefix baru |
| Scan barcode `BRG-0000001` | Ditemukan sebagai `kode` barang (barcode = kode) |
| Daftar kode `brg-0000001` saat `BRG-0000001` ada | **Ditolak** (unik case-insensitive) |
| Ubah `satuan` jadi "dus" | **Ditolak** (terkunci 'pcs') |
| Hapus baris `transaksi_stok` | **Ditolak** (append-only; koreksi via penyesuaian) |
| Transaksi ke barang nonaktif | **Ditolak** |

---

## 8. Fakta vs Asumsi vs Belum Terkonfirmasi

**FAKTA (dari keputusan terkunci):** kode/SKU unik & auto-generate per kategori · kategori bisa CRUD (nama unik, prefix unik, counter atomik) · barcode = kode (satu identifier) · satuan pcs · tanpa multi-gudang · harga beli & jual input manual · margin & nilai stok auto-calculate · ada stok awal + stok minimum · audit trail mencatat siapa/kapan/jenis/jumlah/stok sebelum–sesudah · satu akun + login · reset password = username-check → unrestricted (tanpa password lama) · tolak stok negatif · indikator visual stok menipis.

**ASUMSI (keputusan desain Broto, boleh dikoreksi Rama/tim):**
1. `stok` disimpan sebagai saldo berjalan di `barang` (bukan dihitung ulang dari SUM transaksi tiap dibuka) — demi kecepatan; konsistensi dijaga oleh penulisan atomik §4.
2. Stok awal dicatat ganda: kolom `stok_awal` (referensi) + satu transaksi `masuk` "Stok awal" (audit lengkap).
3. Format `kode`: `prefix_kode` (1–10 karakter `[A-Z0-9-]`, unik per kategori) + 7 digit zero-padded; contoh `BRG-0000001`. Panjang total ≤ 17 karakter.
4. Barcode Code128 meng-encode `kode`; tidak ada kolom barcode terpisah (keputusan §2).
5. `penyesuaian` memakai `jumlah` bertanda (negatif = koreksi turun) dan **wajib** mencantumkan `keterangan` alasan.
6. Soft delete via `aktif` (bukan hapus permanen) agar riwayat audit tidak patah — berlaku untuk `barang` maupun `kategori`.
7. Harga dalam Rupiah bilangan bulat (tanpa desimal/sen).
8. Waktu disimpan ISO 8601 UTC, ditampilkan dalam WIB (Asia/Jakarta).
9. Kunci bawaan `pengaturan` hanya 3; sisanya mengikuti Epthal/Cipher.

**BELUM TERKONFIRMASI:**
- Q-a. Definisi nilai stok (stok × harga beli vs × harga jual) — **menunggu pilihan final Rama**; dokumen memakai × harga beli sebagai asumsi sementara.
- Q-b. Apakah ada aturan khusus untuk penyesuaian stok (mis. alasan tertentu yang dilarang) selain keterangan wajib?

---

## 9. Catatan untuk Gunet (implementasi)

1. Selalu tulis transaksi dalam satu DB transaction: `BEGIN IMMEDIATE; INSERT INTO transaksi_stok ...; UPDATE barang SET stok = ?, diubah_pada = ? WHERE id = ?; COMMIT;`
2. Validasi "tolak stok negatif" dilakukan **sebelum** INSERT dengan membaca `stok` terkini di dalam transaksi yang sama (hindari race walau satu pengguna).
3. Jangan pernah expose UPDATE/DELETE untuk `transaksi_stok` di lapisan aplikasi.
4. **Pembuatan barang SELALU atomik dengan counter kategori** — dalam SATU transaksi: `UPDATE kategori SET nomor_urut_terakhir = nomor_urut_terakhir + 1 WHERE id = ?;` → baca `prefix_kode` + nilai counter baru → `INSERT INTO barang (kode = prefix || 7-digit, kategori_id, ...)`. Jangan baca counter lalu INSERT di dua langkah terpisah (risiko nomor ganda).
5. Kolom turunan (`margin_rp`, `margin_persen`, `nilai_stok`, `status_stok`) dihitung di query/aplikasi, mis. via VIEW:
   ```sql
   CREATE VIEW v_barang AS SELECT *, (harga_jual - harga_beli) AS margin_rp,
     CASE WHEN harga_beli > 0 THEN ROUND((harga_jual - harga_beli) * 100.0 / harga_beli, 2) END AS margin_persen,
     (stok * harga_beli) AS nilai_stok,
     CASE WHEN stok = 0 THEN 'habis' WHEN stok <= stok_minimum THEN 'menipis' ELSE 'aman' END AS status_stok
   FROM barang;
   ```
6. Skala: ratusan–ribuan SKU, satu pengguna — SQLite lebih dari cukup; index di `transaksi_stok(barang_id)` dan `barang(kategori_id)` menjaga laporan & filter kategori tetap cepat.

---

*— Broto, Data Analyst. Dilaporkan kepada Manager (Muse).*
