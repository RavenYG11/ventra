// Service login — logika akun: setup awal, masuk, keluar, lupa password.
// Keputusan final Rama: reset = cek username → field reset unrestricted (tanpa password lama).
import bcrypt from 'bcryptjs';
import type { Hasil } from '../../types';
import { ambilPengguna, buatPengguna, hitungPengguna, ubahKataSandi } from './repo-pengguna';

const KUNCI_SESI = 'ventra_sesi';

export function validasiNamaPengguna(nama: string): string | null {
  const n = nama.trim().toLowerCase();
  if (!/^[a-z0-9-_]{3,30}$/.test(n)) {
    return 'Nama pengguna 3–30 karakter: huruf kecil, angka, strip, underscore.';
  }
  return null;
}

export function validasiKataSandi(sandi: string): string | null {
  if (sandi.length < 6) return 'Kata sandi minimal 6 karakter.';
  return null;
}

/** True bila aplikasi baru pertama dibuka (belum ada akun). */
export async function apakahButuhSetupAwal(): Promise<boolean> {
  return (await hitungPengguna()) === 0;
}

/** Membuat satu-satunya akun (hanya saat setup awal). */
export async function daftarAkunPertama(
  namaPengguna: string,
  kataSandi: string
): Promise<Hasil<void>> {
  const vNama = validasiNamaPengguna(namaPengguna);
  if (vNama) return { ok: false, galat: vNama };
  const vSandi = validasiKataSandi(kataSandi);
  if (vSandi) return { ok: false, galat: vSandi };
  if (!(await apakahButuhSetupAwal())) {
    return { ok: false, galat: 'Akun sudah ada. Gunakan halaman login.' };
  }
  const hash = await bcrypt.hash(kataSandi, 10);
  await buatPengguna(namaPengguna, hash);
  return { ok: true };
}

export async function masuk(namaPengguna: string, kataSandi: string): Promise<Hasil<void>> {
  const akun = await ambilPengguna(namaPengguna);
  if (!akun) return { ok: false, galat: 'Nama pengguna atau kata sandi salah.' };
  const cocok = await bcrypt.compare(kataSandi, akun.kata_sandi_hash);
  if (!cocok) return { ok: false, galat: 'Nama pengguna atau kata sandi salah.' };
  localStorage.setItem(KUNCI_SESI, akun.nama_pengguna);
  return { ok: true };
}

export function keluar(): void {
  localStorage.removeItem(KUNCI_SESI);
}

export function sesiAktif(): string | null {
  return localStorage.getItem(KUNCI_SESI);
}

/**
 * Langkah 1 lupa password: cek apakah username terdaftar.
 * Bila tidak ada, UI menampilkan pesan generik (anti-enumerasi akun).
 */
export async function cekUsernameUntukReset(namaPengguna: string): Promise<boolean> {
  const akun = await ambilPengguna(namaPengguna);
  return !!akun;
}

/**
 * Langkah 2 lupa password: set password baru secara langsung (unrestricted).
 * Hanya dipanggil setelah cekUsernameUntukReset mengembalikan true.
 */
export async function setelUlangKataSandi(
  namaPengguna: string,
  kataSandiBaru: string
): Promise<Hasil<void>> {
  const akun = await ambilPengguna(namaPengguna);
  if (!akun) return { ok: false, galat: 'Akun tidak ditemukan.' };
  const v = validasiKataSandi(kataSandiBaru);
  if (v) return { ok: false, galat: v };
  const hash = await bcrypt.hash(kataSandiBaru, 10);
  await ubahKataSandi(akun.nama_pengguna, hash);
  // TODO(v0.4/Cipher): catat event password_reset ke audit log keamanan.
  return { ok: true };
}
