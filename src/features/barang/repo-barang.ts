// Repo barang — hanya SQL, tanpa logika bisnis.
// Aturan: UI tidak boleh import file ini langsung — selalu lewat service-barang.ts.
import { dapatkanDb } from '../../lib/db';
import type { Barang } from '../../types';

export interface BarangBaru {
  nama: string;
  kategori_id: number;
  harga_beli: number;
  harga_jual: number;
  stok_awal: number;
  stok_minimum: number;
  keterangan?: string;
}

/** Daftar barang aktif + kolom turunan (margin, nilai stok, status) via v_barang. */
export async function daftarBarang(kataKunci = ''): Promise<Barang[]> {
  const db = await dapatkanDb();
  const k = `%${kataKunci.trim().toLowerCase()}%`;
  return db.select(
    `SELECT * FROM v_barang
      WHERE aktif = 1
        AND (lower(nama) LIKE $1 OR lower(kode) LIKE $1)
      ORDER BY nama`,
    [k]
  );
}

export async function ambilBarang(id: number): Promise<Barang | null> {
  const db = await dapatkanDb();
  const baris: Barang[] = await db.select('SELECT * FROM v_barang WHERE id = $1', [id]);
  return baris[0] ?? null;
}

/**
 * Tambah barang + generate kode — ATOMIK dalam SATU statement SQL.
 *
 * Kode = prefix_kode kategori + nomor urut 7 digit (cth. BRG-0000001).
 * Bila stok_awal > 0, sekalian catat transaksi "Stok awal" (audit lengkap dari nol).
 * Mengembalikan kode yang ter-generate.
 *
 * KENAPA SATU STATEMENT (bukan BEGIN/COMMIT terpisah)?
 * @tauri-apps/plugin-sql mengeksekusi setiap execute()/select() pada koneksi
 * yang diambil dari connection pool — BEGIN, INSERT, dan COMMIT yang dikirim
 * lewat beberapa panggilan terpisah TIDAK dijamin mendarat di koneksi yang
 * sama (keterbatasan resmi plugin: tauri-apps/plugins-workspace#886).
 * Satu statement = satu koneksi pool = atomik menurut jaminan SQLite sendiri.
 * Pola ini dipakai untuk semua tulis multi-tabel di Ventra (lihat v0.2:
 * transaksi stok memakai pola CTE yang sama).
 *
 * Alur di dalam CTE (semua terjadi atomik):
 *  1. kategori_dinaikkan — UPDATE counter kategori (+1) secara atomik;
 *     mengembalikan prefix & nomor baru. Bila kategori tidak ada / nonaktif,
 *     CTE ini kosong → seluruh rantai ikut kosong → fungsi melempar galat.
 *  2. barang_baru — INSERT barang; kode dirakit di SQL
 *     (prefix || printf('%07d', nomor)) supaya konsisten dengan counter.
 *  3. transaksi_awal — INSERT baris "Stok awal"; hanya bila stok_awal > 0.
 */
export async function tambahBarangAtomik(
  input: BarangBaru,
  dibuatOleh: string
): Promise<string> {
  const db = await dapatkanDb();
  const baris: Array<{ id: number; kode: string }> = await db.select(
    `WITH kategori_dinaikkan AS (
       UPDATE kategori
          SET nomor_urut_terakhir = nomor_urut_terakhir + 1
        WHERE id = $1 AND aktif = 1
     RETURNING prefix_kode, nomor_urut_terakhir
     ),
     barang_baru AS (
       INSERT INTO barang
         (kode, nama, kategori_id, harga_beli, harga_jual, stok, stok_awal,
          stok_minimum, keterangan, dibuat_pada, diubah_pada)
       SELECT
         k.prefix_kode || printf('%07d', k.nomor_urut_terakhir),
         $2, $1, $3, $4, $5, $5, $6, $7, $8, $8
         FROM kategori_dinaikkan AS k
     RETURNING id, kode, stok_awal
     ),
     transaksi_awal AS (
       INSERT INTO transaksi_stok
         (barang_id, jenis, jumlah, stok_sebelum, stok_sesudah, keterangan,
          dibuat_oleh, dibuat_pada)
       SELECT b.id, 'masuk', b.stok_awal, 0, b.stok_awal, 'Stok awal', $9, $8
         FROM barang_baru AS b
        WHERE b.stok_awal > 0
     )
     SELECT id, kode FROM barang_baru`,
    [
      input.kategori_id, // $1
      input.nama.trim(), // $2
      input.harga_beli, // $3
      input.harga_jual, // $4
      input.stok_awal, // $5
      input.stok_minimum, // $6
      input.keterangan?.trim() || null, // $7
      new Date().toISOString(), // $8 — dibuat_pada & diubah_pada
      dibuatOleh, // $9 — audit: siapa yang mencatat
    ]
  );
  if (baris.length === 0) throw new Error('Kategori tidak valid atau sudah nonaktif.');
  return baris[0].kode;
}

export interface BarangUbah {
  nama: string;
  harga_beli: number;
  harga_jual: number;
  stok_minimum: number;
  keterangan?: string;
}

/**
 * Ubah barang — kode, kategori, dan stok TIDAK bisa diubah di sini
 * (kode final; stok hanya berubah lewat transaksi_stok mulai v0.2).
 */
export async function ubahBarang(id: number, input: BarangUbah): Promise<void> {
  const db = await dapatkanDb();
  await db.execute(
    `UPDATE barang
        SET nama = $1, harga_beli = $2, harga_jual = $3, stok_minimum = $4, keterangan = $5,
            diubah_pada = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = $6 AND aktif = 1`,
    [
      input.nama.trim(),
      input.harga_beli,
      input.harga_jual,
      input.stok_minimum,
      input.keterangan?.trim() || null,
      id,
    ]
  );
}

/** Soft delete: sembunyikan dari daftar, riwayat tetap utuh. */
export async function nonaktifkanBarang(id: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE barang SET aktif = 0 WHERE id = $1', [id]);
}
