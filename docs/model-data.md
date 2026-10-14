# Model Data — Ventra (Aplikasi Stock Barang) — v1.0 Final

**Disusun oleh:** Broto (Data Analyst) — 14 Okt 2026
**Status:** Final draf untuk review lintas jobdesk
**Sumber keputusan:** Instruksi assignment #9 + keputusan terkunci paralel (satu akun + login, pcs, tanpa multi-gudang, offline lokal, barcode per item + scan, tolak stok negatif, harga beli/jual manual, laporan Excel & PDF, indikator visual stok menipis, reset password tanpa password lama).
**Catatan jujur:** Naskah 18 jawaban final Rama tidak tersedia dalam konteks kerja ini. Semua yang di bawah diturunkan dari keputusan terkunci di atas. Bagian **7. Fakta vs Asumsi vs Belum Terkonfirmasi** memisahkan ketiganya secara eksplisit — tidak ada yang dikarang sebagai "jawaban Rama".

---

## 1. Daftar Tabel

| # | Tabel | Fungsi |
|---|-------|--------|
| 1 | `barang` | Master data barang (satu baris = satu SKU) |
| 2 | `transaksi_stok` | Riwayat pergerakan stok: masuk / keluar / penyesuaian (append-only = audit trail) |
| 3 | `pengguna` | Satu akun pemilik aplikasi (login) |
| 4 | `pengaturan` | Konfigurasi aplikasi (key–value) |

Relasi: satu `barang` → banyak `transaksi_stok`. `pengguna` dan `pengaturan` berdiri sendiri. **Tidak ada tabel gudang** (tanpa multi-gudang — keputusan terkunci).

---

## 2. Tabel `barang`

```sql
CREATE TABLE barang (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT NOT NULL UNIQUE,   -- SKU, unik (keputusan terkunci)
  nama          TEXT NOT NULL,
  barcode       TEXT NOT NULL UNIQUE,   -- satu barcode per item, unik (keputusan terkunci)
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
```

### Aturan validasi `barang`

| Kolom | Aturan |
|-------|--------|
| `kode` | Wajib. 1–30 karakter, pola `[A-Z0-9-_]` (huruf kapital, angka, strip, underscore; tanpa spasi). Unik tanpa peduli kapital (`BRG-001` = `brg-001` → ditolak). Tidak boleh diubah setelah barang dipakai transaksi. |
| `nama` | Wajib. 1–100 karakter setelah di-trim. Boleh sama antar barang (pembeda tetap `kode`). |
| `barcode` | Wajib. 1–48 karakter ASCII printable (batas praktis Code128). Unik — satu barcode hanya milik satu barang. Tidak boleh diubah setelah dipakai transaksi. |
| `satuan` | Selalu `'pcs'`. Kolom dikunci di aplikasi (read-only); tidak ada pilihan satuan lain. |
| `harga_beli`, `harga_jual` | Wajib diisi manual (keputusan terkunci — tidak ada auto dari riwayat). Bilangan bulat Rupiah ≥ 0, tanpa desimal. Boleh 0 (mis. barang hibah). Perubahan harga tidak mengubah riwayat transaksi lama. |
| `stok_awal` | ≥ 0, bilangan bulat. Diisi sekali saat barang dibuat. **Saat barang dibuat dengan `stok_awal` > 0, aplikasi otomatis mencatat satu transaksi** `jenis='masuk'`, `keterangan='Stok awal'`, `stok_sebelum=0`, `stok_sesudah=stok_awal` — supaya audit trail lengkap dari nol. |
| `stok_minimum` | ≥ 0, bilangan bulat. Default 0 = tanpa peringatan. |
| `stok` | Saldo berjalan, ≥ 0 (tidak pernah negatif — lihat §5). Hanya berubah lewat `transaksi_stok`, tidak boleh diedit langsung. |
| `aktif` | Soft delete: barang nonaktif disembunyikan dari daftar & tidak bisa ditransaksikan, tapi riwayatnya tetap utuh. Tidak ada hapus permanen barang yang sudah punya transaksi. |

### Kolom turunan (auto-calculate — TIDAK disimpan, dihitung aplikasi/laporan)

| Turunan | Rumus | Catatan |
|---------|-------|---------|
| `margin_rp` | `harga_jual − harga_beli` | Boleh negatif → aplikasi beri peringatan "margin negatif". |
| `margin_persen` | `(harga_jual − harga_beli) / harga_beli × 100`, dibulatkan 2 desimal | `NULL` bila `harga_beli = 0` (tidak bisa dibagi nol). |
| `nilai_stok` | `stok × harga_beli` | Nilai persediaan berjalan per barang; total = jumlah semua barang. |
| `status_stok` | `stok = 0` → **habis**; `0 < stok ≤ stok_minimum` → **menipis**; selain itu → **aman** | Dasar indikator visual stok menipis. Jika `stok_minimum = 0`, status "menipis" tidak pernah muncul (hanya "habis"). |

---

## 3. Tabel `transaksi_stok` (audit trail)

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

