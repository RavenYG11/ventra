// Service barang — validasi + aturan bisnis master barang.
// Sejak migrasi 003_kode_barang: tambah barang wajib memilih KODE BARANG
// (aktif & ter-mapping ke kategori yang dipilih) — counter menempel di kode.
import type { Barang, Hasil } from '../../types';
import { daftarKategori } from '../kategori/repo-kategori';
import { daftarKodeAktifUntukKategori } from '../kode-barang/repo-kode-barang';
import {
  ambilBarang,
  daftarBarang,
  nonaktifkanBarang,
  tambahBarangAtomik,
  ubahBarang,
  type BarangBaru,
  type BarangUbah,
} from './repo-barang';

function validasiAngka(nilai: number, nama: string): string | null {
  if (!Number.isInteger(nilai) || nilai < 0) return `${nama} harus bilangan bulat ≥ 0.`;
  return null;
}

function validasiForm(input: BarangBaru | BarangUbah): string | null {
  const nama = (input as BarangBaru).nama ?? '';
  if (nama.trim().length < 1 || nama.trim().length > 100) {
    return 'Nama barang 1–100 karakter.';
  }
  for (const [nilai, label] of [
    [input.harga_beli, 'Harga beli'],
    [input.harga_jual, 'Harga jual'],
    [input.stok_minimum, 'Stok minimum'],
  ] as Array<[number, string]>) {
    const v = validasiAngka(nilai, label);
    if (v) return v;
  }
  const stokAwal = (input as BarangBaru).stok_awal;
  if (stokAwal !== undefined) {
    const v = validasiAngka(stokAwal, 'Stok awal');
    if (v) return v;
  }
  return null;
}

export async function daftarSemuaBarang(kataKunci = ''): Promise<Barang[]> {
  return daftarBarang(kataKunci);
}

export async function tambahBarangBaru(
  input: BarangBaru,
  dibuatOleh: string
): Promise<Hasil<string>> {
  const v = validasiForm(input);
  if (v) return { ok: false, galat: v };
  const kategori = (await daftarKategori(false)).find((k) => k.id === input.kategori_id);
  if (!kategori) return { ok: false, galat: 'Pilih kategori yang valid.' };
  // Kode barang harus aktif DAN ter-mapping ke kategori ini (cek ganda di SQL CTE).
  const kodeValid = (await daftarKodeAktifUntukKategori(input.kategori_id)).some(
    (kb) => kb.id === input.kode_barang_id
  );
  if (!kodeValid) {
    return { ok: false, galat: 'Pilih kode barang yang valid untuk kategori ini.' };
  }
  try {
    const kode = await tambahBarangAtomik(input, dibuatOleh);
    return { ok: true, data: kode };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : 'Gagal menambah barang.' };
  }
}

export async function suntingBarang(id: number, input: BarangUbah): Promise<Hasil<void>> {
  const v = validasiForm(input);
  if (v) return { ok: false, galat: v };
  const ada = await ambilBarang(id);
  if (!ada || ada.aktif !== 1) return { ok: false, galat: 'Barang tidak ditemukan.' };
  await ubahBarang(id, input);
  return { ok: true };
}

export async function hapusBarang(id: number): Promise<Hasil<void>> {
  const ada = await ambilBarang(id);
  if (!ada) return { ok: false, galat: 'Barang tidak ditemukan.' };
  await nonaktifkanBarang(id);
  return { ok: true };
}

/** Format Rupiah Indonesia: 18000 → "Rp18.000". */
export function formatRupiah(nilai: number): string {
  return 'Rp' + Math.round(nilai).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
