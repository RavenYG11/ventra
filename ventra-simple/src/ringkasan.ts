// Hitungan ringkasan otomatis — fungsi MURNI dari daftar barang.
//
// Dipisah dari komponen UI agar mudah diuji (cukup panggil dengan array).
// Rumus mengikuti keputusan final Rama (spec): nilai stok memakai HARGA BELI.

import type { Barang } from './model';
import { AMBANG_MENIPIS } from './model';

export interface Ringkasan {
  /** Jumlah jenis barang (COUNT). */
  jenis: number;
  /** Total pcs seluruh barang (Σ stok). */
  totalPcs: number;
  /** Σ (stok × harga_beli). */
  nilaiStok: number;
  /** Σ (stok × (harga_jual − harga_beli)) — "potensi" karena dihitung dari stok saat ini. */
  potensiLaba: number;
  /** Jumlah jenis barang dengan 0 < stok ≤ ambang menipis. */
  menipis: number;
  /** Jumlah jenis barang dengan stok = 0. */
  habis: number;
}

/** Hitung ringkasan dari daftar barang. Selalu konsisten — satu-satunya rumus. */
export function hitungRingkasan(daftar: Barang[]): Ringkasan {
  let totalPcs = 0;
  let nilaiStok = 0;
  let potensiLaba = 0;
  let menipis = 0;
  let habis = 0;
  for (const b of daftar) {
    totalPcs += b.stok;
    nilaiStok += b.stok * b.hargaBeli;
    potensiLaba += b.stok * (b.hargaJual - b.hargaBeli);
    if (b.stok === 0) {
      habis++;
    } else if (b.stok <= AMBANG_MENIPIS) {
      menipis++;
    }
  }
  return { jenis: daftar.length, totalPcs, nilaiStok, potensiLaba, menipis, habis };
}
