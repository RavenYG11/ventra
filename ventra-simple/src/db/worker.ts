// Engine SQLite Ventra Simple — berjalan di WEB WORKER (bukan main thread).
//
// KENAPA HARUS WORKER (temuan 2026-10-14, assignment #21 — terbukti dari
// source resmi sqlite-wasm): VFS opfs-sahpool memakai SyncAccessHandle.
// installOpfsSAHPoolVfs() MENOLAK dengan "Missing required OPFS APIs." bila
// `FileSystemFileHandle.prototype.createSyncAccessHandle` tidak ada — dan API
// itu HANYA tersedia di Web Worker, tidak di main thread Chrome.
// Memanggilnya di main thread = gagal pasti.
//
// File ini SENGAJA tanpa static import tingkat atas: semua modul dimuat via
// dynamic import di dalam try/catch (pelajaran assignment #23) agar kegagalan
// load modul tertangkap dengan pesan ASLI, bukan crash bisu.
//
// Protokol: main thread mengirim {id, op, ...argumen} via postMessage;
// worker membalas {id, ok:true, ...hasil} atau {id, ok:false, error}.
// Pesan diproses BERURUTAN pada SATU koneksi → baca-ubah-tulis aman.

import type { Barang } from '../model';
import { GALAT_STOK_KURANG, GALAT_NAMA_DUPLIKAT } from './kontrak';

// Tipe minimal API sqlite-wasm yang dipakai (tanpa static import).
type NilaiParam = string | number | bigint | null | Uint8Array;

interface DbWasm {
  exec(sql: string): void;
  exec(opsi: { sql: string; bind?: NilaiParam[] }): void;
  selectObjects(sql: string, bind?: NilaiParam[]): Array<Record<string, unknown>>;
}

interface PoolUtil {
  OpfsSAHPoolDb: new (namaFile: string) => DbWasm;
}

interface Sqlite3Api {
  installOpfsSAHPoolVfs: (opsi?: Record<string, unknown>) => Promise<PoolUtil>;
}

type MuatSqlite3 = (opsi?: { locateFile?: (nama: string) => string }) => Promise<Sqlite3Api>;

// Scope worker — didefinisikan manual agar tidak butuh lib "WebWorker" di tsconfig.
interface ScopeWorker {
  postMessage(pesan: unknown): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}
const scope = self as unknown as ScopeWorker;

// VFS opfs-sahpool MEWAJIBKAN path absolut.
const NAMA_FILE_DB = '/ventra-simple.db';

const SKEMA_BARANG = `
CREATE TABLE IF NOT EXISTS barang (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  stok       INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  harga_beli REAL    NOT NULL CHECK (harga_beli >= 0),
  harga_jual REAL    NOT NULL CHECK (harga_jual >= 0),
  dibuat_pada  TEXT  NOT NULL DEFAULT (datetime('now')),
  diubah_pada  TEXT  NOT NULL DEFAULT (datetime('now'))
);`;

let db: DbWasm | null = null;

/** Bungkus error tiap fase init dengan kode stabil agar bisa didiagnosis. */
function galatFase(kode: string, e: unknown): Error {
  const sebab = e instanceof Error ? e.message : String(e);
  return new Error('[' + kode + '] ' + sebab);
}

/**
 * GUARD ANTI-WIPE: pastikan OPFS bisa dibaca & ditulis SEBELUM install VFS.
 * Bila installOpfsSAHPoolVfs() gagal, perilaku default paket bisa me-wipe
 * storage — guard ini memastikan VFS tidak disentuh bila OPFS memang buntu.
 */
