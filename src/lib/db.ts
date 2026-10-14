// SATU-SATUNYA tempat query SQLite di seluruh aplikasi.
// Aturan Gunet: UI tidak boleh query DB langsung — semua lewat service → repo → file ini.
//
// EDISI WEB (pivot 2026-10-14, assignment #18 — keputusan Rama: tanpa Tauri/Rust).
// SQLite berjalan sebagai WebAssembly di browser via @sqlite.org/sqlite-wasm;
// data PERSISTEN di OPFS (Origin-Private FileSystem) memakai VFS "opfs-sahpool".
// Tetap 100% lokal & offline — tidak ada server, tidak ada cloud.
//
// Sumber:
// - Cara pakai VFS opfs-sahpool (tidak butuh header COOP/COEP, path WAJIB absolut,
//   installOpfsSAHPoolVfs → poolUtil.OpfsSAHPoolDb):
//   https://sqlite.org/wasm/doc/trunk/persistence.md ("OPFS SyncAccessHandle Pool VFS")
// - Pola init + locateFile untuk bundler (Vite):
//   https://github.com/sqlite/sqlite-wasm (demos/main-thread-demo, demos/sahpool-demo)
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// URL file sqlite3.wasm setelah di-bundle Vite (exports "./sqlite3.wasm"
// di package.json @sqlite.org/sqlite-wasm; pola ?url = aset statis Vite).
import urlWasm from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import migrasi001 from '../../migrasi/001_awal.sql?raw';
import migrasi002 from '../../migrasi/002_audit_keamanan.sql?raw';

// ---------------------------------------------------------------------------
// Tipe minimal API sqlite-wasm yang dipakai aplikasi.
// (Sengaja minimal agar mudah dibaca developer junior; tipe lengkap tersedia di
//  node_modules/@sqlite.org/sqlite-wasm/dist/index.d.mts)
// ---------------------------------------------------------------------------

/** Nilai yang boleh di-bind ke parameter query. */
export type NilaiParam = string | number | bigint | null | Uint8Array;

interface OpsiExec {
  sql: string;
  bind?: NilaiParam[];
}

/** Subset oo1.DB yang dipakai Ventra. */
interface DbWasm {
  exec(sql: string): void;
  exec(opsi: OpsiExec): void;
  selectObjects(sql: string, bind?: NilaiParam[]): Array<Record<string, unknown>>;
}

/** Hasil installOpfsSAHPoolVfs() ("PoolUtil" di dokumentasi resmi). */
interface PoolUtil {
  OpfsSAHPoolDb: new (namaFile: string) => DbWasm;
  exportFile(namaFile: string): Uint8Array;
}

interface Sqlite3Api {
  installOpfsSAHPoolVfs: (opts?: Record<string, unknown>) => Promise<PoolUtil>;
}

// Tipe publik paket sengaja tidak mencantumkan parameter init (lihat catatan di
// dist/index.d.mts), padahal runtime-nya menerima opsi Emscripten standar
// (termasuk locateFile — diverifikasi di dist/index.mjs → findWasmBinary()).
const muatSqlite3 = sqlite3InitModule as unknown as (
  opsi?: { locateFile?: (nama: string) => string }
) => Promise<Sqlite3Api>;

/** Antarmuka database yang dipakai repo-*.ts (kompatibel dengan edisi Tauri). */
export interface DbVentra {
  /** SELECT → array baris (objek). Contoh: db.select<Barang[]>(sql, [kataKunci]) */
  select<T>(sql: string, params?: NilaiParam[]): Promise<T>;
  /** INSERT/UPDATE/DELETE/DDL — satu statement. */
  execute(sql: string, params?: NilaiParam[]): Promise<void>;
}

// Nama file database di OPFS. VFS opfs-sahpool MEWAJIBKAN path absolut.
const NAMA_FILE_DB = '/stok.db';

let pool: PoolUtil | null = null;
let db: DbWasm | null = null;
let janjiInisialisasi: Promise<DbVentra> | null = null;

/**
 * Koneksi database tunggal. Inisialisasi (load WASM + buka OPFS + migrasi)
 * hanya terjadi sekali, lalu dipakai ulang — aman dipanggil berkali-kali.
 */
export function dapatkanDb(): Promise<DbVentra> {
  if (!janjiInisialisasi) janjiInisialisasi = inisialisasi();
  return janjiInisialisasi;
}

