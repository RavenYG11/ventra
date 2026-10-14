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
// (IMPORT_FAILED / WASM_LOAD_FAILED / OPFS_UNAVAILABLE / VFS_INSTALL_FAILED /
// DB_OPEN_FAILED / MIGRATION_FAILED); self.onerror + self.onunhandledrejection
// melaporkan ke main thread via {id:-1}; guard pastikanOpfsBisaDitulis()
// memastikan OPFS bisa ditulis SEBELUM install VFS (anti-wipe: init VFS yang
// gagal bisa me-wipe storage bila tanpa preserveOnInitFailure).
//
// DIAGNOSIS TERTARGET (assignment #23, 2026-10-14): [VDB-W01] pesan kosong +
// file tidak diketahui = worker gagal di FASE EVALUASI MODUL (static import),
// sebelum kode apa pun jalan; console Rama bersih tanpa 404. Static import
// tidak bisa di-try/catch — satu-satunya cara membuat kegagalannya terlihat
// adalah DYNAMIC IMPORT. Karena itu 4 static import tingkat atas DIHAPUS;
// initDb() memuat semuanya di TAHAP PALING AWAL via dynamic import di dalam
// try/catch berlabel IMPORT_FAILED. Bila Vite gagal mentransform salah satu
// modul, error ASLI kini tertangkap → postMessage {id:-1,
// fase:'IMPORT_FAILED'} → tampil sebagai VDB-W02 di layar.
//
// Pola komunikasi: main thread (lib/db.ts) mengirim {id, op, sql?, params?}
// via postMessage; worker membalas {id, ok:true, ...hasil} atau
// {id, ok:false, error}. Semua byte database ditransfer (bukan di-copy)
// untuk operasi export.
declare const self: DedicatedWorkerGlobalScope;

// ---------------------------------------------------------------------------
// CATATAN ARSITEKTUR (assignment #23): file ini SENGAJA tanpa static import
// modul tingkat atas. Semua modul dimuat via dynamic import di FASE
// IMPORT_FAILED agar kegagalan bundling/transform Vite tertangkap dengan
// pesan asli — bukan crash bisu di fase evaluasi modul.
// ---------------------------------------------------------------------------

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
type MuatSqlite3 = (
  opsi?: { locateFile?: (nama: string) => string }
) => Promise<Sqlite3Api>;

// Nama file database di OPFS. VFS opfs-sahpool MEWAJIBKAN path absolut.
// VENTRA SIMPLE (2026-10-14): file BARU /ventra-simple.db — skema lama
// (/stok.db + migrasi 001/002/003) tidak dibawa sama sekali, jadi tidak ada
// risiko wipe/migrasi setengah jalan. File lama tetap utuh di OPFS.
const NAMA_FILE_DB = '/ventra-simple.db';

let pool: PoolUtil | null = null;
let db: DbWasm | null = null;

// ---------------------------------------------------------------------------
// Modul yang dimuat di FASE IMPORT_FAILED (dynamic import). Variabel ini
// HANYA diisi initDb() sebelum dipakai fase-fase berikutnya — jangan dibaca
// sebelum init selesai.
// ---------------------------------------------------------------------------

/** Factory init sqlite-wasm (default export '@sqlite.org/sqlite-wasm'). */
let muatSqlite3: MuatSqlite3 | null = null;
/** URL file sqlite3.wasm setelah di-bundle Vite (pola ?url = aset statis). */
let urlWasm = '';
/** Isi skema fresh Ventra Simple (pola ?raw = teks mentah Vite). */
let teksSkema = '';

// ---------------------------------------------------------------------------
// Diagnostik: tangkap error runtime yang lolos dari handler pesan.
// (Sejak assignment #23 file ini tanpa static import — kegagalan load modul
// ditangkap FASE IMPORT_FAILED dengan pesan asli. VDB-W01 di main thread
// kini hanya untuk kasus worker gagal di-spawn/di-load Vite itu sendiri.)
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

/**
 * Inisialisasi engine: import modul → WASM → guard OPFS → VFS → buka DB →
 * migrasi. Idempoten (aman dipanggil ulang; berhenti di `if (db) return;`).
 */
