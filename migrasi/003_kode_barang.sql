-- 003_kode_barang.sql — fitur Kode Barang (assignment #28, 14 Okt 2026).
-- Keputusan final Rama:
--   Q1: menu baru bernama "Product Management".
--   Q2: relasi kategori <-> kode barang M:N FLEKSIBEL PENUH
--       (SENGAJA tanpa UNIQUE(kode_barang_id) di tabel mapping).
--   Q3: dropdown kode barang auto-fill bila kategori hanya punya 1.
--   Q4: kategori wajib punya minimal 1 kode barang aktif.
-- Berjalan otomatis sekali saat aplikasi dibuka setelah update (pola migrasi
-- yang sama seperti 001/002 di src/lib/db-worker.ts).
--
-- ATOMIK (QA MIG-07): seluruh skrip dalam SATU transaksi — gagal di tengah =
-- batal total, database kembali seperti semula. Bila exec melempar, worker
-- (db-worker.ts) melakukan ROLLBACK sebelum mencatat versi, sehingga retry
-- berikutnya mulai dari kondisi bersih. Backfill memakai INSERT OR IGNORE
-- (idempoten) sebagai pengaman lapis kedua.
BEGIN IMMEDIATE;

-- 1. Entitas kode barang: satu baris = satu pola kode (prefix + counter sendiri).
CREATE TABLE IF NOT EXISTS kode_barang (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  kode                TEXT NOT NULL UNIQUE
                      CHECK (kode = upper(kode)
                             AND length(kode) BETWEEN 1 AND 10
                             AND kode NOT LIKE '% %'),
  nama                TEXT NOT NULL CHECK (length(nama) BETWEEN 1 AND 50),
  keterangan          TEXT,
  nomor_urut_terakhir INTEGER NOT NULL DEFAULT 0 CHECK (nomor_urut_terakhir >= 0),
  aktif               INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 2. Tabel mapping M:N — dikelola di tab Mapping (Product Management).
--    SENGAJA tanpa UNIQUE(kode_barang_id): 1 kode barang boleh dipakai
--    banyak kategori (Q2). Duplikasi pasangan dicegah PRIMARY KEY.
CREATE TABLE IF NOT EXISTS kategori_kode_barang (
  kategori_id    INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  kode_barang_id INTEGER NOT NULL REFERENCES kode_barang(id) ON DELETE RESTRICT,
  dibuat_pada    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (kategori_id, kode_barang_id)
);

-- 3. Backfill: tiap kategori -> 1 kode_barang (relasi 1:1 pada saat migrasi).
--    substr(...,1,50) menjaga CHECK length(nama) bila nama kategori 50 char.
--    OR IGNORE: idempoten bila migrasi dijalankan ulang setelah gagal.
INSERT OR IGNORE INTO kode_barang (kode, nama, nomor_urut_terakhir, aktif)
SELECT prefix_kode,
       substr('Kode ' || nama, 1, 50),
       nomor_urut_terakhir,
       aktif
FROM kategori;

-- 4. Backfill mapping 1:1 awal (setiap kategori <-> kode_barang hasil konversinya).
INSERT OR IGNORE INTO kategori_kode_barang (kategori_id, kode_barang_id)
SELECT k.id, kb.id
FROM kategori k JOIN kode_barang kb ON kb.kode = k.prefix_kode;

-- 5. Referensi di barang — via JOIN kategori (BUKAN parsing string kode),
--    aman walau prefix kategori pernah diubah setelah barang dibuat.
ALTER TABLE barang ADD COLUMN kode_barang_id INTEGER
  REFERENCES kode_barang(id) ON DELETE RESTRICT;
UPDATE barang SET kode_barang_id = (
  SELECT kb.id
  FROM kode_barang kb JOIN kategori k ON kb.kode = k.prefix_kode
  WHERE k.id = barang.kategori_id
);

-- 6. Kolom yang sudah pindah dibersihkan.
--    View di-drop DULU: SQLite menolak RENAME TABLE bila ada view rusak
--    yang merujuk nama tabel yang sedang di-rename.
--    CATATAN: SQLite MENOLAK "DROP COLUMN" untuk kolom ber-constraint UNIQUE
--    (kasus prefix_kode: "cannot drop UNIQUE column"). Solusinya: rebuild tabel
--    (prosedur 12-langkah resmi SQLite). FK enforcement default OFF di aplikasi
--    ini, jadi DROP/RENAME aman; referensi FK by-name tetap resolve ke tabel baru.
DROP VIEW IF EXISTS v_barang;
CREATE TABLE kategori_baru (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL UNIQUE,
  aktif       INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO kategori_baru (id, nama, aktif, dibuat_pada)
SELECT id, nama, aktif, dibuat_pada FROM kategori;
DROP TABLE kategori;
ALTER TABLE kategori_baru RENAME TO kategori;

-- 7. View v_barang diperbarui: tambah kolom kode_barang_kode untuk tampilan.
CREATE VIEW v_barang AS
SELECT
  b.*,
  k.nama AS kategori_nama,
  kb.kode AS kode_barang_kode,
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
JOIN kategori k ON k.id = b.kategori_id
LEFT JOIN kode_barang kb ON kb.id = b.kode_barang_id;

COMMIT;
