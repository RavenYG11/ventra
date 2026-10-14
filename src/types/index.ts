// Tipe data bersama Ventra — cerminan specs/model-data.md.

export interface Kategori {
  id: number;
  nama: string;
  prefix_kode: string;
  nomor_urut_terakhir: number;
  aktif: number;
  dibuat_pada: string;
}

export type StatusStok = 'aman' | 'menipis' | 'habis';

export interface Barang {
  id: number;
  kode: string;
  nama: string;
  /** barcode = kode (keputusan final). */
  barcode: string;
  kategori_id: number;
  kategori_nama?: string;
  satuan: string; // selalu 'pcs'
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_awal: number;
  stok_minimum: number;
  keterangan: string | null;
  aktif: number;
  dibuat_pada: string;
  diubah_pada: string;
  // Kolom turunan dari v_barang (dihitung, tidak disimpan):
  margin_rp?: number;
  margin_persen?: number | null;
  /** nilai_stok = stok × harga_beli (keputusan final Rama). */
  nilai_stok?: number;
  status_stok?: StatusStok;
}

export interface Pengguna {
  id: number;
  nama_pengguna: string;
}

/** Hasil operasi service: { ok, data?, galat? } */
export interface Hasil<T> {
  ok: boolean;
  data?: T;
  galat?: string;
}
