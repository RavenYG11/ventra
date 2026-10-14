// Service barang — validasi + aturan bisnis (Ventra Simple).
// ATURAN LAPISAN: UI hanya boleh memanggil service ini; service dilarang
// import repo fitur lain; repo dilarang dipanggil UI langsung.
import type { Barang, Hasil } from '../../types';
import * as repo from './repo-barang';

export interface BarangInput {
  /** Nama barang (wajib, 1–100 karakter setelah trim, unik case-insensitive). */
  nama: string;
  /** Stok awal — integer ≥ 0. */
  stok: number;
  /** Harga beli — bilangan ≥ 0 (desimal wajar diizinkan). */
  harga_beli: number;
  /** Harga jual — bilangan ≥ 0 (boleh < harga beli: obral). */
  harga_jual: number;
}

export interface Ringkasan {
  /** COUNT(*) */
  total_jenis: number;
  /** SUM(stok) */
  total_unit: number;
  /** SUM(stok × harga_beli) — keputusan final Rama: nilai stok pakai harga beli */
  total_nilai: number;
  /** SUM(stok × (harga_jual − harga_beli)) */
  potensi_laba: number;
}

/** Format Rupiah: 12500 → "Rp 12.500", 12500.5 → "Rp 12.500,50". */
export function formatRupiah(nilai: number): string {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return 'Rp 0';
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

// ---------------------------------------------------------------------------
// Validasi (di SERVICE, bukan cuma di UI — spec §5 "validasi ganda").
// ---------------------------------------------------------------------------

function validasiNama(nama: string): string | null {
  const n = nama.trim();
  if (n.length === 0) return 'Nama barang wajib diisi.';
  if (n.length > 100) return 'Nama barang maksimal 100 karakter.';
  return null;
}

function validasiStok(stok: number): string | null {
  if (!Number.isInteger(stok) || stok < 0) {
    return 'Stok harus bilangan bulat ≥ 0.';
  }
  return null;
}

function validasiHarga(label: string, nilai: number): string | null {
  if (!Number.isFinite(nilai) || nilai < 0) {
    return `${label} harus bilangan ≥ 0.`;
  }
  return null;
}

function validasiJumlah(jumlah: number): string | null {
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    return 'Jumlah harus bilangan bulat > 0.';
  }
  return null;
}

/** Pesan ramah bila UNIQUE constraint DB yang menangkap duplikat (backstop race). */
function galatDbRamah(e: unknown, pesanDuplikat: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/UNIQUE/i.test(m)) return pesanDuplikat;
  return m;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** F1 — Tambah Barang. */
export async function tambahBarang(input: BarangInput): Promise<Hasil<Barang>> {
  const vNama = validasiNama(input.nama);
  if (vNama) return { ok: false, galat: vNama };
  const vStok = validasiStok(input.stok);
  if (vStok) return { ok: false, galat: vStok };
  const vBeli = validasiHarga('Harga beli', input.harga_beli);
  if (vBeli) return { ok: false, galat: vBeli };
  const vJual = validasiHarga('Harga jual', input.harga_jual);
  if (vJual) return { ok: false, galat: vJual };

  const duplikat = await repo.barangDenganNama(input.nama);
  if (duplikat) return { ok: false, galat: 'Barang dengan nama tersebut sudah ada.' };

  try {
    const id = await repo.sisipBarang(input.nama, input.stok, input.harga_beli, input.harga_jual);
    const barang = await repo.barangDenganId(id);
    return barang
      ? { ok: true, data: barang }
      : { ok: false, galat: 'Gagal membaca barang yang baru ditambah.' };
  } catch (e) {
    return { ok: false, galat: galatDbRamah(e, 'Barang dengan nama tersebut sudah ada.') };
  }
}

