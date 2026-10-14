// Engine SQLite Ventra — berjalan di WEB WORKER (bukan main thread).
//
// KENAPA HARUS WORKER (temuan 2026-10-14, assignment #21): VFS opfs-sahpool
// memakai SyncAccessHandle. Di @sqlite.org/sqlite-wasm 3.53.4,
// installOpfsSAHPoolVfs() MENOLAK dengan "Missing required OPFS APIs." bila
// `FileSystemFileHandle.prototype.createSyncAccessHandle` tidak ada — dan API
// itu HANYA tersedia di Web Worker, tidak di main thread Chrome. Demo resmi
// (sqlite/sqlite-wasm → demos/sahpool-demo) membuktikan pola yang benar:
// main thread HANYA me-spawn worker; worker yang install VFS + buka DB.
// Memanggil installOpfsSAHPoolVfs di main thread = gagal pasti.
//
// Pola komunikasi: main thread (lib/db.ts) mengirim {id, op, sql?, params?}
// via postMessage; worker membalas {id, ok:true, ...hasil} atau
// {id, ok:false, error}. Semua byte database ditransfer (bukan di-copy)
// untuk operasi export.
declare const self: DedicatedWorkerGlobalScope;

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// URL file sqlite3.wasm setelah di-bundle Vite (exports "./sqlite3.wasm"
// di package.json @sqlite.org/sqlite-wasm; pola ?url = aset statis Vite).
import urlWasm from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import migrasi001 from '../../migrasi/001_awal.sql?raw';
import migrasi002 from '../../migrasi/002_audit_keamanan.sql?raw';

// ---------------------------------------------------------------------------
// Tipe minimal API sqlite-wasm yang dipakai (salinan dari lib/db.ts agar
// worker mandiri — tidak mengimpor apa pun dari main thread).
// ---------------------------------------------------------------------------

/** Nilai yang boleh di-bind ke parameter query. */
export type NilaiParam = string | number | bigint | null | Uint8Array;

interface DbWasm {
  exec(sql: string): void;
  exec(opsi: { sql: string; bind?: NilaiParam[] }): void;
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

// Tipe publik paket sengaja tidak mencantumkan parameter init, padahal
// runtime-nya menerima opsi Emscripten standar (termasuk locateFile).
const muatSqlite3 = sqlite3InitModule as unknown as (
  opsi?: { locateFile?: (nama: string) => string }
) => Promise<Sqlite3Api>;

// Nama file database di OPFS. VFS opfs-sahpool MEWAJIBKAN path absolut.
const NAMA_FILE_DB = '/stok.db';

let pool: PoolUtil | null = null;
let db: DbWasm | null = null;

/** Inisialisasi engine: WASM → VFS OPFS → buka DB → migrasi. Idempoten. */
async function initDb(): Promise<void> {
  if (db) return;
  // 1. Muat engine SQLite (WASM). locateFile memberi tahu Emscripten di mana
  //    sqlite3.wasm berada setelah di-bundle Vite.
  const sqlite3 = await muatSqlite3({
    locateFile: (nama) => (nama === 'sqlite3.wasm' ? urlWasm : nama),
  });

  // 2. Aktifkan VFS opfs-sahpool. BERHASIL karena worker memiliki
  //    createSyncAccessHandle (alasan file ini ada).
  if (typeof sqlite3.installOpfsSAHPoolVfs !== 'function') {
    throw new Error('Browser ini tidak mendukung penyimpanan database lokal (OPFS).');
  }
  // CATATAN: opsi `preserveOnInitFailure` (anti-wipe storage saat init gagal)
  // baru didukung sqlite-wasm 3.54; di 3.53.4 flag ini diabaikan dengan aman.
  // Upgrade ke ≥3.54 segera setelah tersedia di npm, lalu flag ini aktif otomatis.
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ preserveOnInitFailure: true });
  } catch (e) {
    const sebab = e instanceof Error ? e.message : String(e);
    throw new Error('Gagal membuka database lokal (' + sebab + ').');
  }

  // 3. Buka (atau buat) database + jalankan migrasi.
  try {
    db = new pool.OpfsSAHPoolDb(NAMA_FILE_DB);
    jalankanMigrasi(db);
  } catch (e) {
    const sebab = e instanceof Error ? e.message : String(e);
    throw new Error('Gagal menyiapkan database (' + sebab + ').');
  }
}

function wajibSiap(): { pool: PoolUtil; db: DbWasm } {
  if (!pool || !db) throw new Error('Database belum diinisialisasi — kirim op init dulu.');
  return { pool, db };
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

function jalankanMigrasi(database: DbWasm): void {
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
// Protokol pesan dengan main thread.
// ---------------------------------------------------------------------------

interface PesanMasuk {
  id: number;
  op: 'init' | 'select' | 'execute' | 'export' | string;
  sql?: string;
  params?: NilaiParam[];
}

self.onmessage = async (ev: MessageEvent<PesanMasuk>) => {
  const data = ev.data ?? {};
  const id = typeof data.id === 'number' ? data.id : -1;
  const op = data.op;
  const sql = data.sql ?? '';
  const params = Array.isArray(data.params) ? data.params : [];
  const balasOk = (hasil: Record<string, unknown>, transfer?: Transferable[]) => {
    self.postMessage({ id, ok: true, ...hasil }, transfer ?? []);
  };
  const balasGagal = (e: unknown) => {
    const pesan = e instanceof Error ? e.message : String(e);
    self.postMessage({ id, ok: false, error: pesan });
  };
  try {
    if (op === 'init') {
      await initDb();
      balasOk({});
    } else if (op === 'select') {
      const { db: koneksi } = wajibSiap();
      const rows = koneksi.selectObjects(normalisasiParam(sql), params);
      balasOk({ rows });
    } else if (op === 'execute') {
      const { db: koneksi } = wajibSiap();
      koneksi.exec({ sql: normalisasiParam(sql), bind: params });
      // last_insert_rowid() = rowid dari INSERT terakhir di koneksi ini.
      // Aman: worker memakai SATU koneksi, dan pesan diproses berurutan,
      // jadi tidak ada interleaving antar pemanggil.
      const baris = koneksi.selectObjects('SELECT last_insert_rowid() AS id') as Array<{
        id: number;
      }>;
      balasOk({ lastInsertId: Number(baris[0]?.id ?? 0) });
    } else if (op === 'export') {
      const { pool: util } = wajibSiap();
      // exportFile() membaca file database dari OPFS tanpa menutup koneksi.
      const bytes = util.exportFile(NAMA_FILE_DB);
      // Transfer buffer (bukan copy) — main thread menerima Uint8Array utuh.
      balasOk({ bytes }, [bytes.buffer]);
    } else {
      throw new Error('Operasi worker database tidak dikenal: ' + String(op));
    }
  } catch (e) {
    balasGagal(e);
  }
};
