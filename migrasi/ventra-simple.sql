-- ventra-simple.sql — SKEMA FRESH Ventra Simple (2026-10-14, Gunet).
--
-- Dipakai di file database BARU /ventra-simple.db (OPFS, path absolut — wajib
-- untuk VFS opfs-sahpool). Skema lama (migrasi 001/002/003) TIDAK dipakai lagi
-- dan TIDAK diimpor worker — file-file lama hanya arsip di repo.
--
-- Satu-satunya sumber kebenaran skema: docs/spec-ventra-simple.md §2 +
-- docs/arsitektur-ventra-simple.md §3.

-- Master barang: 1 baris = 1 jenis barang. Nama UNIK case-insensitive
-- (satu-satunya identitas barang — tidak ada kode barang).
CREATE TABLE IF NOT EXISTS barang (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  harga_beli  REAL    NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual  REAL    NOT NULL DEFAULT 0 CHECK (harga_jual >= 0)
);

-- Satu akun pemilik aplikasi (dipakai LoginPage + src/features/pengguna).
CREATE TABLE IF NOT EXISTS pengguna (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  nama_pengguna   TEXT NOT NULL UNIQUE,
  kata_sandi_hash TEXT NOT NULL,
  dibuat_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  diubah_pada     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Audit keamanan login & reset password (dipakai src/features/pengguna).
CREATE TABLE IF NOT EXISTS audit_keamanan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  peristiwa   TEXT NOT NULL CHECK (peristiwa IN ('login', 'password_reset')),
  akun        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('berhasil', 'gagal')),
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Pelacak skema yang sudah diterapkan (untuk perubahan skema di masa depan).
CREATE TABLE IF NOT EXISTS migrasi (
  versi           TEXT PRIMARY KEY,
  diterapkan_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
