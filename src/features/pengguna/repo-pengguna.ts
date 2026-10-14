// Repo pengguna — hanya SQL, tanpa logika bisnis.
import { dapatkanDb } from '../../lib/db';

interface BarisPengguna {
  id: number;
  nama_pengguna: string;
  kata_sandi_hash: string;
}

export async function hitungPengguna(): Promise<number> {
  const db = await dapatkanDb();
  const baris: Array<{ jml: number }> = await db.select('SELECT COUNT(*) AS jml FROM pengguna');
  return baris[0].jml;
}

export async function ambilPengguna(namaPengguna: string): Promise<BarisPengguna | null> {
  const db = await dapatkanDb();
  const baris: BarisPengguna[] = await db.select(
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
