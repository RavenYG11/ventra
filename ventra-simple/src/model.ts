// Model domain Ventra Simple — tipe data + validasi MURNI (tanpa I/O).
//
// Fungsi di file ini bisa diuji tanpa browser/database (lensa Gunet:
// logika bisnis = fungsi murni). Bahasa: Indonesia, penamaan eksplisit.

/** Satu baris barang di tabel `barang`. Satuan: pcs (implisit). */
export interface Barang {
  id: number;
  nama: string;
  stok: number; // integer >= 0 — TIDAK BOLEH negatif (aturan Rama)
  hargaBeli: number; // rupiah >= 0, input manual
  hargaJual: number; // rupiah >= 0, input manual
}

/** Input form "Tambah Barang" — belum punya id. */
export interface BarangBaru {
  nama: string;
  stokAwal: number;
  hargaBeli: number;
  hargaJual: number;
}

/** Batas panjang nama (keputusan spec v2). */
export const NAMA_MAKS = 120;

/** Ambang "menipis": stok <= 5 (keputusan spec v2 + mockup Prapto #36). */
export const AMBANG_MENIPIS = 5;

export type StatusStok = 'habis' | 'menipis' | 'aman';

/** Status visual stok untuk badge di tabel. */
export function statusStok(stok: number): StatusStok {
  if (stok <= 0) return 'habis';
  if (stok <= AMBANG_MENIPIS) return 'menipis';
  return 'aman';
}

/**
 * Validasi input form tambah barang.
 * @returns daftar pesan galat (kosong = valid). Keunikan nama dicek di
 * lapisan penyimpanan (butuh baca database), bukan di sini.
 */
export function validasiBarangBaru(input: BarangBaru): string[] {
  const galat: string[] = [];
  const nama = input.nama.trim();
  if (!nama) {
    galat.push('Nama barang wajib diisi.');
  } else if (nama.length > NAMA_MAKS) {
    galat.push(`Nama barang maksimal ${NAMA_MAKS} karakter.`);
  }
  if (!Number.isInteger(input.stokAwal) || input.stokAwal < 0) {
    galat.push('Stok awal harus bilangan bulat >= 0.');
  }
  if (!Number.isFinite(input.hargaBeli) || input.hargaBeli < 0) {
    galat.push('Harga beli harus angka >= 0.');
  }
  if (!Number.isFinite(input.hargaJual) || input.hargaJual < 0) {
    galat.push('Harga jual harus angka >= 0.');
  }
  return galat;
}

/** Validasi jumlah untuk dialog Beli/Jual. @returns pesan galat atau null bila valid. */
export function validasiJumlah(jumlah: number): string | null {
  if (!Number.isInteger(jumlah) || jumlah < 1) {
    return 'Jumlah minimal 1 pcs (bilangan bulat).';
  }
  return null;
}

const formatRupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Format angka → "Rp 12.500" (keputusan spec: pemisah ribuan Indonesia). */
export function rupiah(nilai: number): string {
  return formatRupiah.format(Math.round(nilai));
}

/** Format angka cacah → "1.250" (pemisah ribuan Indonesia). */
export function formatPcs(nilai: number): string {
  return nilai.toLocaleString('id-ID');
}