async function inisialisasi(): Promise<DbVentra> {
  // 1. Muat engine SQLite (WASM). locateFile memberi tahu Emscripten di mana
  //    sqlite3.wasm berada setelah di-bundle Vite (nama file hasil build
  //    mengandung hash, jadi tidak bisa ditebak).
  const sqlite3 = await muatSqlite3({
    locateFile: (nama) => (nama === 'sqlite3.wasm' ? urlWasm : nama),
  });

  // 2. Aktifkan VFS opfs-sahpool (penyimpanan persisten di OPFS).
  //    Gagal bila: browser terlalu lama (tanpa API OPFS), atau database sedang
  //    dibuka di tab/jendela lain (satu file = satu koneksi).
  if (typeof sqlite3.installOpfsSAHPoolVfs !== 'function') {
    throw new Error('Browser ini tidak mendukung penyimpanan database lokal (OPFS).');
  }
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs();
  } catch (e) {
    // JANGAN telan error asli — tampilkan agar bisa didiagnosis.
    const sebab = e instanceof Error ? e.message : String(e);
    throw new Error(
      'Gagal membuka database lokal (' + sebab + '). Kemungkinan database sedang ' +
        'dibuka di tab lain, atau mode private/incognito memblokir penyimpanan. ' +
        'Tutup tab Ventra lain lalu muat ulang halaman ini.'
    );
  }

  // 3. Buka (atau buat) database. Satu koneksi di main thread — tidak ada
  //    connection pool, jadi urutan query selalu terjaga.
  db = new pool.OpfsSAHPoolDb(NAMA_FILE_DB);
  await jalankanMigrasi(db);

  const koneksi = db;
  const bungkus: DbVentra = {
    async select<T>(sql: string, params: NilaiParam[] = []): Promise<T> {
      return koneksi.selectObjects(normalisasiParam(sql), params) as unknown as T;
    },
    async execute(sql: string, params: NilaiParam[] = []): Promise<void> {
      koneksi.exec({ sql: normalisasiParam(sql), bind: params });
    },
  };
  return bungkus;
}

/**
 * Ubah placeholder gaya `$1, $2, …` (warisan edisi Tauri/plugin-sql) menjadi
 * `?1, ?2, …` yang dipahami binding array oo1 (bind by position).
 * AMAN dipakai di Ventra: tidak ada SQL di aplikasi ini yang memakai karakter
 * '$' di dalam string literal.
 */
function normalisasiParam(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?$1');
}

// ---------------------------------------------------------------------------
// Migrasi skema — skema DB TIDAK berubah dari edisi Tauri (keputusan pivot).
// ---------------------------------------------------------------------------

const DAFTAR_MIGRASI: Array<[versi: string, sql: string]> = [
  ['001_awal', migrasi001],
  ['002_audit_keamanan', migrasi002],
];

async function jalankanMigrasi(database: DbWasm): Promise<void> {
  database.exec(
    `CREATE TABLE IF NOT EXISTS migrasi (
       versi TEXT PRIMARY KEY,
       diterapkan_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     )`
  );
  const sudah = database.selectObjects('SELECT versi FROM migrasi') as Array<{ versi: string }>;
  const terapkan = new Set(sudah.map((r) => r.versi));
  for (const [versi, sql] of DAFTAR_MIGRASI) {
    if (terapkan.has(versi)) continue;
    // db.exec menerima SQL multi-statement sekaligus (migrasi = DDL + seed).
    database.exec(sql);
    database.exec({ sql: 'INSERT INTO migrasi (versi) VALUES (?)', bind: [versi] });
  }
}

// ---------------------------------------------------------------------------
// Ekspor database utuh (dipakai fitur "Unduh Backup" — lihat lib/backup.ts).
// ---------------------------------------------------------------------------

/**
 * Mengekspor SELURUH isi database sebagai byte array file .db.
 * Memakai poolUtil.exportFile() (dokumentasi resmi) — membaca file database
 * dari OPFS tanpa menutup koneksi yang sedang berjalan.
 */
export async function eksporDatabase(): Promise<Uint8Array> {
  await dapatkanDb();
  if (!pool) throw new Error('Database belum terinisialisasi.');
  return pool.exportFile(NAMA_FILE_DB);
}
