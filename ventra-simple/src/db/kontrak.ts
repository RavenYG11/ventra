// Kontrak penyimpanan barang — "port" (ide Sentot, assignment #43).
//
// UI dan logika bisnis HANYA kenal interface ini. Mereka tidak tahu (dan
// tidak boleh tahu) apakah di belakangnya ada SQLite-OPFS atau localStorage.
// Ganti backend = ganti 1 baris di db/buka.ts — tanpa menyentuh UI.

import type { Barang, BarangBaru } from '../model';

export interface PenyimpananBarang {
  /** Nama backend aktif — ditampilkan sebagai badge di UI (jujur ke pengguna). */
  readonly namaBackend: 'sqlite-opfs' | 'localstorage';

  /** Semua barang, urut nama A→Z (case-insensitive). */
  daftar(): Promise<Barang[]>;

  /**
   * Tambah barang baru.
   * Throw Error bila: nama kosong/duplikat (case-insensitive), harga/stok negatif.
   */
  tambah(input: BarangBaru): Promise<Barang>;

  /** Hapus permanen (hard delete — tidak ada riwayat di v1 simple). Throw bila id tidak ada. */
  hapus(id: number): Promise<void>;

  /** Catat BELI: stok += jumlah (atomik). Kembalikan barang terbaru. */
  beli(id: number, jumlah: number): Promise<Barang>;

  /**
   * Catat JUAL: stok -= jumlah (atomik).
   * Throw Error berawalan GALAT_STOK_KURANG bila jumlah > stok — stok TIDAK berubah.
   * Kembalikan barang terbaru bila berhasil.
   */
  jual(id: number, jumlah: number): Promise<Barang>;
}

/**
 * Awalan pesan error untuk "jual melebihi stok". Didefinisikan di sini
 * (satu sumber kebenaran) — dipakai worker, adapter localStorage, dan UI
 * untuk menampilkan pesan yang ramah.
 */
export const GALAT_STOK_KURANG = 'STOK_TIDAK_CUKUP';

/** Nama barang sudah dipakai — pesan baku agar konsisten di semua backend. */
export const GALAT_NAMA_DUPLIKAT = 'Barang dengan nama tersebut sudah ada.';