## 4. Tabel `pengguna` (satu akun)

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
| `kata_sandi_hash` | Wajib. Skema hash + mekanisme reset tanpa password lama mengikuti **spesifikasi Cipher (assignment #4)** — tabel ini menyediakan tempatnya, Cipher menentukan isi & kolom tambahannya (mis. token reset). Broto tidak merancang ulang area keamanan. |

---

## 5. Tabel `pengaturan` (key–value)

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

## 6. Contoh data & hasil acuan (untuk pengujian Testarossa)

**Barang contoh:**

| kode | nama | barcode | harga_beli | harga_jual | stok_awal | stok | stok_minimum | margin_rp | margin_persen | nilai_stok | status |
|------|------|---------|------------|------------|-----------|------|--------------|-----------|---------------|------------|--------|
| BRG-001 | Kopi Tubruk 250g | 8991234560017 | 18000 | 25000 | 50 | 37 | 10 | 7000 | 38.89% | 666000 | aman |
| BRG-002 | Gula Pasir 1kg | 8991234560024 | 16500 | 16000 | 20 | 8 | 10 | −500 | −3.03% | 132000 | menipis ⚠️ |
| BRG-003 | Teh Celup 25pcs | 8991234560031 | 0 | 12000 | 0 | 0 | 5 | 12000 | NULL | 0 | habis |

**Transaksi contoh (BRG-001):** stok awal 50 → keluar 10 (sisa 40) → masuk 5 (sisa 45) → keluar 8 (sisa 37). Setiap baris mencatat `dibuat_oleh`, `dibuat_pada`, `stok_sebelum`, `stok_sesudah`.

**Kasus batas yang harus lolos/ditolak:**

| Kasus | Harapan |
|-------|----------|
| Keluar tepat = sisa stok (37 dari 37) | Lolos, stok menjadi 0, status "habis" |
| Keluar 1 pcs melebihi sisa | **Ditolak** — stok negatif tidak boleh terjadi |
| Penyesuaian −37 dari stok 37 | Lolos (hasil tepat 0), `keterangan` wajib diisi |
| Penyesuaian −38 dari stok 37 | **Ditolak** |
| Daftar kode `brg-001` saat `BRG-001` ada | **Ditolak** (unik case-insensitive) |
| Barcode sama untuk dua barang | **Ditolak** |
| Ubah `satuan` jadi "dus" | **Ditolak** (terkunci 'pcs') |
| Hapus baris `transaksi_stok` | **Ditolak** (append-only; koreksi via penyesuaian) |
| Transaksi ke barang nonaktif | **Ditolak** |

---

## 7. Fakta vs Asumsi vs Belum Terkonfirmasi

**FAKTA (dari keputusan terkunci):** kode/SKU unik · barcode per item · satuan pcs · tanpa multi-gudang · harga beli & jual input manual · margin & nilai stok auto-calculate · ada stok awal + stok minimum · audit trail mencatat siapa/kapan/jenis/jumlah/stok sebelum–sesudah · satu akun + login · tolak stok negatif · indikator visual stok menipis.

**ASUMSI (keputusan desain Broto, boleh dikoreksi Rama/tim):**
1. `stok` disimpan sebagai saldo berjalan di `barang` (bukan dihitung ulang dari SUM transaksi tiap dibuka) — demi kecepatan; konsistensi dijaga oleh penulisan atomik §3.
2. Stok awal dicatat ganda: kolom `stok_awal` (referensi) + satu transaksi `masuk` "Stok awal" (audit lengkap).
3. Format `kode`: `[A-Z0-9-_]`, maks 30 karakter, unik case-insensitive.
4. `barcode` wajib diisi saat barang dibuat dan unik; maks 48 karakter ASCII printable.
5. `penyesuaian` memakai `jumlah` bertanda (negatif = koreksi turun) dan **wajib** mencantumkan `keterangan` alasan.
6. Soft delete via `aktif` (bukan hapus permanen) agar riwayat audit tidak patah.
7. Harga dalam Rupiah bilangan bulat (tanpa desimal/sen).
8. Waktu disimpan ISO 8601 UTC, ditampilkan dalam WIB (Asia/Jakarta).
9. Kunci bawaan `pengaturan` hanya 3; sisanya mengikuti Epthal/Cipher.

**BELUM TERKONFIRMASI (perlu dicek terhadap 18 jawaban final Rama):**
- Q-a. Apakah barcode memang wajib saat barang dibuat, atau boleh kosong lalu dilengkapi belakangan?
- Q-b. Apakah `kode`/SKU diketik manual oleh Rama atau dibuat otomatis oleh aplikasi (mis. nomor urut)?
- Q-c. Apakah ada aturan khusus untuk penyesuaian stok (mis. alasan tertentu yang dilarang) selain keterangan wajib?

---

## 8. Catatan untuk Gunet (implementasi)

1. Selalu tulis transaksi dalam satu DB transaction: `BEGIN IMMEDIATE; INSERT INTO transaksi_stok ...; UPDATE barang SET stok = ?, diubah_pada = ? WHERE id = ?; COMMIT;`
2. Validasi "tolak stok negatif" dilakukan **sebelum** INSERT dengan membaca `stok` terkini di dalam transaksi yang sama (hindari race walau satu pengguna).
3. Jangan pernah expose UPDATE/DELETE untuk `transaksi_stok` di lapisan aplikasi.
4. Kolom turunan (`margin_rp`, `margin_persen`, `nilai_stok`, `status_stok`) dihitung di query/aplikasi, mis. via VIEW:
   ```sql
   CREATE VIEW v_barang AS SELECT *, (harga_jual - harga_beli) AS margin_rp,
     CASE WHEN harga_beli > 0 THEN ROUND((harga_jual - harga_beli) * 100.0 / harga_beli, 2) END AS margin_persen,
     (stok * harga_beli) AS nilai_stok,
     CASE WHEN stok = 0 THEN 'habis' WHEN stok <= stok_minimum THEN 'menipis' ELSE 'aman' END AS status_stok
   FROM barang;
   ```
5. Skala: ratusan–ribuan SKU, satu pengguna — SQLite lebih dari cukup; index di `transaksi_stok(barang_id)` menjaga laporan riwayat tetap cepat.

---

*— Broto, Data Analyst. Dilaporkan kepada Manager (Muse).*
