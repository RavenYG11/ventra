// Repo kode_barang + mapping kategori_kode_barang — hanya SQL, tanpa logika bisnis.
// Aturan: UI tidak boleh import file ini langsung — selalu lewat service-kode-barang.ts.
// Relasi M:N fleksibel penuh (keputusan Rama Q2, 14 Okt 2026).
import { dapatkanDb } from '../../lib/db';
import type { KodeBarang } from '../../types';

export async function daftarKodeBarang(termasukNonaktif = false): Promise<KodeBarang[]> {
  const db = await dapatkanDb();
  const klausa = termasukNonaktif ? '' : 'WHERE aktif = 1';
  return db.select<KodeBarang[]>(`SELECT * FROM kode_barang ${klausa} ORDER BY kode`);
}

export interface KodeBarangRingkasan extends KodeBarang {
  jml_barang: number;
  /** Semua barang (aktif + nonaktif) — untuk kunci field kode (QA BUG-5). */
  jml_barang_semua: number;
  jml_kategori: number;
}

/** Daftar kode barang + ringkasan untuk tab Kode Barang (Product Management). */
export async function daftarKodeBarangRingkasan(): Promise<KodeBarangRingkasan[]> {
  const db = await dapatkanDb();
  return db.select<KodeBarangRingkasan[]>(
    `SELECT kb.*,
       (SELECT COUNT(*) FROM barang b WHERE b.kode_barang_id = kb.id AND b.aktif = 1) AS jml_barang,
       (SELECT COUNT(*) FROM barang b WHERE b.kode_barang_id = kb.id) AS jml_barang_semua,
       (SELECT COUNT(*) FROM kategori_kode_barang m WHERE m.kode_barang_id = kb.id) AS jml_kategori
     FROM kode_barang kb
     ORDER BY kb.kode`
  );
}

export async function tambahKodeBarang(
  kode: string,
  nama: string,
  keterangan?: string
): Promise<number> {
  const db = await dapatkanDb();
  const hasil = await db.execute(
    'INSERT INTO kode_barang (kode, nama, keterangan) VALUES ($1, $2, $3)',
    [kode.trim().toUpperCase(), nama.trim(), keterangan?.trim() || null]
  );
  return Number(hasil.lastInsertId);
}

/** Ubah nama & keterangan. Kode (prefix) diubah via ubahKodePrefix (aturan terpisah). */
export async function ubahKodeBarang(id: number, nama: string, keterangan?: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kode_barang SET nama = $1, keterangan = $2 WHERE id = $3', [
    nama.trim(),
    keterangan?.trim() || null,
    id,
  ]);
}

/** Ubah kode (prefix) — hanya boleh bila belum pernah dipakai barang (dijaga service). */
export async function ubahKodePrefix(id: number, kode: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kode_barang SET kode = $1 WHERE id = $2', [
    kode.trim().toUpperCase(),
    id,
  ]);
}

/** Soft delete: sembunyikan dari dropdown, barang lama tetap utuh. */
export async function nonaktifkanKodeBarang(id: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kode_barang SET aktif = 0 WHERE id = $1', [id]);
}

/** Jumlah barang AKTIF yang memakai kode ini (untuk kolom Jml Barang). */
export async function hitungBarangDiKodeBarang(id: number): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>(
    'SELECT COUNT(*) AS jml FROM barang WHERE kode_barang_id = $1 AND aktif = 1',
    [id]
  );
  return baris[0].jml;
}

/** Jumlah SEMUA barang (aktif + nonaktif) yang pernah memakai kode ini. */
export async function hitungSemuaBarangDiKodeBarang(id: number): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>(
    'SELECT COUNT(*) AS jml FROM barang WHERE kode_barang_id = $1',
    [id]
  );
  return baris[0].jml;
}

/** Kode barang AKTIF yang ter-mapping ke kategori — untuk dropdown form barang. */
export async function daftarKodeUntukKategori(kategoriId: number): Promise<KodeBarang[]> {
  const db = await dapatkanDb();
  return db.select<KodeBarang[]>(
    `SELECT kb.* FROM kode_barang kb
     JOIN kategori_kode_barang m ON m.kode_barang_id = kb.id
     WHERE m.kategori_id = $1 AND kb.aktif = 1
     ORDER BY kb.kode`,
    [kategoriId]
  );
}

/** Preview kode berikutnya TANPA menaikkan counter (read-only). */
export async function pratinjauKodeBerikutnya(kodeBarangId: number): Promise<string | null> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ kode: string; n: number }>>(
    'SELECT kode, nomor_urut_terakhir AS n FROM kode_barang WHERE id = $1 AND aktif = 1',
    [kodeBarangId]
  );
  if (baris.length === 0) return null;
  return baris[0].kode + String(baris[0].n + 1).padStart(7, '0');
}

