// Tipe data bersama Ventra Simple — cerminan migrasi/ventra-simple.sql.
// (2026-10-14: dipangkas — tipe Kategori & KodeBarang dihapus bersama fiturnya.)

/** Satu jenis barang (nama = satu-satunya identitas, unik case-insensitive). */
export interface Barang {
  id: number;
  nama: string;
  /** Satuan terkunci 'pcs' — tidak disimpan di DB, tampil statis di UI. */
  stok: number;
  harga_beli: number;
  harga_jual: number;
}

export interface Pengguna {
  id: number;
  nama_pengguna: string;
}

/** Dipakai komponen ui.tsx (BadgeStok). */
export type StatusStok = 'aman' | 'menipis' | 'habis';

/** Hasil operasi service: { ok, data?, galat? } */
export interface Hasil<T> {
  ok: boolean;
  data?: T;
  galat?: string;
}