async function initDb(): Promise<void> {
  if (db) return;

  // FASE 0 — IMPORT_FAILED: muat semua modul via dynamic import.
  // Alasan: static import TIDAK BISA di-try/catch. Bila Vite gagal
  // mentransform salah satu modul (kasus [VDB-W01] pesan kosong + file
  // tidak diketahui di laptop Rama), worker crash bisu di fase evaluasi
  // modul — sebelum baris kode apa pun jalan. Dynamic import memindahkan
  // kegagalan itu ke dalam try/catch ini sehingga error ASLI tertangkap.
  // Catatan: literal string di bawah SENGAJA statis — Vite hanya memproses
  // dynamic import yang bisa dianalisis statis; jangan diganti template
  // string/variabel.
  let modulGagal = '@sqlite.org/sqlite-wasm';
  try {
    const m1 = await import('@sqlite.org/sqlite-wasm');
    modulGagal = '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
    const m2 = await import('@sqlite.org/sqlite-wasm/sqlite3.wasm?url');
    modulGagal = 'migrasi/ventra-simple.sql';
    const m3 = await import('../../migrasi/ventra-simple.sql?raw');
    // Ambil default export tiap modul (pola Vite: ?url/?raw → string).
    muatSqlite3 = m1.default as unknown as MuatSqlite3;
    urlWasm = m2.default;
    teksSkema = m3.default;
  } catch (e) {
    const sebab = e instanceof Error ? e.message : String(e);
    const rincian = 'import "' + modulGagal + '" gagal: ' + sebab;
    // Laporkan sebagai diagnostik fatal (main thread menampilkannya sebagai
    // VDB-W02), lalu lempar agar alur init berhenti dan pemanggil 'init'
    // ikut menerima kegagalan.
    self.postMessage({
      id: -1,
      ok: false,
      fase: 'IMPORT_FAILED',
      error: '[IMPORT_FAILED] ' + rincian,
    });
    throw galatFase('IMPORT_FAILED', rincian);
  }

  // FASE 1 — muat engine SQLite (WASM).
  let sqlite3: Sqlite3Api;
  try {
    if (!urlWasm) {
      throw new Error('URL sqlite3.wasm kosong — bundler tidak menyertakan file WASM (cek pola ?url).');
    }
    const muat = muatSqlite3;
    if (!muat) {
      throw new Error('Modul sqlite-wasm belum dimuat — FASE IMPORT_FAILED tidak selesai.');
    }
    sqlite3 = await muat({
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

  // FASE 4 — terapkan skema fresh Ventra Simple.
  try {
    const koneksi = db;
    if (!koneksi) throw new Error('Koneksi null sebelum skema.');
    terapkanSkemaAwal(koneksi);
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
// Skema database — VENTRA SIMPLE (2026-10-14): satu skrip fresh
// (migrasi/ventra-simple.sql), bukan rantai migrasi lama. Skema dijalankan di
// file DB BARU /ventra-simple.db; idempoten (CREATE TABLE IF NOT EXISTS).
// ---------------------------------------------------------------------------

/**
 * Terapkan skema fresh Ventra Simple, atomik dalam SATU transaksi.
 * Gagal di tengah = batal total (ROLLBACK). Baris versi dicatat agar
 * perubahan skema di masa depan bisa dibedakan; INSERT OR IGNORE membuat
 * retry aman.
 */
function terapkanSkemaAwal(database: DbWasm): void {
  if (!teksSkema) {
    throw new Error('Skema ventra-simple.sql kosong — bundler tidak menyertakan file SQL (cek pola ?raw).');
  }
  database.exec('BEGIN IMMEDIATE;');
  try {
    database.exec(teksSkema);
    database.exec({ sql: 'INSERT OR IGNORE INTO migrasi (versi) VALUES (?)', bind: ['ventra-simple'] });
    database.exec('COMMIT;');
  } catch (e) {
    try {
      database.exec('ROLLBACK;');
    } catch {
      // Abaikan — tidak ada transaksi terbuka yang bisa di-rollback.
    }
    throw e;
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
