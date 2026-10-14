// Repo barang — hanya SQL, tanpa logika bisnis.
// Aturan: UI tidak boleh import file ini langsung — selalu lewat service-barang.ts.
//
// Sejak migrasi 003_kode_barang: counter nomor urut menempel di KODE BARANG
// (bukan kategori). Pembuatan barang wajib memilih kode barang yang ter-mapping
// ke kategorinya (M:N, keputusan Rama Q2).
import { dapatkanDb } from '../../lib/db';
import type { Barang } from '../../types';

export interface BarangBaru {
  nama: string;
  kategori_id: number;
  /** Kode barang yang dipakai — harus aktif & ter-mapping ke kategori. */
  kode_barang_id: number;
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
  return db.select<Barang[]>(
    `SELECT * FROM v_barang
      WHERE aktif = 1
        AND (lower(nama) LIKE $1 OR lower(kode) LIKE $1)
      ORDER BY nama`,
    [k]
  );
}

export async function ambilBarang(id: number): Promise<Barang | null> {
  const db = await dapatkanDb();
  const baris = await db.select<Barang[]>('SELECT * FROM v_barang WHERE id = $1', [id]);
  return baris[0] ?? null;
}

/**
 * Tambah barang + generate kode.
 *
 * Kode = kode (prefix) kode_barang + nomor urut 7 digit (cth. BRG-0000001).
 * Bila stok_awal > 0, sekalian catat transaksi "Stok awal" (audit lengkap dari nol).
 * Mengembalikan kode yang ter-generate.
 *
 * CATATAN ARSITEKTUR (temuan assignment #28 — BUG LAMA DIPERBAIKI):
 * pola lama memakai `WITH x AS (UPDATE ... RETURNING ...)` — ternyata SQLite
 * TIDAK mendukung DML (INSERT/UPDATE/DELETE) di dalam klausa WITH (terbukti
 * syntax error di sqlite-wasm 3.53.4, engine produksi). Artinya tambah barang
 * TIDAK PERNAH bisa jalan dengan pola itu. Pola baru di bawah memakai
 * `UPDATE ... RETURNING` LANGSUNG (tanpa WITH) — didukung SQLite 3.35+.
 *
 * Keamanan dari nomor ganda: (1) aplikasi memakai SATU koneksi SQLite
 * (lib/db.ts — worker memproses pesan berurutan, tidak ada interleaving);
 * (2) hanya satu tab boleh dibuka (BroadcastChannel); (3) satu pengguna.
 * Langkah 1 (UPDATE...RETURNING) bersifat atomik sendiri — counter naik dan
 * nilai baru terbaca dalam SATU statement, jadi tidak ada dua barang bisa
 * mendapat nomor yang sama. Bila langkah 2 gagal (praktis tidak mungkin —
 * kode unik global), hanya terjadi lompatan nomor (gap), bukan duplikat.
 *
 * Alur:
 *  1. UPDATE counter kode_barang (+1) + RETURNING kode & nomor baru — atomik.
 *     Syarat: kode aktif DAN ter-mapping ke kategori yang aktif. Bila tidak
 *     terpenuhi, tidak ada baris → fungsi melempar galat.
 *  2. INSERT barang; kode dirakit di JS (kode || 7-digit) dari nilai RETURNING.
 *     Kolom kode_barang_id dicatat untuk audit pola penomoran.
 *  3. INSERT baris "Stok awal"; hanya bila stok_awal > 0.
 */
export async function tambahBarangAtomik(
  input: BarangBaru,
  dibuatOleh: string
): Promise<string> {
  const db = await dapatkanDb();

  // Langkah 1 — naikkan counter + ambil kode & nomor baru (satu statement).
  const naik = await db.select<Array<{ kode: string; nomor_urut_terakhir: number }>>(
    `UPDATE kode_barang
        SET nomor_urut_terakhir = nomor_urut_terakhir + 1
      WHERE id = $2 AND aktif = 1
        AND EXISTS (
          SELECT 1 FROM kategori_kode_barang m
          JOIN kategori k ON k.id = m.kategori_id
          WHERE m.kode_barang_id = kode_barang.id
            AND m.kategori_id = $1
            AND k.aktif = 1
        )
      RETURNING kode, nomor_urut_terakhir`,
    [input.kategori_id, input.kode_barang_id]
  );
  if (naik.length === 0) {
    throw new Error('Kategori/kode barang tidak valid, nonaktif, atau belum terhubung.');
  }
  const kodeFinal = naik[0].kode + String(naik[0].nomor_urut_terakhir).padStart(7, '0');

  // Langkah 2 — INSERT barang.
  const hasilBarang = await db.execute(
    `INSERT INTO barang
       (kode, nama, kategori_id, kode_barang_id, harga_beli, harga_jual, stok, stok_awal,
        stok_minimum, keterangan, dibuat_pada, diubah_pada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $10)`,
    [
      kodeFinal,
      input.nama.trim(), // $2
      input.kategori_id, // $3
      input.kode_barang_id, // $4
      input.harga_beli, // $5
      input.harga_jual, // $6
      input.stok_awal, // $7
      input.stok_minimum, // $8
      input.keterangan?.trim() || null, // $9
      new Date().toISOString(), // $10 — dibuat_pada & diubah_pada
    ]
  );

  // Langkah 3 — transaksi "Stok awal" bila ada.
  if (input.stok_awal > 0) {
    await db.execute(
      `INSERT INTO transaksi_stok
         (barang_id, jenis, jumlah, stok_sebelum, stok_sesudah, keterangan,
          dibuat_oleh, dibuat_pada)
       VALUES ($1, 'masuk', $2, 0, $2, 'Stok awal', $3, $4)`,
      [Number(hasilBarang.lastInsertId), input.stok_awal, dibuatOleh, new Date().toISOString()]
    );
  }

  return kodeFinal;
}

export interface BarangUbah {
  nama: string;
  harga_beli: number;
  harga_jual: number;
  stok_minimum: number;
  keterangan?: string;
}

/**
 * Ubah barang — kode, kategori, kode barang, dan stok TIDAK bisa diubah di sini
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