/** Ubah Barang (nama/stok/harga). */
export async function ubahBarang(id: number, input: BarangInput): Promise<Hasil<Barang>> {
  const ada = await repo.barangDenganId(id);
  if (!ada) return { ok: false, galat: 'Barang tidak ditemukan.' };

  const vNama = validasiNama(input.nama);
  if (vNama) return { ok: false, galat: vNama };
  const vStok = validasiStok(input.stok);
  if (vStok) return { ok: false, galat: vStok };
  const vBeli = validasiHarga('Harga beli', input.harga_beli);
  if (vBeli) return { ok: false, galat: vBeli };
  const vJual = validasiHarga('Harga jual', input.harga_jual);
  if (vJual) return { ok: false, galat: vJual };

  const duplikat = await repo.barangDenganNama(input.nama);
  if (duplikat && duplikat.id !== id) {
    return { ok: false, galat: 'Barang dengan nama tersebut sudah ada.' };
  }

  try {
    await repo.ubahBarang(id, input.nama, input.stok, input.harga_beli, input.harga_jual);
    const barang = await repo.barangDenganId(id);
    return barang
      ? { ok: true, data: barang }
      : { ok: false, galat: 'Gagal membaca barang yang baru diubah.' };
  } catch (e) {
    return { ok: false, galat: galatDbRamah(e, 'Barang dengan nama tersebut sudah ada.') };
  }
}

/** F2 — Hapus Barang (hard delete; konfirmasi di UI sebelum panggil). */
export async function hapusBarang(id: number): Promise<Hasil<void>> {
  const ada = await repo.barangDenganId(id);
  if (!ada) return { ok: false, galat: 'Barang tidak ditemukan.' };
  await repo.hapusBarangPermanen(id);
  return { ok: true };
}

/** Daftar semua barang (atau filter nama bila kataKunci diisi). */
export async function daftarBarang(kataKunci?: string): Promise<Barang[]> {
  const k = (kataKunci ?? '').trim();
  return k ? repo.cariBarang(k) : repo.semuaBarang();
}

/** Satu barang berdasarkan id. */
export async function ambilBarang(id: number): Promise<Barang | null> {
  return repo.barangDenganId(id);
}

// ---------------------------------------------------------------------------
// Operasi stok
// ---------------------------------------------------------------------------

/** F3 — Catat BELI: stok += jumlah (atomik, satu UPDATE). */
export async function beliBarang(id: number, jumlah: number): Promise<Hasil<Barang>> {
  const v = validasiJumlah(jumlah);
  if (v) return { ok: false, galat: v };
  const ada = await repo.barangDenganId(id);
  if (!ada) return { ok: false, galat: 'Barang tidak ditemukan.' };
  await repo.tambahStok(id, jumlah);
  const barang = await repo.barangDenganId(id);
  return barang
    ? { ok: true, data: barang }
    : { ok: false, galat: 'Gagal membaca stok setelah pembelian.' };
}

/**
 * F4 — Catat JUAL: stok -= jumlah, DITOLAK bila stok < jumlah.
 * Anti-stok-negatif: guard UPDATE ... WHERE stok >= ? di repo + verifikasi
 * SELECT ulang. Stok tidak pernah negatif lewat jalur apa pun.
 */
export async function jualBarang(id: number, jumlah: number): Promise<Hasil<Barang>> {
  const v = validasiJumlah(jumlah);
  if (v) return { ok: false, galat: v };
  const ada = await repo.barangDenganId(id);
  if (!ada) return { ok: false, galat: 'Barang tidak ditemukan.' };
  const hasil = await repo.kurangiStokAtomik(id, jumlah);
  if (!hasil.ok) {
    return { ok: false, galat: `Stok tidak mencukupi (sisa: ${hasil.stok} pcs).` };
  }
  const barang = await repo.barangDenganId(id);
  return barang
    ? { ok: true, data: barang }
    : { ok: false, galat: 'Gagal membaca stok setelah penjualan.' };
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

/** F5 — Ringkasan otomatis (dihitung, tidak disimpan). */
export async function hitungRingkasan(): Promise<Ringkasan> {
  return repo.ringkasanAgregat();
}
