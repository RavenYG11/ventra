// Service kategori — validasi + aturan CRUD kategori.
import type { Hasil, Kategori } from '../../types';
import {
  daftarKategori,
  nonaktifkanKategori,
  tambahKategori,
  ubahKategori,
} from './repo-kategori';

function validasiPrefix(prefix: string): string | null {
  const p = prefix.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,10}$/.test(p)) {
    return 'Prefix 1–10 karakter: huruf kapital, angka, strip (tanpa spasi).';
  }
  return null;
}

export async function daftarKategoriAktif(): Promise<Kategori[]> {
  return daftarKategori(false);
}

export async function buatKategori(nama: string, prefixKode: string): Promise<Hasil<number>> {
  if (nama.trim().length < 1 || nama.trim().length > 50) {
    return { ok: false, galat: 'Nama kategori 1–50 karakter.' };
  }
  const v = validasiPrefix(prefixKode);
  if (v) return { ok: false, galat: v };
  try {
    const id = await tambahKategori(nama, prefixKode);
    return { ok: true, data: id };
  } catch {
    return { ok: false, galat: 'Nama atau prefix sudah dipakai kategori lain.' };
  }
}

export async function suntingKategori(
  id: number,
  nama: string,
  prefixKode: string
): Promise<Hasil<void>> {
  if (nama.trim().length < 1 || nama.trim().length > 50) {
    return { ok: false, galat: 'Nama kategori 1–50 karakter.' };
  }
  const v = validasiPrefix(prefixKode);
  if (v) return { ok: false, galat: v };
  // Prefix BOLEH diubah (keputusan final model-data.md §2 aturan 5):
  // kode barang yang sudah terbit TIDAK berubah (historis) —
  // hanya barang baru yang memakai prefix baru. Counter tidak di-reset.
  try {
    await ubahKategori(id, nama, prefixKode);
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Nama atau prefix sudah dipakai kategori lain.' };
  }
}

/**
 * Nonaktifkan kategori (soft delete) — SELALU boleh, walau masih punya barang.
 * Barang lama yang merujuknya tetap utuh (riwayat tidak patah); kategori
 * nonaktif disembunyikan dari pilihan dan tidak bisa dipakai barang baru.
 * Hapus permanen kategori yang masih punya barang ditolak database
 * (ON DELETE RESTRICT) — tidak ada jalur hapus permanen di aplikasi.
 */
export async function hapusKategori(id: number): Promise<Hasil<void>> {
  await nonaktifkanKategori(id);
  return { ok: true };
}
