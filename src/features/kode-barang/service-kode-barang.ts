// Service kode barang + mapping — validasi + aturan bisnis.
// Keputusan final Rama (14 Okt 2026):
//   Q1: menu 'Product Management'. Q2: M:N fleksibel penuh.
//   Q3: dropdown auto-fill bila kategori hanya punya 1 kode. Q4: kategori wajib
//   punya minimal 1 kode barang aktif.
import type { Hasil, KodeBarang } from '../../types';
import {
  daftarKodeBarang,
  daftarKodeBarangRingkasan,
  daftarKodeUntukKategori,
  hitungMappingAktif,
  hitungSemuaBarangDiKodeBarang,
  hubungkanMapping,
  infoMapping,
  lepasMapping,
  nonaktifkanKodeBarang,
  pratinjauKodeBerikutnya,
  tambahKodeBarang,
  ubahKodeBarang,
  ubahKodePrefix,
  type InfoMapping,
  type KodeBarangRingkasan,
} from './repo-kode-barang';

export type { InfoMapping, KodeBarangRingkasan };

const POLA_KODE = /^[A-Z0-9-]{1,10}$/;

function validasiKode(kode: string): string | null {
  if (!POLA_KODE.test(kode.trim().toUpperCase())) {
    return 'Kode 1–10 karakter: huruf kapital, angka, strip (tanpa spasi).';
  }
  return null;
}

function validasiNama(nama: string): string | null {
  const n = nama.trim();
  if (n.length < 1 || n.length > 50) return 'Nama tampilan 1–50 karakter.';
  return null;
}

export async function daftarSemuaKode(termasukNonaktif = false): Promise<KodeBarang[]> {
  return daftarKodeBarang(termasukNonaktif);
}

export async function daftarKodeRingkasan(): Promise<KodeBarangRingkasan[]> {
  return daftarKodeBarangRingkasan();
}

/** Kode aktif ter-mapping ke kategori — untuk dropdown form Tambah Barang. */
export async function daftarKodeAktifUntukKategori(kategoriId: number): Promise<KodeBarang[]> {
  return daftarKodeUntukKategori(kategoriId);
}

/** Preview "Kode berikutnya" (read-only, tanpa menaikkan counter). */
export async function kodeBerikutnya(kodeBarangId: number): Promise<string | null> {
  return pratinjauKodeBerikutnya(kodeBarangId);
}

export async function buatKodeBarang(
  kode: string,
  nama: string,
  keterangan?: string
): Promise<Hasil<number>> {
  const vk = validasiKode(kode);
  if (vk) return { ok: false, galat: vk };
  const vn = validasiNama(nama);
  if (vn) return { ok: false, galat: vn };
  try {
    const id = await tambahKodeBarang(kode, nama, keterangan);
    return { ok: true, data: id };
  } catch {
    return { ok: false, galat: 'Kode sudah dipakai kode barang lain.' };
  }
}

export async function suntingKodeBarang(
  id: number,
  input: { kode?: string; nama: string; keterangan?: string }
): Promise<Hasil<void>> {
  const vn = validasiNama(input.nama);
  if (vn) return { ok: false, galat: vn };
  try {
    // Kode (prefix) hanya boleh diubah bila BELUM PERNAH dipakai barang —
    // kode barang yang sudah terbit bersifat historis (tidak berubah).
    if (input.kode !== undefined) {
      const vk = validasiKode(input.kode);
      if (vk) return { ok: false, galat: vk };
      const dipakai = await hitungSemuaBarangDiKodeBarang(id);
      if (dipakai > 0) {
        return { ok: false, galat: 'Kode tidak bisa diubah — sudah dipakai barang.' };
      }
      await ubahKodePrefix(id, input.kode);
    }
    await ubahKodeBarang(id, input.nama, input.keterangan);
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Kode sudah dipakai kode barang lain.' };
  }
}

/**
 * Nonaktifkan kode barang (soft delete) — SELALU boleh.
 * Kode nonaktif hilang dari dropdown form barang, tetapi barang lama
 * yang memakainya tetap utuh (riwayat tidak patah).
 */
export async function hapusKodeBarang(id: number): Promise<Hasil<void>> {
  await nonaktifkanKodeBarang(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mapping.
// ---------------------------------------------------------------------------

export async function muatInfoMapping(kategoriId: number): Promise<InfoMapping> {
  return infoMapping(kategoriId);
}

export async function hubungkanKode(
  kategoriId: number,
  kodeBarangId: number
): Promise<Hasil<void>> {
  await hubungkanMapping(kategoriId, kodeBarangId);
  return { ok: true };
}

/**
 * Lepas mapping — DITOLAK bila ini mapping aktif terakhir milik kategori (Q4).
 * Kategori wajib punya minimal 1 kode barang aktif agar selalu bisa dipakai
 * membuat barang baru.
 */
export async function lepasKode(kategoriId: number, kodeBarangId: number): Promise<Hasil<void>> {
  const jml = await hitungMappingAktif(kategoriId);
  if (jml <= 1) {
    return {
      ok: false,
      galat:
        'DITOLAK: tidak bisa melepas mapping terakhir. Kategori wajib punya minimal 1 kode barang aktif.',
    };
  }
  await lepasMapping(kategoriId, kodeBarangId);
  return { ok: true };
}
