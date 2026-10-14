// Pemilihan backend penyimpanan.
//
// Urutan: coba SQLite-WASM (OPFS) dulu — itu permintaan tugas. Bila gagal
// TOTAL (worker crash, OPFS tidak tersedia/mode private, timeout 15 detik),
// otomatis beralih ke localStorage.
//
// Prinsip: aplikasi TIDAK PERNAH blank karena database — selalu ada backend
// yang jalan. UI menampilkan badge backend aktif agar jujur ke pengguna.

import type { PenyimpananBarang } from './kontrak';
import { buatSQLite } from './sqlite';
import { buatLokal } from './lokal';

export async function bukaPenyimpanan(): Promise<PenyimpananBarang> {
  try {
    const sqlite = buatSQLite();
    await sqlite.daftar(); // picu init worker; throw bila gagal
    return sqlite;
  } catch (e) {
    const sebab = e instanceof Error ? e.message : String(e);
    // Peringatan diagnostik yang disengaja — membantu QA, bukan error aplikasi.
    console.warn('[ventra-simple] SQLite-OPFS gagal, beralih ke localStorage:', sebab);
    return buatLokal();
  }
}
