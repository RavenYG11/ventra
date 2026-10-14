// SATU-SATUNYA tempat query SQLite di seluruh aplikasi.
// Aturan Gunet: UI tidak boleh query DB langsung — semua lewat service → repo → file ini.
import Database from '@tauri-apps/plugin-sql';
import migrasi001 from '../../migrasi/001_awal.sql?raw';

let db: Database | null = null;

/** Koneksi database tunggal (file stok.db di folder data aplikasi). */
export async function dapatkanDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:stok.db');
    await jalankanMigrasi(db);
  }
  return db;
}

const DAFTAR_MIGRASI: Array<[string, string]> = [['001_awal', migrasi001]];

async function jalankanMigrasi(database: Database): Promise<void> {
  await database.execute(
    `CREATE TABLE IF NOT EXISTS migrasi (
       versi TEXT PRIMARY KEY,
       diterapkan_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     )`
  );
  const sudah: Array<{ versi: string }> = await database.select('SELECT versi FROM migrasi');
  const terapkan = new Set(sudah.map((r) => r.versi));
  for (const [versi, sql] of DAFTAR_MIGRASI) {
    if (terapkan.has(versi)) continue;
    await eksekusiBatch(database, sql);
    await database.execute('INSERT INTO migrasi (versi) VALUES ($1)', [versi]);
  }
}

/** Menjalankan file .sql berisi banyak pernyataan (dipisah ';'). */
async function eksekusiBatch(database: Database, sql: string): Promise<void> {
  const tanpaKomentar = sql
    .split('\n')
    .filter((baris) => !baris.trim().startsWith('--'))
    .join('\n');
  const pernyataan = tanpaKomentar
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const p of pernyataan) {
    await database.execute(p);
  }
}
