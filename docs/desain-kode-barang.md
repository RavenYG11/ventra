# Desain Fitur "Kode Barang" — Ventra

**Disusun oleh:** Kurniatot (Software & Project Analyst) — 14 Okt 2026
**Status:** PROPOSAL — menunggu persetujuan Rama sebelum implementasi
**Latar:** Permintaan Rama 14 Okt 2026 ~20:03 WIB: (1) menu baru untuk CRUD "komponen barang"
(kategori, kode barang); (2) Kode Barang jadi entitas CRUD tersendiri; (3) mapping
kategori ↔ kode barang dikelola terpisah, karena 1 kategori bisa punya >1 kode barang;
(4) alur tambah barang: pilih kategori → pilih kode barang → nomor urut auto-generate.
**Acuan model saat ini:** `docs/model-data.md` (Broto) — tiap kategori menyimpan 1
`prefix_kode` + 1 counter `nomor_urut_terakhir`; kode barang = prefix + 7 digit.

---

## 1. Ringkasan perubahan

| Aspek | Sekarang | Usulan |
|---|---|---|
| Prefix kode | Kolom `kategori.prefix_kode` (1 kategori = 1 prefix) | Entitas `kode_barang` tersendiri (CRUD) |
| Counter nomor urut | Kolom `kategori.nomor_urut_terakhir` | Kolom `kode_barang.nomor_urut_terakhir` (per kode barang) |
| Hubungan kategori–kode | Implisit (prefix menempel di kategori) | Tabel mapping `kategori_kode_barang`, dikelola di UI tersendiri |
| Kardinalitas | 1 kategori : 1 prefix | 1 kategori : N kode barang (lihat §3 untuk batasannya) |
| Menu | Barang, Transaksi (+ tombol KATEGORI di halaman Barang) | Barang, Transaksi, **Master Data** (baru) |
| Form tambah barang | Pilih kategori → kode auto-generate | Pilih kategori → pilih kode barang → kode auto-generate + preview |

Prinsip yang TIDAK berubah: kode barang tetap auto-generate & final (tidak bisa diubah);
barcode = kode; satuan pcs; stok tidak boleh negatif; soft delete via `aktif`.

---

## 2. Definisi entitas

### 2.1 `kategori` (existing — disederhanakan)

Kolom `prefix_kode` dan `nomor_urut_terakhir` **pindah** ke `kode_barang` (lihat migrasi §6).
Yang tersisa:

