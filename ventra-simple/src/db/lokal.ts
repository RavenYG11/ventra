// Adapter localStorage — backend FALLBACK bila SQLite-OPFS gagal.
//
// Dipakai otomatis oleh db/buka.ts ketika: worker crash, OPFS tidak tersedia
// (mode private), atau init timeout. Aturan bisnis dibuat IDENTIK dengan
// worker SQLite (nama unik, stok >= 0, tolak jual melebihi stok) agar perilaku
// aplikasi sama apa pun backend-nya.
//
// Batasan jujur: kuota ±5 MB (cukup untuk <10.000 SKU), data terikat
// origin+profil browser — sama seperti OPFS.

import type { Barang, BarangBaru } from '../model';
import { validasiBarangBaru, validasiJumlah } from '../model';
import type { PenyimpananBarang } from './kontrak';
import { GALAT_STOK_KURANG, GALAT_NAMA_DUPLIKAT } from './kontrak';

const KUNCI_DATA = 'ventra-simple:barang:v1';
const KUNCI_COUNTER = 'ventra-simple:counter:v1';
const KUNCI_TMP = 'ventra-simple:barang:tmp:v1';

/** Baca & validasi bentuk data. Throw Error('DATA_RUSAK...') bila korup. */
function baca(): Barang[] {
  const mentah = localStorage.getItem(KUNCI_DATA);
  if (!mentah) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(mentah);
  } catch {
    throw new Error('DATA_RUSAK: isi penyimpanan lokal bukan JSON yang valid.');
  }
  if (!Array.isArray(parsed)) throw new Error('DATA_RUSAK: format data tidak dikenal.');
  return parsed.map((r: unknown, i: number) => {
    const o = r as Record<string, unknown>;
    const barang: Barang = {
      id: Number(o.id),
      nama: String(o.nama ?? ''),
      stok: Number(o.stok ?? 0),
      hargaBeli: Number(o.hargaBeli ?? 0),
      hargaJual: Number(o.hargaJual ?? 0),
    };
    const valid =
      Number.isInteger(barang.id) &&
      barang.nama.length > 0 &&
      Number.isInteger(barang.stok) && barang.stok >= 0 &&
      barang.hargaBeli >= 0 && barang.hargaJual >= 0;
    if (!valid) throw new Error(`DATA_RUSAK: baris ke-${i + 1} tidak valid.`);
    return barang;
  });
}

/**
 * Tulis atomik: tulis ke kunci sementara dulu, baru pindahkan ke kunci utama.
 * Mencegah data setengah-tulis bila browser ditutup di tengah jalan.
 */
function tulis(daftar: Barang[]): void {
  const json = JSON.stringify(daftar);
  localStorage.setItem(KUNCI_TMP, json);
  localStorage.setItem(KUNCI_DATA, json);
  localStorage.removeItem(KUNCI_TMP);
}

function counterBerikutnya(): number {
  const kini = Number(localStorage.getItem(KUNCI_COUNTER) ?? '0') || 0;
  const berikut = kini + 1;
  localStorage.setItem(KUNCI_COUNTER, String(berikut));
  return berikut;
}

function cari(daftar: Barang[], id: number): Barang {
  const b = daftar.find((x) => x.id === id);
  if (!b) throw new Error('Barang tidak ditemukan (id=' + id + ').');
  return b;
}

export function buatLokal(): PenyimpananBarang {
  return {
    namaBackend: 'localstorage',

    async daftar(): Promise<Barang[]> {
      return baca().sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    },

    async tambah(input: BarangBaru): Promise<Barang> {
      const daftarGalat = validasiBarangBaru(input);
      if (daftarGalat.length > 0) throw new Error(daftarGalat[0]);
      const nama = input.nama.trim();
      const daftar = baca();
      const duplikat = daftar.some((b) => b.nama.toLowerCase() === nama.toLowerCase());
      if (duplikat) throw new Error(GALAT_NAMA_DUPLIKAT);
      const barang: Barang = {
        id: counterBerikutnya(),
        nama,
        stok: input.stokAwal,
        hargaBeli: input.hargaBeli,
        hargaJual: input.hargaJual,
      };
      tulis([...daftar, barang]);
      return barang;
    },

    async hapus(id: number): Promise<void> {
      const daftar = baca();
      cari(daftar, id); // throw bila tidak ada
      tulis(daftar.filter((b) => b.id !== id));
    },

    async beli(id: number, jumlah: number): Promise<Barang> {
      const galat = validasiJumlah(jumlah);
      if (galat) throw new Error(galat);
      const daftar = baca();
      const b = cari(daftar, id);
      b.stok += jumlah;
      tulis(daftar);
      return { ...b };
    },

    async jual(id: number, jumlah: number): Promise<Barang> {
      const galat = validasiJumlah(jumlah);
      if (galat) throw new Error(galat);
      const daftar = baca();
      const b = cari(daftar, id);
      if (jumlah > b.stok) {
        throw new Error(
          GALAT_STOK_KURANG + ': Stok tidak mencukupi (sisa: ' + b.stok + ' pcs, diminta: ' + jumlah + ' pcs).'
        );
      }
      b.stok -= jumlah;
      tulis(daftar);
      return { ...b };
    },
  };
}

/** Hapus seluruh data lokal (dipakai layar "data rusak" — hanya atas perintah pengguna). */
export function hapusSemuaDataLokal(): void {
  localStorage.removeItem(KUNCI_DATA);
  localStorage.removeItem(KUNCI_COUNTER);
  localStorage.removeItem(KUNCI_TMP);
}
