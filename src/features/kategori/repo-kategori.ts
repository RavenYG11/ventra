// Repo kategori — hanya SQL, tanpa logika bisnis.
import { dapatkanDb } from '../../lib/db';
import type { Kategori } from '../../types';

export async function daftarKategori(termasukNonaktif = false): Promise<Kategori[]> {
  const db = await dapatkanDb();
  const klausa = termasukNonaktif ? '' : 'WHERE aktif = 1';
  return db.select<Kategori[]>(`SELECT * FROM kategori ${klausa} ORDER BY nama`);
}

export async function tambahKategori(nama: string, prefixKode: string): Promise<number> {
  const db = await dapatkanDb();
  const hasil = await db.execute('INSERT INTO kategori (nama, prefix_kode) VALUES ($1, $2)', [
    nama.trim(),
    prefixKode.trim().toUpperCase(),
  ]);
  return Number(hasil.lastInsertId);
}

export async function ubahKategori(id: number, nama: string, prefixKode: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kategori SET nama = $1, prefix_kode = $2 WHERE id = $3', [
    nama.trim(),
    prefixKode.trim().toUpperCase(),
    id,
  ]);
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
