// Tipe data bersama Ventra — cerminan specs/model-data.md.
// Revisi 14 Okt 2026 (migrasi 003_kode_barang): prefix & counter pindah dari
// kategori ke entitas kode_barang; relasi kategori<->kode_barang M:N.

export interface Kategori {
  id: number;
  nama: string;
  aktif: number;
  dibuat_pada: string;
}

/** Satu pola kode (prefix + counter-nya sendiri). */
export interface KodeBarang {
  id: number;
  /** Prefix unik global, pola [A-Z0-9-], 1–10 karakter. */
  kode: string;
  /** Nama tampilan untuk dropdown, 1–50 karakter. */
  nama: string;
  keterangan: string | null;
  /** Counter internal — hanya naik lewat pembuatan barang (atomik). */
  nomor_urut_terakhir: number;
  aktif: number;
  dibuat_pada: string;
}

export type StatusStok = 'aman' | 'menipis' | 'habis';

export interface Barang {
  id: number;
  /** Kode unik auto-generate (kode kode_barang + 7 digit). Barcode = kode. */
  kode: string;
  nama: string;
  kategori_id: number;
  kategori_nama?: string;
  /** Kode barang mana yang menghasilkan kode ini (audit pola penomoran). */
  kode_barang_id: number;
  /** Nilai prefix untuk kolom tampilan (dari v_barang). */
  kode_barang_kode?: string;
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
