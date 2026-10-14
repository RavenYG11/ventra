-- 001_awal.sql — skema awal Ventra v0.1
-- Sumber: specs/model-data.md (Broto). Diterapkan sekali via src/lib/db.ts.

-- Kategori barang: pola kode dikonfigurasi per kategori (keputusan final Rama).
CREATE TABLE IF NOT EXISTS kategori (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nama              TEXT NOT NULL UNIQUE,
  prefix_kode       TEXT NOT NULL UNIQUE
                    CHECK (prefix_kode = upper(prefix_kode)
                           AND length(prefix_kode) BETWEEN 1 AND 10
                           AND prefix_kode NOT LIKE '% %'),
  nomor_urut_terakhir INTEGER NOT NULL DEFAULT 0 CHECK (nomor_urut_terakhir >= 0),
  aktif             INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Master barang: satu baris = satu SKU.
-- Barcode = kode (keputusan final model-data.md §2): TIDAK ada kolom barcode
-- terpisah. Barcode Code128 di-generate dari `kode` dan tampil di UI saja.
CREATE TABLE IF NOT EXISTS barang (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT NOT NULL UNIQUE,
  nama          TEXT NOT NULL,
  kategori_id   INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  satuan        TEXT NOT NULL DEFAULT 'pcs' CHECK (satuan = 'pcs'),
  harga_beli    INTEGER NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual    INTEGER NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),
  stok          INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  stok_awal     INTEGER NOT NULL DEFAULT 0 CHECK (stok_awal >= 0),
  stok_minimum  INTEGER NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),
  keterangan    TEXT,
  aktif         INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  diubah_pada   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_barang_kode_nocase ON barang(kode COLLATE NOCASE);

-- Riwayat pergerakan stok (append-only). Dipakai penuh mulai v0.2;
-- v0.1 hanya menulis baris "Stok awal" saat barang dibuat.
CREATE TABLE IF NOT EXISTS transaksi_stok (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  barang_id    INTEGER NOT NULL REFERENCES barang(id) ON DELETE RESTRICT,
  jenis        TEXT NOT NULL CHECK (jenis IN ('masuk','keluar','penyesuaian')),
  jumlah       INTEGER NOT NULL,
  stok_sebelum INTEGER NOT NULL CHECK (stok_sebelum >= 0),
  stok_sesudah INTEGER NOT NULL CHECK (stok_sesudah >= 0),
  referensi    TEXT,
  keterangan   TEXT,
  dibuat_oleh  TEXT NOT NULL,
  dibuat_pada  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transaksi_barang ON transaksi_stok(barang_id, id);

-- Satu akun pemilik aplikasi (keputusan final Rama).
CREATE TABLE IF NOT EXISTS pengguna (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  nama_pengguna   TEXT NOT NULL UNIQUE,
  kata_sandi_hash TEXT NOT NULL,
  dibuat_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  diubah_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Konfigurasi aplikasi (key-value).
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci       TEXT PRIMARY KEY,
  nilai       TEXT NOT NULL,
  diubah_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO pengaturan (kunci, nilai) VALUES
  ('nama_toko', ''),
  ('stok_minimum_default', '0'),
  ('peringatan_stok_menipis', '1');

-- Pelacak migrasi yang sudah diterapkan.
CREATE TABLE IF NOT EXISTS migrasi (
  versi           TEXT PRIMARY KEY,
  diterapkan_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- View barang + kolom turunan (margin, nilai stok, status).
-- nilai_stok = stok × harga_beli (keputusan final Rama, 14 Okt 2026).
CREATE VIEW IF NOT EXISTS v_barang AS
SELECT
  b.*,
  k.nama AS kategori_nama,
  (b.harga_jual - b.harga_beli) AS margin_rp,
  CASE WHEN b.harga_beli > 0
       THEN ROUND((b.harga_jual - b.harga_beli) * 100.0 / b.harga_beli, 2)
  END AS margin_persen,
  (b.stok * b.harga_beli) AS nilai_stok,
  CASE WHEN b.stok = 0 THEN 'habis'
       WHEN b.stok <= b.stok_minimum THEN 'menipis'
       ELSE 'aman'
  END AS status_stok
FROM barang b
JOIN kategori k ON k.id = b.kategori_id;

-- Seed: kategori bawaan supaya pola BRG-0000001 langsung bisa dipakai.
-- Prefix 'BRG-' sesuai contoh final di specs/model-data.md §2.
INSERT OR IGNORE INTO kategori (nama, prefix_kode) VALUES ('Umum', 'BRG-');
