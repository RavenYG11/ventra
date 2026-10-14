// Service kode barang + mapping — validasi + aturan bisnis.
// Keputusan final Rama (14 Okt 2026):
//   Q1: menu 'Product Management'. Q2: M:N fleksibel penuh.
//   Q3: dropdown auto-fill bila kategori hanya punya 1 kode. Q4: kategori wajib
//   punya minimal 1 kode barang aktif.
// Acuan validasi mengikat: docs/mockup-product-management.html (Prapto)
// dan docs/qa-kode-barang.md (Testarossa).
import type { Hasil, KodeBarang } from '../../types';
import {
  aktifkanKodeBarang as aktifkanKodeBarangRepo,
  daftarKodeBarang,
  daftarKodeBarangRingkasan,
  daftarKodeUntukKategori,
  hitungMappingAktifKecuali,
  hitungSemuaBarangDiKodeBarang,
  hubungkanMapping,
  infoMapping,
  lepasMapping,
  nonaktifkanKodeBarang,
  petaKategoriPerKode,
  petaKodePerKategori,
  pratinjauKodeBerikutnya,
  tambahKodeBarang,
  ubahKodeBarang,
  ubahKodePrefix,
  type InfoMapping,
  type KodeBarangRingkasan,
} from './repo-kode-barang';

export type { InfoMapping, KodeBarangRingkasan };
export { petaKodePerKategori };

const POLA_KODE = /^[A-Z0-9-]{1,10}$/;

/**
 * Validasi kode — STRICT seperti mockup (layar D "State Kosong & Validasi"):
 * huruf kecil DITOLAK (tidak di-uppercase diam-diam), pesan persis mockup.
 */
function validasiKode(kode: string): string | null {
  if (!POLA_KODE.test(kode.trim())) {
    return 'Kode harus huruf kapital, pola [A-Z0-9-], 1–10 karakter, tanpa spasi.';
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

/** Aktifkan kembali kode barang yang dinonaktifkan (QA KB-10, Q4-04). */
export async function aktifkanKodeBarang(id: number): Promise<Hasil<void>> {
  await aktifkanKodeBarangRepo(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mapping.
// ---------------------------------------------------------------------------

export async function muatInfoMapping(kategoriId: number): Promise<InfoMapping> {
  return infoMapping(kategoriId);
}

/** Peta kode -> nama kategori pemakai — untuk label "juga dipakai" tab Mapping. */
export async function muatPetaKategoriPerKode(): Promise<Record<number, string[]>> {
  return petaKategoriPerKode();
}

export async function hubungkanKode(
  kategoriId: number,
  kodeBarangId: number
): Promise<Hasil<void>> {
  await hubungkanMapping(kategoriId, kodeBarangId);
  return { ok: true };
}

/**
 * Lepas mapping — DITOLAK hanya bila pelepasan ini membuat kategori
 * kehabisan kode barang AKTIF (Q4). Melepas mapping ke kode yang sudah
 * nonaktif SELALU boleh (tidak mengurangi hitungan kode aktif).
 */
export async function lepasKode(kategoriId: number, kodeBarangId: number): Promise<Hasil<void>> {
  const sisaAktif = await hitungMappingAktifKecuali(kategoriId, kodeBarangId);
  if (sisaAktif === 0) {
    return {
      ok: false,
      galat:
        'DITOLAK: tidak bisa melepas mapping terakhir. Kategori wajib punya minimal 1 kode barang aktif.',
    };
  }
  await lepasMapping(kategoriId, kodeBarangId);
  return { ok: true };
}
