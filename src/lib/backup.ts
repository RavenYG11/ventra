// Backup database — tombol "Unduh Backup" (lihat BarangPage).
//
// PIVOT WEB (assignment #18, keputusan Rama): browser TIDAK mengizinkan
// download otomatis saat tab ditutup, jadi mekanisme lama "backup otomatis
// saat aplikasi ditutup" (edisi Tauri) diganti tombol manual ini.
// User menekan tombol → file .db terunduh ke folder Download → bisa disimpan
// di flashdisk / tempat aman sebagai salinan cadangan.
import { eksporDatabase } from './db';

/**
 * Mengunduh salinan penuh database sebagai file .db.
 * Mengembalikan nama file yang terunduh (untuk toast/konfirmasi UI).
 */
export async function unduhBackup(): Promise<string> {
  const data = await eksporDatabase();
  const namaFile = `ventra-backup-${capWaktu()}.db`;
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  try {
    const tautan = document.createElement('a');
    tautan.href = url;
    tautan.download = namaFile;
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return namaFile;
}

/** Cap waktu lokal: YYYYMMDD-HHMMSS (cth. 20261014-175530). */
function capWaktu(): string {
  const d = new Date();
  const dua = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${dua(d.getMonth() + 1)}${dua(d.getDate())}` +
    `-${dua(d.getHours())}${dua(d.getMinutes())}${dua(d.getSeconds())}`
  );
}
