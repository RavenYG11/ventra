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
// INSTRUMENTASI (assignment #22, 2026-10-14 — STOP-RULE meeting #3: dilarang
// fix buta tanpa bukti): tiap tahap initDb() berlabel fase
// (WASM_LOAD_FAILED / OPFS_UNAVAILABLE / VFS_INSTALL_FAILED / DB_OPEN_FAILED /
// MIGRATION_FAILED); self.onerror + self.onunhandledrejection melaporkan ke
// main thread via {id:-1}; guard pastikanOpfsBisaDitulis() memastikan OPFS
// bisa ditulis SEBELUM install VFS (anti-wipe: init VFS yang gagal bisa
// me-wipe storage bila tanpa preserveOnInitFailure).
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

// ---------------------------------------------------------------------------
// Diagnostik: tangkap error runtime yang lolos dari handler pesan.
// (Catatan jujur: bila 4 static import di atas gagal, modul tidak pernah
// dievaluasi sehingga handler ini tidak terpasang — kasus itu ditangkap
// worker.onerror di main thread sebagai VDB-W01.)
// ---------------------------------------------------------------------------

self.onerror = (ev: Event) => {
  const pesan = ev instanceof ErrorEvent ? ev.message || '(kosong)' : String(ev);
  try {
    self.postMessage({
      id: -1,
      ok: false,
      fase: 'WORKER_RUNTIME_ERROR',
      error: '[WORKER_RUNTIME_ERROR] ' + pesan,
    });
  } catch {
    // Abaikan — tidak ada lagi jalur pelaporan.
  }
};

self.onunhandledrejection = (ev: PromiseRejectionEvent) => {
  const r = ev.reason;
  const pesan = r instanceof Error ? r.message : String(r);
  try {
    self.postMessage({
      id: -1,
      ok: false,
      fase: 'WORKER_UNHANDLED_REJECTION',
      error: '[WORKER_UNHANDLED_REJECTION] ' + pesan,
    });
  } catch {
    // Abaikan — tidak ada lagi jalur pelaporan.
  }
};

/** Bungkus error tiap fase init dengan kode stabil agar bisa didiagnosis. */
function galatFase(kode: string, e: unknown): Error {
  const sebab = e instanceof Error ? e.message : String(e);
  return new Error('[' + kode + '] ' + sebab);
}

/**
 * GUARD ANTI-WIPE: pastikan OPFS bisa dibaca & ditulis SEBELUM install VFS.
 * Alasan: bila installOpfsSAHPoolVfs() gagal, perilaku default paket =
 * removeVfs() (wipe storage). Guard ini memastikan VFS tidak disentuh sama
 * sekali bila OPFS memang tidak tersedia/terblokir — jadi tidak ada risiko
 * data terhapus oleh percobaan init yang gagal.
 */
async function pastikanOpfsBisaDitulis(): Promise<void> {
  // Cast defensif: hindari ketergantungan pada versi tepat lib TS worker.
  const nav = navigator as unknown as {
    storage?: { getDirectory?: () => Promise<unknown> };
  };
  const storage = nav.storage;
  if (!storage || typeof storage.getDirectory !== 'function') {
    throw new Error('navigator.storage.getDirectory tidak tersedia di worker ini.');
  }
  const root = (await storage.getDirectory()) as {
    getFileHandle: (
      nama: string,
      opsi?: { create?: boolean }
    ) => Promise<{
      createSyncAccessHandle: () => Promise<{
        write: (data: Uint8Array, opsi?: { at?: number }) => number;
        truncate: (ukuran: number) => void;
        close: () => Promise<void>;
      }>;
    }>;
    removeEntry: (nama: string) => Promise<void>;
  };
  const namaUji = '.ventra-uji-tulis';
  let tutup: (() => Promise<void>) | null = null;
  try {
    const fh = await root.getFileHandle(namaUji, { create: true });
    const sah = await fh.createSyncAccessHandle();
    tutup = () => sah.close();
    const data = new TextEncoder().encode('ventra-ok');
    const n = sah.write(data, { at: 0 });
    if (n !== data.length) throw new Error('Tulis uji OPFS tidak lengkap.');
    sah.truncate(data.length);
  } finally {
    if (tutup) {
      try {
        await tutup();
      } catch {
        // Abaikan — file uji tetap dihapus di bawah.
      }
    }
    try {
      await root.removeEntry(namaUji);
    } catch {
      // Abaikan — file uji kecil, tidak mengganggu.
    }
  }
}

/** Inisialisasi engine: WASM → guard OPFS → VFS → buka DB → migrasi. Idempoten. */
async function initDb(): Promise<void> {
  if (db) return;

  // FASE 1 — muat engine SQLite (WASM).
  let sqlite3: Sqlite3Api;
  try {
    if (!urlWasm) {
      throw new Error('URL sqlite3.wasm kosong — bundler tidak menyertakan file WASM (cek pola ?url).');
    }
    sqlite3 = await muatSqlite3({
      locateFile: (nama) => (nama === 'sqlite3.wasm' ? urlWasm : nama),
    });
  } catch (e) {
    throw galatFase('WASM_LOAD_FAILED', e);
  }

  // FASE 1b — guard OPFS (anti-wipe): jangan sentuh VFS bila OPFS buntu.
  try {
    await pastikanOpfsBisaDitulis();
  } catch (e) {
    throw galatFase('OPFS_UNAVAILABLE', e);
  }

  // FASE 2 — aktifkan VFS opfs-sahpool. BERHASIL karena worker memiliki
  // createSyncAccessHandle (alasan file ini ada).
  if (typeof sqlite3.installOpfsSAHPoolVfs !== 'function') {
    throw galatFase('VFS_INSTALL_FAILED', 'installOpfsSAHPoolVfs bukan fungsi pada objek sqlite3.');
  }
  // CATATAN: opsi `preserveOnInitFailure` (anti-wipe storage saat init gagal)
  // baru didukung sqlite-wasm 3.54; di 3.53.4 flag ini diabaikan dengan aman.
  // Upgrade ke ≥3.54 segera setelah tersedia di npm, lalu flag ini aktif otomatis.
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ preserveOnInitFailure: true });
  } catch (e) {
    throw galatFase('VFS_INSTALL_FAILED', e);
  }

  // FASE 3 — buka (atau buat) database.
  try {
    const p = pool;
    if (!p) throw new Error('Pool VFS null setelah install.');
    db = new p.OpfsSAHPoolDb(NAMA_FILE_DB);
  } catch (e) {
    throw galatFase('DB_OPEN_FAILED', e);
  }

  // FASE 4 — jalankan migrasi skema.
  try {
    const koneksi = db;
    if (!koneksi) throw new Error('Koneksi null sebelum migrasi.');
    jalankanMigrasi(koneksi);
  } catch (e) {
    throw galatFase('MIGRATION_FAILED', e);
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