```sql
CREATE TABLE kategori (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL UNIQUE,   -- 1-50 karakter, wajib
  aktif       INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

Di UI Master Data → tab Kategori, form kategori kini hanya berisi **nama**
(prefix tidak lagi diisi di sini — prefix dikelola di tab Kode Barang).

### 2.2 `kode_barang` (BARU)

Satu baris = satu pola kode (prefix + counter-nya sendiri).
Contoh: kategori "Elektronik" bisa punya `ELK-` (umum) dan `ELK-SRV-` (khusus servis).

```sql
CREATE TABLE kode_barang (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  kode                TEXT NOT NULL UNIQUE,   -- prefix, cth. 'BRG-','ELK-SRV-'
    CHECK (kode = upper(kode)
           AND length(kode) BETWEEN 1 AND 10
           AND kode NOT LIKE '% %'),          -- aturan sama seperti prefix_kode lama
  nama                TEXT NOT NULL,          -- nama tampilan, cth. 'Kode umum'
                                              -- 1-50 karakter; wajib (agar dropdown jelas)
  keterangan          TEXT,                   -- opsional
  nomor_urut_terakhir INTEGER NOT NULL DEFAULT 0 CHECK (nomor_urut_terakhir >= 0),
  aktif               INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

Aturan validasi:
- `kode`: wajib, unik **global** (antar semua kode barang), pola `[A-Z0-9-]`,
  1–10 karakter, tanpa spasi. Tidak bisa diubah setelah ada barang yang memakainya
  (aturan yang sama seperti `prefix_kode` dulu — kode historis tidak berubah).
- `nomor_urut_terakhir`: counter internal, **hanya berubah lewat pembuatan barang**
  (atomik, §4). Tidak bisa diedit manual dari UI, tidak pernah di-reset.
- `aktif`: soft delete. Kode barang nonaktif tidak muncul di dropdown form barang,
  tetapi barang lama yang memakainya tetap utuh.

### 2.3 `kategori_kode_barang` (BARU — tabel mapping)

Dikelola di UI tersendiri (tab Mapping), sesuai permintaan Rama
("integrasi kode barang dengan kategori itu juga beda sendiri").

```sql
CREATE TABLE kategori_kode_barang (
  kategori_id    INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  kode_barang_id INTEGER NOT NULL REFERENCES kode_barang(id) ON DELETE RESTRICT,
  dibuat_pada    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (kategori_id, kode_barang_id),
  UNIQUE (kode_barang_id)   -- penegak 1:N, lihat §3
);
```

### 2.4 `barang` (berubah — tambah referensi)

```sql
-- kolom baru:
kode_barang_id INTEGER REFERENCES kode_barang(id) ON DELETE RESTRICT
```

Kolom `kode` (teks final, cth. `BRG-0000001`) **tetap ada dan tetap final** —
tidak berubah. `kategori_id` tetap ada (barang tetap tahu kategorinya untuk
filter/laporan). Yang baru: barang juga mencatat **kode barang mana** yang
menghasilkannya, supaya nomor urut per kode barang bisa dipertanggungjawabkan
dan dropdown "kode barang" di form konsisten dengan data.

---

## 3. Relasi & aturan kardinalitas

**Keputusan desain (usulan): 1 kategori : N kode barang — dan 1 kode barang
hanya milik 1 kategori (strict 1:N).**

Artinya:
- Satu kategori boleh punya banyak kode barang (permintaan Rama — terpenuhi).
- Satu kode barang TIDAK boleh dipakai dua kategori.

Alasan:
1. Counter nomor urut menempel di `kode_barang`. Kalau satu kode dipakai dua
   kategori, nomor urutnya tercampur antar kategori (mis. `BRG-0000005` bisa jadi
   milik kategori A atau B) — membingungkan dan merusak makna "kode per kategori".
2. Aturan lama "prefix unik antar kategori" (model-data.md §2) dipertahankan
   dalam bentuk baru: `kode_barang.kode` unik global.
3. Tetap memakai tabel mapping (bukan FK langsung) supaya pengelolaannya
   terpisah seperti permintaan Rama — dan bila suatu hari Rama butuh M:N murni,
   cukup lepas constraint `UNIQUE (kode_barang_id)`, tanpa ubah struktur.

Validasi mapping di aplikasi:
- Setiap kategori **wajib punya minimal 1 kode barang aktif** yang ter-mapping.
  Kategori yang mapping-nya kosong tidak bisa dipakai untuk barang baru
  (form barang memblokir + pesan "kategori ini belum punya kode barang").
- Mapping tidak boleh diduplikasi (dijaga PRIMARY KEY).
- Unmap (hapus baris mapping) boleh kapan saja, **kecuali** itu mapping terakhir
  yang aktif untuk kategori tersebut.
- Hapus permanen `kode_barang` ditolak bila sudah pernah dipakai barang
  (`ON DELETE RESTRICT` dari `barang`); gunakan nonaktifkan (`aktif = 0`).

---

## 4. Aturan penomoran

1. Nomor urut dihitung **per `kode_barang`** (bukan per kategori, bukan global).
   Contoh: `BRG-` sudah sampai `BRG-0000007`, `ELK-` masih `ELK-0000002` —
   keduanya independen.
2. Format kode final **tetap**: `{kode}{7 digit zero-padded}`.
   Contoh: kode barang `ELK-SRV-`, counter 0 → 1 → **`ELK-SRV-0000001`**.
3. Pembuatan barang **atomik dalam satu statement SQL** (pola CTE yang sama
   seperti `tambahBarangAtomik` saat ini, hanya kunci counter-nya pindah dari
   `kategori` ke `kode_barang`):
   `UPDATE kode_barang SET nomor_urut_terakhir = ... + 1 WHERE id = ? AND aktif = 1`
   → `INSERT INTO barang (kode = kode || printf('%07d', nomor), kode_barang_id, kategori_id, ...)`
   → (opsional) transaksi "Stok awal". Semua dalam satu CTE — tidak ada nomor ganda.
4. Syarat pembuatan: kategori aktif + kode barang aktif + kode barang ter-mapping
   ke kategori tersebut. Ketiganya dicek di SQL yang sama (bila tidak terpenuhi,
   CTE kosong → operasi dibatalkan).
5. `kode` tetap final setelah dibuat; perubahan `kode_barang.kode` belakangan
   hanya berlaku untuk barang baru (kode lama tidak berubah) — sama seperti
   aturan `prefix_kode` dulu.

---

## 5. Alur UI

### 5.1 Menu baru: "Master Data" (nama usulan — lihat Q1 §8)

Menu utama menjadi: **Barang | Transaksi | Master Data**.
Isi halaman Master Data — tiga tab:

**Tab 1 — Kategori** (CRUD, pindahan dari tombol KATEGORI)
- Tabel: nama kategori, jumlah kode barang ter-mapping, jumlah barang, status.
- Tambah/ubah: hanya field **nama** (prefix sudah pindah ke tab Kode Barang).
- Nonaktifkan: soft delete; ditolak bila kategori masih punya barang aktif
  (aturan lama dipertahankan).

**Tab 2 — Kode Barang** (CRUD baru)
- Tabel: kode, nama, nomor urut terakhir (read-only, info), jumlah barang yang
  memakai, status.
- Tambah: kode (validasi pola `[A-Z0-9-]`, unik), nama, keterangan (opsional).
- Ubah: nama & keterangan boleh; `kode` hanya boleh bila belum pernah dipakai
  barang. Counter tidak bisa diubah.
- Nonaktifkan: soft delete; kode nonaktif hilang dari dropdown form barang.

**Tab 3 — Mapping Kategori ↔ Kode Barang** (kelola relasi, baru)
- Pilih kategori (dropdown) → tampil dua daftar: "sudah terhubung" dan
  "tersedia" (kode barang aktif yang belum terhubung ke kategori ini).
- Aksi: hubungkan / lepas. Validasi §3 berlaku (tidak bisa melepas mapping
  aktif terakhir; 1 kode barang tidak bisa dihubungkan ke 2 kategori —
  kode yang sudah terhubung ke kategori lain tidak muncul di "tersedia").

**Nasib tombol KATEGORI di halaman Barang:** dihapus — diganti link kecil
" Kelola di Master Data" agar tidak ada dua pintu untuk hal yang sama.

### 5.2 Perubahan form Tambah Barang

1. Dropdown **Kategori** (hanya yang aktif; kategori tanpa kode barang aktif
   tampil disabled dengan keterangan).
2. Dropdown **Kode Barang** — terisi otomatis sesuai mapping kategori yang
   dipilih (hanya yang aktif). Bila kategori hanya punya 1 kode barang aktif,
   langsung terpilih otomatis (lihat Q3 §8).
3. **Preview kode**: teks read-only "Kode berikutnya: `BRG-0000008`"
   (dihitung dari `nomor_urut_terakhir + 1`) — user tahu kode apa yang akan
   didapat sebelum menyimpan.
4. Field lain (nama, harga beli/jual, stok awal, stok minimum, keterangan)
   tidak berubah.

### 5.3 Daftar barang & pencarian

- Kolom tabel bertambah: **Kode Barang** (nilai `kode_barang.kode`, mis. `BRG-`)
  di samping kolom Kode — membantu bedakan pola.
- Pencarian tetap by nama/kode (tidak berubah).
- View `v_barang` diperbarui: JOIN `kode_barang` untuk kolom tampilan.

---

## 6. Rencana migrasi DB — `003_kode_barang`

File baru `migrasi/003_kode_barang.sql`, didaftarkan di `src/lib/db-worker.ts`
sebagai `['003_kode_barang', teksMigrasi003]` (pola sama seperti 001/002).
Berjalan otomatis sekali saat aplikasi dibuka setelah update — user tidak perlu
melakukan apa pun.

```sql
-- 1. Tabel baru
CREATE TABLE kode_barang (...);            -- skema §2.2
CREATE TABLE kategori_kode_barang (...);   -- skema §2.3

-- 2. Backfill kode_barang dari prefix tiap kategori (1:1 pada saat migrasi)
INSERT INTO kode_barang (kode, nama, nomor_urut_terakhir, aktif)
SELECT prefix_kode, 'Kode ' || nama, nomor_urut_terakhir, aktif
FROM kategori;

-- 3. Backfill mapping (setiap kategori ↔ kode_barang hasil konversinya)
INSERT INTO kategori_kode_barang (kategori_id, kode_barang_id)
SELECT k.id, kb.id
FROM kategori k JOIN kode_barang kb ON kb.kode = k.prefix_kode;

-- 4. Kolom referensi di barang + backfill via kategori (BUKAN via parsing teks kode —
--    aman walau prefix kategori pernah diubah setelah barang dibuat)
ALTER TABLE barang ADD COLUMN kode_barang_id INTEGER
  REFERENCES kode_barang(id) ON DELETE RESTRICT;
UPDATE barang SET kode_barang_id =
  (SELECT kb.id FROM kode_barang kb
     JOIN kategori k ON kb.kode = k.prefix_kode
    WHERE k.id = barang.kategori_id);

-- 5. Bersihkan kolom yang sudah pindah (SQLite ≥3.35 mendukung DROP COLUMN;
--    sqlite-wasm 3.53 sudah mendukung)
ALTER TABLE kategori DROP COLUMN prefix_kode;
ALTER TABLE kategori DROP COLUMN nomor_urut_terakhir;

-- 6. View v_barang diperbarui (tambah JOIN kode_barang untuk kolom tampilan)
DROP VIEW IF EXISTS v_barang;
CREATE VIEW v_barang AS ...;  -- definisi diperbarui, kolom turunan tetap sama
```

Jaminan keamanan:
- Semua langkah dalam **satu transaksi** — gagal di tengah = batal total,
  database kembali seperti semula (tidak setengah jalan).
- Tidak ada data yang hilang: setiap kategori pasti menghasilkan tepat 1
  kode_barang (prefix unik → tidak ada tabrakan); setiap barang pasti dapat
  `kode_barang_id` (join via `kategori_id`, bukan parsing string).
- Guard anti-wipe yang sudah ada (Assignment #22) tetap berlaku — migrasi
  tidak menghapus file database dalam kondisi apa pun.
- Setelah migrasi, aplikasi versi lama tidak bisa membaca DB baru
  (kolom `prefix_kode` hilang) — tidak masalah karena update lewat `git pull`
  selalu satu paket (kode + migrasi).

---

## 7. Dampak

### 7.1 Fitur backup (Unduh backup)
Tidak ada perubahan kode. Backup mengekspor **seluruh file database**,
sehingga tabel baru ikut terbawa otomatis. Yang perlu dipastikan saat QA:
restore backup lama (sebelum fitur ini) ke aplikasi baru → migrasi 003 berjalan
saat DB dibuka → data tetap utuh. (Skenario ini masuk checklist QA.)

### 7.2 Laporan Excel/PDF (nanti, belum ada)
Desain ini tidak menghalangi. Catatan untuk nanti: laporan daftar barang
dapat kolom tambahan "Kode Barang"; filter/kelompok per kategori tetap jalan
via `barang.kategori_id`.

### 7.3 Validasi (ringkasan untuk Gunet saat implementasi)

| Aturan | Penegak |
|---|---|
| `kode_barang.kode` unik global, pola `[A-Z0-9-]` | UNIQUE + CHECK di DB, validasi di form |
| Kode barang final unik (`barang.kode`) | Tetap: UNIQUE di DB (tidak berubah) |
| Counter hanya naik via pembuatan barang, atomik | CTE satu statement (§4) |
| Hapus kode_barang yang sudah dipakai barang | `ON DELETE RESTRICT` → tolak, arahkan ke nonaktifkan |
| Kategori wajib ≥1 kode barang aktif ter-mapping | Validasi aplikasi (form barang + tab Mapping) |
| 1 kode barang = 1 kategori | `UNIQUE (kode_barang_id)` di tabel mapping |
| Kategori nonaktif / kode nonaktif tidak bisa untuk barang baru | Filter `aktif = 1` di dropdown + cek di CTE |

### 7.4 Dokumen yang wajib ikut diperbarui saat implementasi
(sesuai aturan realtime-update) `docs/model-data.md` (§2 kategori, §3 barang),
`docs/desain-template-b.md` (bila ada perubahan form), `README.md`
(troubleshooting bila perlu), dan `docs/QA-CHECKLIST.md` (skenario migrasi 003).

---

## 8. Pertanyaan terbuka untuk Rama

**Q1. Nama menu baru** — usulan: **"Master Data"**. Alternatif: "Komponen",
"Data Pokok". Mana yang paling enak dipakai sehari-hari?

**Q2. Bolehkan 1 kode barang dipakai >1 kategori?** — Desain di atas mengusulkan
**tidak** (strict 1:N; 1 kode = 1 kategori) dengan alasan di §3. Kalau Rama
setuju, desain final. Kalau ternyata butuh (mis. kode `BRG-` dipakai lintas
kategori), desain tetap bisa — tinggal lepas satu constraint.

**Q3. Kategori yang hanya punya 1 kode barang** — saat tambah barang, dropdown
kode barang langsung terisi otomatis (usulan), atau tetap ditampilkan untuk
dipilih manual? (Usulan: otomatis — lebih cepat, preview kode tetap terlihat.)

**Q4. Bolehkan kategori tanpa kode barang sama sekali?** — Desain mengusulkan
**tidak boleh** (minimal 1, supaya barang selalu bisa dibuat). Setuju?

---

## 9. Estimasi implementasi (setelah desain disetujui — BUKAN bagian proposal ini)

Dicatat agar Rama tahu scope-nya bila desain ini disetujui:
file yang berubah: `migrasi/003_kode_barang.sql` (baru), `src/lib/db-worker.ts`
(daftarkan migrasi), `src/features/kode-barang/` (repo+service baru),
`src/features/kategori/` (hapus field prefix), `src/features/barang/`
(form + CTE penomoran baru), halaman Master Data (baru), `v_barang` (view).
Estimasi kasar: 1 assignment implementasi (Gunet) + 1 assignment QA
(Testarossa, termasuk skenario migrasi). Tidak ada perubahan arsitektur
database engine (worker/OPFS tetap sama).

---

*— Kurniatot, Software & Project Analyst. Dilaporkan kepada Manager (Muse).
Dokumen ini PROPOSAL — implementasi hanya setelah persetujuan Rama.*