async function pastikanOpfsBisaDitulis(): Promise<void> {
  const nav = navigator as unknown as {
    storage?: { getDirectory?: () => Promise<unknown> };
  };
  if (!nav.storage || typeof nav.storage.getDirectory !== 'function') {
    throw new Error('navigator.storage.getDirectory tidak tersedia di worker ini.');
  }
  const root = (await nav.storage.getDirectory()) as {
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
  const namaUji = '.ventra-simple-uji-tulis';
  let tutup: (() => Promise<void>) | null = null;
  try {
    const fh = await root.getFileHandle(namaUji, { create: true });
    const sah = await fh.createSyncAccessHandle();
    tutup = () => sah.close();
    const data = new TextEncoder().encode('ok');
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

/** Inisialisasi engine. Idempoten — aman dipanggil ulang. */
async function initDb(): Promise<void> {
  if (db) return;

  // FASE 0 — IMPORT: dynamic import agar kegagalan load tertangkap berlabel.
  // (Literal string SENGAJA statis — Vite hanya memproses dynamic import
  // yang bisa dianalisis statis.)
  let modulGagal = '@sqlite.org/sqlite-wasm';
  let muat: MuatSqlite3;
  let urlWasm: string;
  try {
    const m1 = (await import('@sqlite.org/sqlite-wasm')) as { default: MuatSqlite3 };
    modulGagal = '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
    const m2 = (await import('@sqlite.org/sqlite-wasm/sqlite3.wasm?url')) as { default: string };
    muat = m1.default;
    urlWasm = m2.default;
  } catch (e) {
    throw galatFase('IMPORT_FAILED', 'import "' + modulGagal + '" gagal: ' + String(e));
  }

  // FASE 1 — muat engine WASM.
  let sqlite3: Sqlite3Api;
  try {
    if (!urlWasm) throw new Error('URL sqlite3.wasm kosong — bundler tidak menyertakan file WASM.');
    sqlite3 = await muat({ locateFile: (nama) => (nama === 'sqlite3.wasm' ? urlWasm : nama) });
  } catch (e) {
    throw galatFase('WASM_LOAD_FAILED', e);
  }

  // FASE 1b — guard OPFS (anti-wipe).
  try {
    await pastikanOpfsBisaDitulis();
  } catch (e) {
    throw galatFase('OPFS_UNAVAILABLE', e);
  }

  // FASE 2 — aktifkan VFS opfs-sahpool.
  // preserveOnInitFailure: anti-wipe (didukung ≥3.54; di 3.53.4 diabaikan aman).
  let pool: PoolUtil;
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ preserveOnInitFailure: true });
  } catch (e) {
    throw galatFase('VFS_INSTALL_FAILED', e);
  }

  // FASE 3 — buka DB + buat tabel.
  try {
    db = new pool.OpfsSAHPoolDb(NAMA_FILE_DB);
    db.exec(SKEMA_BARANG);
  } catch (e) {
    throw galatFase('DB_OPEN_FAILED', e);
  }
}

function wajibDb(): DbWasm {
  if (!db) throw new Error('Database belum diinisialisasi — kirim op "init" dulu.');
  return db;
}

function keBarang(baris: Record<string, unknown>): Barang {
  return {
    id: Number(baris.id),
    nama: String(baris.nama),
    stok: Number(baris.stok),
    hargaBeli: Number(baris.harga_beli),
    hargaJual: Number(baris.harga_jual),
  };
}

function ambilSatu(koneksi: DbWasm, id: number): Barang {
  const baris = koneksi.selectObjects(
    'SELECT id, nama, stok, harga_beli, harga_jual FROM barang WHERE id = ?',
    [id]
  );
  if (baris.length === 0) throw new Error('Barang tidak ditemukan (id=' + id + ').');
  return keBarang(baris[0]);
}

// ---------------------------------------------------------------------------
// Operasi bisnis — aturan ditegakkan DI SINI (bukan cuma di UI).
// ---------------------------------------------------------------------------

