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

/** Hasil INSERT/UPDATE/DELETE/DDL — kompatibel dengan edisi Tauri (plugin-sql). */
export interface HasilExecute {
  /** Rowid dari INSERT terakhir di koneksi ini. Untuk non-INSERT, abaikan. */
  lastInsertId: number;
}

/** Antarmuka database yang dipakai repo-*.ts (kompatibel dengan edisi Tauri). */
export interface DbVentra {
  /** SELECT → array baris (objek). Contoh: db.select<Barang[]>(sql, [kataKunci]) */
  select<T>(sql: string, params?: NilaiParam[]): Promise<T>;
  /**
   * INSERT/UPDATE/DELETE/DDL — satu statement.
   * Mengembalikan lastInsertId (rowid INSERT terakhir di koneksi ini).
   */
  execute(sql: string, params?: NilaiParam[]): Promise<HasilExecute>;
}

// Nama file database di OPFS. VFS opfs-sahpool MEWAJIBKAN path absolut.
const NAMA_FILE_DB = '/stok.db';

let pool: PoolUtil | null = null;
let db: DbWasm | null = null;
let janjiInisialisasi: Promise<DbVentra> | null = null;
let deteksiTabMulai = false;

// Batas waktu inisialisasi: bila OPFS hang (tidak resolve & tidak reject),
// jangan biarkan aplikasi stuck selamanya di layar "Memuat…".
const BATAS_WAKTU_INIT_MS = 15000;

/**
 * Koneksi database tunggal. Inisialisasi (load WASM + buka OPFS + migrasi)
 * hanya terjadi sekali, lalu dipakai ulang — aman dipanggil berkali-kali.
 */
export function dapatkanDb(): Promise<DbVentra> {
  mulaiDeteksiTabLain(); // idempoten — aman dipanggil berkali-kali
  if (!janjiInisialisasi) janjiInisialisasi = inisialisasiDenganBatasWaktu();
  return janjiInisialisasi;
}

