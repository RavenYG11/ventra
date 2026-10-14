-- 002_audit_keamanan.sql — tabel audit keamanan (login & reset password).
-- Memenuhi stock-barang-mvp-v1.md §8 (Cipher): setiap kejadian login dan
-- reset password dicatat satu baris append-only: peristiwa + timestamp
-- (UTC, ditampilkan WIB) + akun + status (berhasil/gagal).
-- Catatan jujur (§8): log mencatat BAHWA reset terjadi, bukan SIAPA yang
-- melakukannya — alur reset tidak memverifikasi identitas pelaku.
-- Diterapkan sekali via src/lib/db.ts (tabel `migrasi`).

CREATE TABLE IF NOT EXISTS audit_keamanan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  peristiwa   TEXT NOT NULL CHECK (peristiwa IN ('login', 'password_reset')),
  akun        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('berhasil', 'gagal')),
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_keamanan_waktu ON audit_keamanan (dibuat_pada);
