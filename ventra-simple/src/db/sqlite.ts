// Klien main-thread untuk engine SQLite di worker (db/worker.ts).
//
// Pola RPC sederhana: tiap panggilan diberi id unik → promise disimpan di
// Map → worker membalas {id, ...} → promise diselesaikan. Timeout 15 detik
// untuk init; worker.onerror (mis. script worker gagal di-load Vite)
// menolak semua promise yang menunggu — lalu buka.ts beralih ke fallback.

import type { Barang, BarangBaru } from '../model';
import { validasiBarangBaru, validasiJumlah } from '../model';
import type { PenyimpananBarang } from './kontrak';

const TIMEOUT_INIT_MS = 15000;

interface Tunggu {
  selesai: (hasil: Record<string, unknown>) => void;
  gagal: (galat: Error) => void;
}

interface PesanBalas {
  id: number;
  ok: boolean;
  error?: string;
  [kunci: string]: unknown;
}

/** Klien SQLite-OPFS. Gagal init → throw → buka.ts memakai fallback localStorage. */
export function buatSQLite(): PenyimpananBarang {
  let worker: Worker | null = null;
  let idBerikut = 1;
  const menunggu = new Map<number, Tunggu>();
  let janjiInit: Promise<void> | null = null;

  /** Hentikan worker dan buang semua promise yang menunggu. */
  function matikan(sebab: string): void {
    for (const [, t] of menunggu) t.gagal(new Error(sebab));
    menunggu.clear();
    if (worker) {
      worker.terminate();
      worker = null;
    }
    janjiInit = null;
  }

  function pastikanWorker(): Worker {
    if (worker) return worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<PesanBalas>) => {
      const data = ev.data;
      if (!data || typeof data.id !== 'number') return;
      const t = menunggu.get(data.id);
      if (!t) return;
      menunggu.delete(data.id);
      if (data.ok) t.selesai(data);
      else t.gagal(new Error(String(data.error ?? 'Galat worker database tidak dikenal.')));
    };
    // Worker gagal di-spawn/di-load (kasus VDB-W01: ErrorEvent message kosong).
    w.onerror = (ev: ErrorEvent) => {
      const rincian = ev.message || 'kesalahan tidak dikenal (script worker gagal dimuat?)';
      matikan('Worker database berhenti: ' + rincian);
    };
    worker = w;
    return w;
  }

  function kirim(op: string, argumen: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const w = pastikanWorker();
    const id = idBerikut++;
    return new Promise<Record<string, unknown>>((selesai, gagal) => {
      menunggu.set(id, { selesai, gagal });
      w.postMessage({ id, op, ...argumen });
    });
  }

  /** Init sekali; gagal → matikan worker agar percobaan berikut mulai bersih. */
  async function init(): Promise<void> {
    if (!janjiInit) {
      janjiInit = (async () => {
        const batas = new Promise<never>((_, tolak) => {
          window.setTimeout(() => tolak(new Error('Timeout inisialisasi SQLite (15 detik).')), TIMEOUT_INIT_MS);
        });
        await Promise.race([kirim('init'), batas]);
      })();
      janjiInit.catch((e: unknown) => {
        matikan(e instanceof Error ? e.message : String(e));
      });
    }
    return janjiInit;
  }

  return {
    namaBackend: 'sqlite-opfs',

    async daftar(): Promise<Barang[]> {
      await init();
      const balas = await kirim('daftar');
      return balas.daftar as Barang[];
    },

    async tambah(input: BarangBaru): Promise<Barang> {
      const daftarGalat = validasiBarangBaru(input);
      if (daftarGalat.length > 0) throw new Error(daftarGalat[0]);
      await init();
      const balas = await kirim('tambah', {
        nama: input.nama.trim(),
        stok: input.stokAwal,
        hargaBeli: input.hargaBeli,
        hargaJual: input.hargaJual,
      });
      return balas.barang as Barang;
    },

    async hapus(id: number): Promise<void> {
      await init();
      await kirim('hapus', { id_barang: id });
    },

    async beli(id: number, jumlah: number): Promise<Barang> {
      const galat = validasiJumlah(jumlah);
      if (galat) throw new Error(galat);
      await init();
      const balas = await kirim('beli', { id_barang: id, jumlah });
      return balas.barang as Barang;
    },

    async jual(id: number, jumlah: number): Promise<Barang> {
      const galat = validasiJumlah(jumlah);
      if (galat) throw new Error(galat);
      await init();
      const balas = await kirim('jual', { id_barang: id, jumlah });
      return balas.barang as Barang;
    },
  };
}