// ---------------------------------------------------------------------------
// Mapping kategori <-> kode barang (tab Mapping).
// ---------------------------------------------------------------------------

export interface InfoMapping {
  kategori_id: number;
  /** Semua kode yang terhubung (aktif + nonaktif). */
  terhubung: KodeBarang[];
  /** Kode AKTIF yang belum terhubung ke kategori ini (boleh dari kategori lain — M:N). */
  tersedia: KodeBarang[];
}

export async function infoMapping(kategoriId: number): Promise<InfoMapping> {
  const db = await dapatkanDb();
  const terhubung = await db.select<KodeBarang[]>(
    `SELECT kb.* FROM kode_barang kb
     JOIN kategori_kode_barang m ON m.kode_barang_id = kb.id
     WHERE m.kategori_id = $1 ORDER BY kb.kode`,
    [kategoriId]
  );
  const tersedia = await db.select<KodeBarang[]>(
    `SELECT kb.* FROM kode_barang kb
     WHERE kb.aktif = 1
       AND NOT EXISTS (SELECT 1 FROM kategori_kode_barang m
                       WHERE m.kode_barang_id = kb.id AND m.kategori_id = $1)
     ORDER BY kb.kode`,
    [kategoriId]
  );
  return { kategori_id: kategoriId, terhubung, tersedia };
}

export async function hubungkanMapping(kategoriId: number, kodeBarangId: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute(
    'INSERT OR IGNORE INTO kategori_kode_barang (kategori_id, kode_barang_id) VALUES ($1, $2)',
    [kategoriId, kodeBarangId]
  );
}

export async function lepasMapping(kategoriId: number, kodeBarangId: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('DELETE FROM kategori_kode_barang WHERE kategori_id = $1 AND kode_barang_id = $2', [
    kategoriId,
    kodeBarangId,
  ]);
}

/** Jumlah mapping ke kode AKTIF milik kategori — untuk validasi Q4. */
export async function hitungMappingAktif(kategoriId: number): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>(
    `SELECT COUNT(*) AS jml FROM kategori_kode_barang m
     JOIN kode_barang kb ON kb.id = m.kode_barang_id
     WHERE m.kategori_id = $1 AND kb.aktif = 1`,
    [kategoriId]
  );
  return baris[0].jml;
}

/**
 * Peta kategori_id -> daftar kode AKTIF yang terhubung (satu query).
 * Untuk kolom "Kode Barang Terhubung" di tab Kategori.
 */
export async function petaKodePerKategori(): Promise<Record<number, KodeBarang[]>> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<KodeBarang & { kategori_id: number }>>(
    `SELECT kb.*, m.kategori_id FROM kode_barang kb
     JOIN kategori_kode_barang m ON m.kode_barang_id = kb.id
     WHERE kb.aktif = 1
     ORDER BY kb.kode`
  );
  const peta: Record<number, KodeBarang[]> = {};
  for (const b of baris) {
    (peta[b.kategori_id] ??= []).push(b);
  }
  return peta;
}

/** Aktifkan kembali kode barang yang dinonaktifkan (QA KB-10, Q4-04). */
export async function aktifkanKodeBarang(id: number): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('UPDATE kode_barang SET aktif = 1 WHERE id = $1', [id]);
}

/**
 * Jumlah mapping ke kode AKTIF milik kategori, KECUALI satu pasangan.
 * Untuk validasi Q4 saat melepas: penolakan hanya bila pelepasan ini
 * membuat kategori kehabisan kode aktif (sisa = 0).
 */
export async function hitungMappingAktifKecuali(
  kategoriId: number,
  kecualiKodeBarangId: number
): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>(
    `SELECT COUNT(*) AS jml FROM kategori_kode_barang m
     JOIN kode_barang kb ON kb.id = m.kode_barang_id
     WHERE m.kategori_id = $1 AND kb.aktif = 1 AND m.kode_barang_id <> $2`,
    [kategoriId, kecualiKodeBarangId]
  );
  return baris[0].jml;
}

/**
 * Peta kode_barang_id -> nama-nama kategori pemakai (satu query).
 * Untuk label "juga dipakai: ..." di daftar Tersedia tab Mapping (QA BUG-7).
 */
export async function petaKategoriPerKode(): Promise<Record<number, string[]>> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ kode_barang_id: number; nama_kategori: string }>>(
    `SELECT m.kode_barang_id, kat.nama AS nama_kategori
     FROM kategori_kode_barang m
     JOIN kategori kat ON kat.id = m.kategori_id
     ORDER BY kat.nama`
  );
  const peta: Record<number, string[]> = {};
  for (const b of baris) {
    (peta[b.kode_barang_id] ??= []).push(b.nama_kategori);
  }
  return peta;
}
