// Repo kategori — hanya SQL, tanpa logika bisnis.
// Aturan: UI tidak boleh import file ini langsung — selalu lewat service-kategori.ts.
// Sejak migrasi 003_kode_barang: kolom prefix_kode & nomor_urut_terakhir PINDAH
// ke tabel kode_barang. Kategori kini hanya menyimpan nama (+ status aktif).
import { dapatkanDb } from '../../lib/db';
import type { Kategori } from '../../types';

export async function daftarKategori(termasukNonaktif = false): Promise<Kategori[]> {
  const db = await dapatkanDb();
  const klausa = termasukNonaktif ? '' : 'WHERE aktif = 1';
  return db.select<Kategori[]>(`SELECT * FROM kategori ${klausa} ORDER BY nama`);
}

export interface KategoriRingkasan extends Kategori {
  /** Jumlah kode barang AKTIF yang terhubung (via mapping). */
  jml_kode: number;
  /** Jumlah barang AKTIF di kategori ini. */
  jml_barang: number;
}

/** Daftar kategori + ringkasan untuk tab Kategori (Product Management). */
export async function daftarKategoriRingkasan(): Promise<KategoriRingkasan[]> {
  const db = await dapatkanDb();
  return db.select<KategoriRingkasan[]>(
    `SELECT k.*,
       (SELECT COUNT(*) FROM kategori_kode_barang m
         JOIN kode_barang kb ON kb.id = m.kode_barang_id
        WHERE m.kategori_id = k.id AND kb.aktif = 1) AS jml_kode,
       (SELECT COUNT(*) FROM barang b
        WHERE b.kategori_id = k.id AND b.aktif = 1) AS jml_barang
     FROM kategori k
     ORDER BY k.nama`
  );
}

export async function tambahKategori(nama: string): Promise<number> {
  const db = await dapatkanDb();
  const hasil = await db.execute('INSERT INTO kategori (nama) VALUES ($1)', [nama.trim()]);
  return Number(hasil.lastInsertId);
}

export async function ubahKategori(id: number, nama: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kategori SET nama = $1 WHERE id = $2', [nama.trim(), id]);
}

export async function nonaktifkanKategori(id: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kategori SET aktif = 0 WHERE id = $1', [id]);
}

export async function hitungBarangDiKategori(id: number): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>(
    'SELECT COUNT(*) AS jml FROM barang WHERE kategori_id = $1 AND aktif = 1',
    [id]
  );
  return baris[0].jml;
}
