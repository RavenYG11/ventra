// Service kategori — validasi + aturan CRUD kategori.
// Sejak migrasi 003_kode_barang: form kategori hanya berisi NAMA
// (prefix & counter pindah ke entitas kode_barang).
import type { Hasil, Kategori } from '../../types';
import {
  aktifkanKategori as aktifkanKategoriRepo,
  daftarKategori,
  daftarKategoriRingkasan,
  hitungBarangDiKategori,
  nonaktifkanKategori,
  tambahKategori,
  ubahKategori,
  type KategoriRingkasan,
} from './repo-kategori';

export type { KategoriRingkasan };

export async function daftarKategoriAktif(): Promise<Kategori[]> {
  return daftarKategori(false);
}

export async function daftarKategoriDenganRingkasan(): Promise<KategoriRingkasan[]> {
  return daftarKategoriRingkasan();
}

function validasiNama(nama: string): string | null {
  const n = nama.trim();
  if (n.length < 1 || n.length > 50) return 'Nama kategori 1–50 karakter.';
  return null;
}

export async function buatKategori(nama: string): Promise<Hasil<number>> {
  const v = validasiNama(nama);
  if (v) return { ok: false, galat: v };
  try {
    const id = await tambahKategori(nama);
    return { ok: true, data: id };
  } catch {
    return { ok: false, galat: 'Nama kategori sudah dipakai.' };
  }
}

export async function suntingKategori(id: number, nama: string): Promise<Hasil<void>> {
  const v = validasiNama(nama);
  if (v) return { ok: false, galat: v };
  try {
    await ubahKategori(id, nama);
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Nama kategori sudah dipakai.' };
  }
}

/**
 * Nonaktifkan kategori (soft delete) — DITOLAK bila masih punya barang aktif
 * (mockup Product Management, mengikat). Kategori yang sudah kosong boleh
 * dinonaktifkan; barang lama yang merujuk kategori nonaktif tetap utuh.
 * Hapus permanen kategori yang masih punya barang ditolak database
 * (ON DELETE RESTRICT) — tidak ada jalur hapus permanen di aplikasi.
 */
export async function hapusKategori(id: number): Promise<Hasil<void>> {
  const jml = await hitungBarangDiKategori(id);
  if (jml > 0) {
    return {
      ok: false,
      galat: `DITOLAK: kategori masih punya ${jml} barang aktif. Nonaktifkan dulu barang-barangnya.`,
    };
  }
  await nonaktifkanKategori(id);
  return { ok: true };
}

/**
 * Aktifkan kembali kategori yang dinonaktifkan.
 * Kategori aktif yang belum punya kode barang aktif otomatis ter-flag
 * "⚠ TANPA KODE" di tab Kategori (aturan Q4).
 */
export async function aktifkanKategori(id: number): Promise<Hasil<void>> {
  await aktifkanKategoriRepo(id);
  return { ok: true };
}