/** Inisialisasi + pemutus 15 detik bila OPFS hang. */
async function inisialisasiDenganBatasWaktu(): Promise<DbVentra> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      inisialisasi(),
      new Promise<never>((_, tolak) => {
        timer = setTimeout(
          () =>
            tolak(
              new Error(
                'Inisialisasi database melebihi 15 detik — kemungkinan penyimpanan ' +
                  'browser (OPFS) macet. Muat ulang halaman; bila tetap gagal, ' +
                  'tutup semua tab Ventra lalu buka satu tab baru.'
              )
            ),
          BATAS_WAKTU_INIT_MS
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
  // CATATAN (assignment #20, 2026-10-14): opsi `preserveOnInitFailure` — agar
  // init VFS yang gagal TIDAK me-wipe storage (perilaku default = removeVfs())
  // — baru didukung sqlite-wasm 3.54 (lihat sqlite.org/wasm/doc/tip/
  // persistence.md, "Persistent Storage Options"). Versi 3.54 BELUM terbit di
  // npm (maksimum 3.53.4-build2 per 2026-10-14 — diverifikasi langsung dari
  // dist paket: string "preserveOnInitFailure" tidak ada di 3.53.4, sehingga
  // flag ini DIABAIKAN DENGAN AMAN di versi lama). Flag diteruskan SEKARANG
  // agar proteksi anti-wipe AKTIF OTOMATIS begitu package.json di-upgrade ke
  // ≥3.54 (lakukan via `npm install @sqlite.org/sqlite-wasm@^3.54` segera
  // setelah 3.54 tersedia di npm).
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ preserveOnInitFailure: true });
  } catch (e) {
    // JANGAN telan error asli — tampilkan agar bisa didiagnosis.
    const sebab = e instanceof Error ? e.message : String(e);
    throw new Error('Gagal membuka database lokal (' + sebab + ').' + saranTabLain());
  }

  // 3. Buka (atau buat) database + jalankan migrasi. Dibungkus try/catch agar
  //    error asli (file terkunci, migrasi gagal, dsb.) tampil, bukan hilang.
  //    Satu koneksi di main thread — tidak ada connection pool, jadi urutan
  //    query selalu terjaga.
  try {
    db = new pool.OpfsSAHPoolDb(NAMA_FILE_DB);
    await jalankanMigrasi(db);
  } catch (e) {
    const sebab = e instanceof Error ? e.message : String(e);
    throw new Error('Gagal menyiapkan database (' + sebab + ').' + saranTabLain());
  }

  const koneksi = db;
  const bungkus: DbVentra = {
    async select<T>(sql: string, params: NilaiParam[] = []): Promise<T> {
      return koneksi.selectObjects(normalisasiParam(sql), params) as unknown as T;
    },
    async execute(sql: string, params: NilaiParam[] = []): Promise<HasilExecute> {
      koneksi.exec({ sql: normalisasiParam(sql), bind: params });
      // last_insert_rowid() = rowid dari INSERT terakhir di koneksi ini.
      // Aman: Ventra memakai SATU koneksi (lihat atas), jadi tidak ada interleaving
      // antar pemanggil. Untuk statement non-INSERT, nilai ini = rowid INSERT
      // terakhir sebelumnya — pemanggil mengabaikannya.
      const baris = koneksi.selectObjects('SELECT last_insert_rowid() AS id') as Array<{
        id: number;
      }>;
      return { lastInsertId: Number(baris[0]?.id ?? 0) };
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
// Deteksi tab lain via BroadcastChannel (heartbeat ±300ms).
// VFS opfs-sahpool HANYA boleh di-init satu tab per origin — tab kedua gagal
// (lihat sqlite.org/wasm/doc/trunk/persistence.md § "OPFS SyncAccessHandle
// Pool VFS" → Installation). Agar pesan error akurat ("tutup tab lain" vs
// "OPFS diblokir browser"), tiap tab Ventra mengumumkan keberadaannya dan
// tab ini mencatat pong terakhir yang diterima.
// ---------------------------------------------------------------------------
const ID_TAB = Math.random().toString(36).slice(2);
const NAMA_CHANNEL_TAB = 'ventra-tab';

let tabLainTerdeteksi = false;
let waktuPongTerakhirMs = 0;

function mulaiDeteksiTabLain(): void {
  if (deteksiTabMulai) return;
  deteksiTabMulai = true;
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(NAMA_CHANNEL_TAB);
    ch.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { tipe?: string; dari?: string; ke?: string } | null;
      if (!m || typeof m !== 'object') return;
      if (m.tipe === 'ventra-ping' && m.dari !== ID_TAB) {
        ch.postMessage({ tipe: 'ventra-pong', dari: ID_TAB, ke: m.dari });
      } else if (m.tipe === 'ventra-pong' && m.ke === ID_TAB) {
        tabLainTerdeteksi = true;
        waktuPongTerakhirMs = Date.now();
      }
    };
    const kirimPing = () => {
      try {
        ch.postMessage({ tipe: 'ventra-ping', dari: ID_TAB });
      } catch {
        // Abaikan — deteksi tab bukan fitur kritis.
      }
    };
    kirimPing();
    setInterval(kirimPing, 300);
  } catch {
    // BroadcastChannel tidak tersedia/gagal → deteksi nonaktif, bukan fatal.
  }
}

/** True bila ada tab Ventra lain yang merespons dalam ~1 detik terakhir. */
function apakahAdaTabLain(): boolean {
  return tabLainTerdeteksi && Date.now() - waktuPongTerakhirMs < 1000;
}

/** Saran akurat untuk pesan error inisialisasi database. */
function saranTabLain(): string {
  if (apakahAdaTabLain()) {
    return (
      ' Terdeteksi tab Ventra lain sedang terbuka — tutup SEMUA tab Ventra, ' +
      'lalu buka satu tab baru dan muat ulang halaman ini.'
    );
  }
  return (
    ' Tidak terdeteksi tab Ventra lain — kemungkinan penyimpanan browser (OPFS) ' +
    'diblokir (mode private/incognito, profil browser bermasalah, atau disk penuh).'
  );
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

