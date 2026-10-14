// SATU-SATUNYA tempat query SQLite di seluruh aplikasi.
// Aturan Gunet: UI tidak boleh query DB langsung — semua lewat service → repo → file ini.
//
// EDISI WEB (pivot 2026-10-14, assignment #18 — keputusan Rama: tanpa Tauri/Rust).
// SQLite berjalan sebagai WebAssembly di browser via @sqlite.org/sqlite-wasm;
// data PERSISTEN di OPFS (Origin-Private FileSystem) memakai VFS "opfs-sahpool".
// Tetap 100% lokal & offline — tidak ada server, tidak ada cloud.
//
// ARSITEKTUR WORKER (assignment #21, 2026-10-14 — WAJIB dibaca):
// VFS opfs-sahpool memakai SyncAccessHandle. installOpfsSAHPoolVfs() MENOLAK
// dengan "Missing required OPFS APIs." bila
// `FileSystemFileHandle.prototype.createSyncAccessHandle` tidak ada — dan API
// itu HANYA tersedia di Web Worker, tidak di main thread Chrome. Karena itu
// SELURUH engine SQLite tinggal di src/lib/db-worker.ts (dijalankan sebagai
// Worker); file ini HANYA proxy via postMessage. Jangan pindahkan pemanggilan
// installOpfsSAHPoolVfs / OpfsSAHPoolDb kembali ke main thread.
//
// Sumber:
// - https://sqlite.org/wasm/doc/trunk/persistence.md ("OPFS SyncAccessHandle Pool VFS")
// - https://github.com/sqlite/sqlite-wasm (demos/sahpool-demo: main thread
//   hanya spawn worker, worker yang install VFS)

// ---------------------------------------------------------------------------
// API PUBLIK — dipertahankan PERSIS agar repo-*.ts, service-*.ts, dan
// lib/backup.ts tidak perlu berubah.
// ---------------------------------------------------------------------------

/** Nilai yang boleh di-bind ke parameter query. */
export type NilaiParam = string | number | bigint | null | Uint8Array;

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

// ---------------------------------------------------------------------------
// Proxy ke worker.
// ---------------------------------------------------------------------------

interface TugasTertunda {
  selesai: (nilai: any) => void;
  gagal: (galat: Error) => void;
}

interface BalasanWorker {
  id: number;
  ok: boolean;
  error?: string;
  rows?: unknown[];
  lastInsertId?: number;
  bytes?: Uint8Array;
}

let worker: Worker | null = null;
let idSeq = 0;
const pending = new Map<number, TugasTertunda>();
let janjiInisialisasi: Promise<DbVentra> | null = null;

// Batas waktu inisialisasi: bila worker/OPFS hang (tidak resolve & tidak
// reject), jangan biarkan aplikasi stuck selamanya di layar "Memuat…".
const BATAS_WAKTU_INIT_MS = 15000;

function dapatkanWorker(): Worker {
  if (!worker) {
    // Vite mem-bundle './db-worker.ts' sebagai chunk worker terpisah.
    worker = new Worker(new URL('./db-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<BalasanWorker>) => {
      const m = ev.data;
      if (!m || typeof m.id !== 'number') return;
      const tugas = pending.get(m.id);
      if (!tugas) return;
      pending.delete(m.id);
      if (m.ok) tugas.selesai(m);
      else tugas.gagal(new Error(typeof m.error === 'string' ? m.error : 'Worker database gagal.'));
    };
    worker.onerror = (ev: ErrorEvent) => {
      // Worker crash: gagalkan semua pemanggil yang sedang menunggu.
      const galat = new Error(
        'Worker database berhenti: ' + (ev.message || 'kesalahan tidak dikenal') + '. Muat ulang halaman.'
      );
      for (const tugas of pending.values()) tugas.gagal(galat);
      pending.clear();
    };
  }
  return worker;
}

function panggil<T>(op: string, muatan: Record<string, unknown> = {}): Promise<T> {
  const w = dapatkanWorker();
  const id = ++idSeq;
  return new Promise<T>((selesai, gagal) => {
    pending.set(id, { selesai: selesai as (nilai: any) => void, gagal });
    try {
      w.postMessage({ id, op, ...muatan });
    } catch (e) {
      pending.delete(id);
      gagal(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Koneksi database tunggal. Handshake init dengan worker hanya terjadi sekali,
 * lalu proxy dipakai ulang — aman dipanggil berkali-kali.
 */
export function dapatkanDb(): Promise<DbVentra> {
  mulaiDeteksiTabLain(); // idempoten — aman dipanggil berkali-kali
  if (!janjiInisialisasi) janjiInisialisasi = inisialisasiDenganBatasWaktu();
  return janjiInisialisasi;
}

/** Handshake init + pemutus 15 detik bila worker/OPFS hang. */
async function inisialisasiDenganBatasWaktu(): Promise<DbVentra> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      panggil<{ ok: boolean }>('init').catch((e: unknown) => {
        // Sertakan error asli worker + saran akurat (tab lain vs OPFS diblokir).
        const sebab = e instanceof Error ? e.message : String(e);
        throw new Error('Gagal membuka database: ' + sebab + saranTabLain());
      }),
      new Promise<never>((_, tolak) => {
        timer = setTimeout(
          () =>
            tolak(
              new Error(
                'Inisialisasi database melebihi 15 detik — kemungkinan worker/penyimpanan ' +
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

  const bungkus: DbVentra = {
    async select<T>(sql: string, params: NilaiParam[] = []): Promise<T> {
      const balas = await panggil<BalasanWorker>('select', { sql, params });
      return (balas.rows ?? []) as unknown as T;
    },
    async execute(sql: string, params: NilaiParam[] = []): Promise<HasilExecute> {
      const balas = await panggil<BalasanWorker>('execute', { sql, params });
      return { lastInsertId: Number(balas.lastInsertId ?? 0) };
    },
  };
  return bungkus;
}

// ---------------------------------------------------------------------------
// Deteksi tab lain via BroadcastChannel (heartbeat ±300ms).
// VFS opfs-sahpool HANYA boleh dipakai satu tab per origin — tab kedua gagal
// (lihat sqlite.org/wasm/doc/trunk/persistence.md § "OPFS SyncAccessHandle
// Pool VFS" → Installation). Agar pesan error akurat ("tutup tab lain" vs
// "OPFS diblokir browser"), tiap tab Ventra mengumumkan keberadaannya dan
// tab ini mencatat pong terakhir yang diterima.
// ---------------------------------------------------------------------------
const ID_TAB = Math.random().toString(36).slice(2);
const NAMA_CHANNEL_TAB = 'ventra-tab';

let deteksiTabMulai = false;
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
// Ekspor database utuh (dipakai fitur "Unduh Backup" — lihat lib/backup.ts).
// ---------------------------------------------------------------------------

/**
 * Mengekspor SELURUH isi database sebagai byte array file .db.
 * Worker memakai poolUtil.exportFile() (dokumentasi resmi) — membaca file
 * database dari OPFS tanpa menutup koneksi yang sedang berjalan.
 */
export async function eksporDatabase(): Promise<Uint8Array> {
  await dapatkanDb();
  const balas = await panggil<BalasanWorker>('export');
  if (!balas.bytes) throw new Error('Export database gagal: worker tidak mengembalikan data.');
  // Salin defensif — buffer aslinya ditransfer (bukan di-copy) dari worker.
  return new Uint8Array(balas.bytes);
}
