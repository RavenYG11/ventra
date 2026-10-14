// Repo barang — hanya SQL, tanpa logika bisnis (Ventra Simple).
// Satu-satunya lapisan yang boleh import DbVentra / dapatkanDb().
import { dapatkanDb } from '../../lib/db';
import type { Barang } from '../../types';

const KOLOM = 'id, nama, stok, harga_beli, harga_jual';

export async function semuaBarang(): Promise<Barang[]> {
  const db = await dapatkanDb();
  return db.select<Barang[]>(
    `SELECT ${KOLOM} FROM barang ORDER BY nama COLLATE NOCASE ASC`
  );
}

export async function cariBarang(kataKunci: string): Promise<Barang[]> {
  const db = await dapatkanDb();
  return db.select<Barang[]>(
    `SELECT ${KOLOM} FROM barang WHERE nama LIKE '%' || $1 || '%' COLLATE NOCASE
      ORDER BY nama COLLATE NOCASE ASC`,
    [kataKunci]
  );
}

export async function barangDenganId(id: number): Promise<Barang | null> {
  const db = await dapatkanDb();
  const baris = await db.select<Barang[]>(
    `SELECT ${KOLOM} FROM barang WHERE id = $1`,
    [id]
  );
  return baris[0] ?? null;
}

/** Cari berdasarkan nama (unik case-insensitive). Untuk cek duplikat. */
export async function barangDenganNama(nama: string): Promise<Barang | null> {
  const db = await dapatkanDb();
  const baris = await db.select<Barang[]>(
    `SELECT ${KOLOM} FROM barang WHERE nama = $1 COLLATE NOCASE`,
    [nama.trim()]
  );
  return baris[0] ?? null;
}

export async function sisipBarang(
  nama: string,
  stok: number,
  hargaBeli: number,
  hargaJual: number
): Promise<number> {
  const db = await dapatkanDb();
  const hasil = await db.execute(
    'INSERT INTO barang (nama, stok, harga_beli, harga_jual) VALUES ($1, $2, $3, $4)',
    [nama.trim(), stok, hargaBeli, hargaJual]
  );
  return hasil.lastInsertId;
}

export async function ubahBarang(
  id: number,
  nama: string,
  stok: number,
  hargaBeli: number,
  hargaJual: number
): Promise<void> {
  const db = await dapatkanDb();
  await db.execute(
    'UPDATE barang SET nama = $1, stok = $2, harga_beli = $3, harga_jual = $4 WHERE id = $5',
    [nama.trim(), stok, hargaBeli, hargaJual, id]
  );
}

/** Hard delete — tidak ada soft delete (keputusan spec). */
export async function hapusBarangPermanen(id: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('DELETE FROM barang WHERE id = $1', [id]);
}

/** Stok masuk: stok += jumlah (jumlah > 0 sudah divalidasi di service). */
export async function tambahStok(id: number, jumlah: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE barang SET stok = stok + $1 WHERE id = $2', [jumlah, id]);
}

/**
 * Stok keluar ATOMIK anti-stok-negatif (mitigasi R5):
 *   UPDATE barang SET stok = stok - ? WHERE id = ? AND stok >= ?
 *
 * DbVentra.execute hanya mengembalikan lastInsertId (bukan rows affected),
 * jadi keberhasilan dideteksi via SELECT ulang: stok harus berkurang persis
 * sejumlah `jumlah`. Bila guard WHERE gagal (stok < jumlah, barang hilang,
 * atau race dua klik) → stok tidak berubah → ok:false = DITOLAK.
 * CHECK (stok >= 0) di skema adalah sabuk pengaman lapis kedua.
 */
export async function kurangiStokAtomik(
  id: number,
  jumlah: number
): Promise<{ ok: boolean; stok: number }> {
  const db = await dapatkanDb();
  const awal = await db.select<Array<{ stok: number }>>(
    'SELECT stok FROM barang WHERE id = $1',
    [id]
  );
  if (awal[0] === undefined) return { ok: false, stok: 0 };
  const stokAwal = Number(awal[0].stok);
  await db.execute('UPDATE barang SET stok = stok - $1 WHERE id = $2 AND stok >= $1', [
    jumlah,
    id,
  ]);
  const akhir = await db.select<Array<{ stok: number }>>(
    'SELECT stok FROM barang WHERE id = $1',
    [id]
  );
  const stokAkhir = Number(akhir[0]?.stok ?? stokAwal);
  if (stokAkhir !== stokAwal - jumlah) return { ok: false, stok: stokAwal };
  return { ok: true, stok: stokAkhir };
}

/** Ringkasan agregat — dihitung di DB, bukan disimpan. */
export async function ringkasanAgregat(): Promise<{
  total_jenis: number;
  total_unit: number;
  total_nilai: number;
  potensi_laba: number;
}> {
  const db = await dapatkanDb();
  const baris = await db.select<
    Array<{ total_jenis: number; total_unit: number; total_nilai: number; potensi_laba: number }>
  >(
    `SELECT
       COUNT(*)                                   AS total_jenis,
       COALESCE(SUM(stok), 0)                     AS total_unit,
       COALESCE(SUM(stok * harga_beli), 0)        AS total_nilai,
       COALESCE(SUM(stok * (harga_jual - harga_beli)), 0) AS potensi_laba
     FROM barang`
  );
  const r = baris[0];
  return {
    total_jenis: Number(r?.total_jenis ?? 0),
    total_unit: Number(r?.total_unit ?? 0),
    total_nilai: Number(r?.total_nilai ?? 0),
    potensi_laba: Number(r?.potensi_laba ?? 0),
  };
}
