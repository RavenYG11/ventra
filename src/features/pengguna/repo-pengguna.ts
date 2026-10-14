// Repo pengguna — hanya SQL, tanpa logika bisnis.
import { dapatkanDb } from '../../lib/db';

interface BarisPengguna {
  id: number;
  nama_pengguna: string;
  kata_sandi_hash: string;
}

export async function hitungPengguna(): Promise<number> {
  const db = await dapatkanDb();
  const baris = await db.select<Array<{ jml: number }>>('SELECT COUNT(*) AS jml FROM pengguna');
  return baris[0].jml;
}

export async function ambilPengguna(namaPengguna: string): Promise<BarisPengguna | null> {
  const db = await dapatkanDb();
  const baris = await db.select<BarisPengguna[]>(
    'SELECT id, nama_pengguna, kata_sandi_hash FROM pengguna WHERE nama_pengguna = $1',
    [namaPengguna.trim().toLowerCase()]
  );
  return baris[0] ?? null;
}

export async function buatPengguna(namaPengguna: string, kataSandiHash: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute('INSERT INTO pengguna (id, nama_pengguna, kata_sandi_hash) VALUES (1, $1, $2)', [
    namaPengguna.trim().toLowerCase(),
    kataSandiHash,
  ]);
}

export async function ubahKataSandi(namaPengguna: string, kataSandiHashBaru: string): Promise<void> {
  const db = await dapatkanDb();
  await db.execute(
    `UPDATE pengguna
        SET kata_sandi_hash = $1,
            diubah_pada = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE nama_pengguna = $2`,
    [kataSandiHashBaru, namaPengguna.trim().toLowerCase()]
  );
}

export type PeristiwaKeamanan = 'login' | 'password_reset';
export type StatusKeamanan = 'berhasil' | 'gagal';

/**
 * Catat kejadian keamanan ke audit log (append-only — tidak ada UPDATE/DELETE
 * untuk tabel ini di seluruh aplikasi). Memenuhi stock-barang-mvp-v1.md §8.
 */
export async function catatAuditKeamanan(
  peristiwa: PeristiwaKeamanan,
  akun: string,
  status: StatusKeamanan
): Promise<void> {
  const db = await dapatkanDb();
  await db.execute(
    'INSERT INTO audit_keamanan (peristiwa, akun, status) VALUES ($1, $2, $3)',
    [peristiwa, akun.trim().toLowerCase(), status]
  );
}