function opTambah(koneksi: DbWasm, arg: PesanMasuk): Barang {
  const nama = String(arg.nama ?? '').trim();
  const stok = Number(arg.stok ?? 0);
  const hargaBeli = Number(arg.hargaBeli ?? 0);
  const hargaJual = Number(arg.hargaJual ?? 0);
  if (!nama) throw new Error('Nama barang wajib diisi.');
  if (!Number.isInteger(stok) || stok < 0) throw new Error('Stok awal harus bilangan bulat >= 0.');
  if (!(hargaBeli >= 0) || !(hargaJual >= 0)) throw new Error('Harga harus angka >= 0.');
  try {
    koneksi.exec({
      sql: 'INSERT INTO barang (nama, stok, harga_beli, harga_jual) VALUES (?, ?, ?, ?)',
      bind: [nama, stok, hargaBeli, hargaJual],
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    // UNIQUE constraint (nama duplikat, case-insensitive) → pesan ramah.
    if (/unique/i.test(pesan)) throw new Error(GALAT_NAMA_DUPLIKAT);
    throw e;
  }
  const id = koneksi.selectObjects('SELECT last_insert_rowid() AS id') as Array<{ id: number }>;
  return ambilSatu(koneksi, Number(id[0]?.id ?? 0));
}

function opHapus(koneksi: DbWasm, id: number): void {
  ambilSatu(koneksi, id); // throw bila tidak ada
  koneksi.exec({ sql: 'DELETE FROM barang WHERE id = ?', bind: [id] });
}

function opBeli(koneksi: DbWasm, id: number, jumlah: number): Barang {
  if (!Number.isInteger(jumlah) || jumlah < 1) throw new Error('Jumlah beli minimal 1 pcs.');
  ambilSatu(koneksi, id); // throw bila tidak ada
  koneksi.exec({
    sql: "UPDATE barang SET stok = stok + ?, diubah_pada = datetime('now') WHERE id = ?",
    bind: [jumlah, id],
  });
  return ambilSatu(koneksi, id);
}

function opJual(koneksi: DbWasm, id: number, jumlah: number): Barang {
  if (!Number.isInteger(jumlah) || jumlah < 1) throw new Error('Jumlah jual minimal 1 pcs.');
  const sekarang = ambilSatu(koneksi, id); // throw bila tidak ada
  // ATURAN INTI (keputusan Rama): stok TIDAK BOLEH negatif — tolak sebelum ubah.
  if (jumlah > sekarang.stok) {
    throw new Error(
      GALAT_STOK_KURANG + ': Stok tidak mencukupi (sisa: ' + sekarang.stok + ' pcs, diminta: ' + jumlah + ' pcs).'
    );
  }
  koneksi.exec({
    sql: "UPDATE barang SET stok = stok - ?, diubah_pada = datetime('now') WHERE id = ?",
    bind: [jumlah, id],
  });
  return ambilSatu(koneksi, id);
}

// ---------------------------------------------------------------------------
// Protokol pesan.
// ---------------------------------------------------------------------------

interface PesanMasuk {
  id: number;
  op: 'init' | 'daftar' | 'tambah' | 'hapus' | 'beli' | 'jual' | string;
  id_barang?: number;
  nama?: string;
  stok?: number;
  hargaBeli?: number;
  hargaJual?: number;
  jumlah?: number;
}

scope.onmessage = async (ev: MessageEvent) => {
  const data = (ev.data ?? {}) as PesanMasuk;
  const id = typeof data.id === 'number' ? data.id : -1;
  const balas = (hasil: Record<string, unknown>) => scope.postMessage({ id, ok: true, ...hasil });
  const gagal = (e: unknown) =>
    scope.postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
  try {
    if (data.op === 'init') {
      await initDb();
      balas({});
      return;
    }
    const koneksi = wajibDb();
    if (data.op === 'daftar') {
      const baris = koneksi.selectObjects(
        'SELECT id, nama, stok, harga_beli, harga_jual FROM barang ORDER BY nama COLLATE NOCASE ASC'
      );
      balas({ daftar: baris.map(keBarang) });
    } else if (data.op === 'tambah') {
      balas({ barang: opTambah(koneksi, data) });
    } else if (data.op === 'hapus') {
      opHapus(koneksi, Number(data.id_barang));
      balas({});
    } else if (data.op === 'beli') {
      balas({ barang: opBeli(koneksi, Number(data.id_barang), Number(data.jumlah)) });
    } else if (data.op === 'jual') {
      balas({ barang: opJual(koneksi, Number(data.id_barang), Number(data.jumlah)) });
    } else {
      throw new Error('Operasi worker tidak dikenal: ' + String(data.op));
    }
  } catch (e) {
    gagal(e);
  }
};
