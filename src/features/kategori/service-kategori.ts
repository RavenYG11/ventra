// Service kategori — validasi + aturan CRUD kategori.
import type { Hasil, Kategori } from '../../types';
import {
  daftarKategori,
  hitungBarangDiKategori,
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
  // Prefix tidak boleh diubah bila kategori sudah pernah menerbitkan kode,
  // supaya kode lama tidak menjadi yatim.
  const semua = await daftarKategori(true);
  const kat = semua.find((k) => k.id === id);
  if (kat && kat.nomor_urut_terakhir > 0 && kat.prefix_kode !== prefixKode.trim().toUpperCase()) {
    return { ok: false, galat: 'Prefix tidak bisa diubah: kategori ini sudah menerbitkan kode barang.' };
  }
  try {
    await ubahKategori(id, nama, prefixKode);
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Nama atau prefix sudah dipakai kategori lain.' };
  }
}

export async function hapusKategori(id: number): Promise<Hasil<void>> {
  const dipakai = await hitungBarangDiKategori(id);
  if (dipakai > 0) {
    return {
      ok: false,
      galat: `Kategori masih dipakai ${dipakai} barang aktif — tidak bisa dinonaktifkan.`,
    };
  }
  await nonaktifkanKategori(id);
  return { ok: true };
}
