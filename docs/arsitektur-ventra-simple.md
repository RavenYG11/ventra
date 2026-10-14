# Arsitektur Ventra Simple

**Penulis:** Sentot (Software Architect) — 2026-10-14, ~21:20 WIB
**Sumber:** clone repo `RavenYG11/ventra` branch `main` @ commit `a7563b8`, di `~/workspace/ventra-simple`
**Keputusan arsitektur:** riset storage (Magna) dan model data terpisah (Broto) DIBATALKAN 21:16 WIB — strategi database diputuskan di dokumen ini (bagian 3).

---

## 0. Prinsip yang mengikat

1. **AMAN > CERDAS.** Jangan sentuh apa pun yang terbukti jalan.
2. **SEDERHANA > LENGKAP.** Satu tabel barang, satu halaman utama, CRUD + beli/jual + ringkasan.
3. **Anti-blank-page.** Setiap perubahan UI diverifikasi tanpa error link-time/import mati.
4. **Windows-friendly.** User jalan di PowerShell (`npm install` → `npm run dev` / `npm run build`) — tidak boleh ada dependensi toolchain di luar npm.

---

## 1. Struktur folder/file final

### 1.1 Yang DIHAPUS (hapus total dari repo)

Fitur tidak diminta dan tidak akan dipakai:

- `src/pages/produk-manajemen/` — seluruh folder (`ProductManagementPage.tsx`, `TabKategori.tsx`, `TabKodeBarang.tsx`, `TabMapping.tsx`, `komponen.tsx`)
- `src/features/kategori/` — seluruh folder (`repo-kategori.ts`, `service-kategori.ts`)
- `src/features/kode-barang/` — seluruh folder (`repo-kode-barang.ts`, `service-kode-barang.ts`)
- `migrasi/003_kode_barang.sql` — skema kode barang tidak dipakai lagi
- `src/types/index.ts` bagian tipe `Kategori`, `KodeBarang` (lihat 1.2)

Dari `package.json` — dependensi tak terpakai (4):

- `@zxing/browser` (scan barcode kamera — dibatalkan)
- `jsbarcode` (render barcode — dibatalkan)
- `xlsx` (laporan Excel — dibatalkan)
- `jspdf`, `jspdf-autotable` (laporan PDF — dibatalkan)

Hapus juga `node_modules` & `package-lock.json` setelah edit `package.json` (user jalankan `npm install` ulang di Windows). Yang tersisa: `@sqlite.org/sqlite-wasm`, `bcryptjs` (login), `react`, `react-dom`, + devDependencies (`typescript`, `vite`, `@vitejs/plugin-react`, `@types/*`).

### 1.2 Yang DISEDERHANAKAN (tulis ulang, jangan ditempel)

- `src/features/barang/repo-barang.ts` → **tulis ulang**: hanya operasi ke tabel `barang` sederhana (lihat skema bagian 3). Hapus join ke `v_barang`, kategori, kode_barang, counter atomik.
- `src/features/barang/service-barang.ts` → **tulis ulang**: kontrak modul bagian 2. Hapus import silang ke `features/kategori` dan `features/kode-barang`.
- `src/pages/BarangPage.tsx` → **tulis ulang**: satu halaman, tanpa tab PM, tanpa dropdown kode/kategori. Boleh pakai `src/components/ui.tsx` yang ada.
- `src/types/index.ts` → **pangkas**: sisakan `Barang` versi sederhana + `Hasil<T>` + `Pengguna`.
- `src/App.tsx` → **pangkas**: hapus tab & import `ProductManagementPage`; tinggal Login → Barang.

### 1.3 Yang TETAP (jangan diubah — zero-touch)

| File | Alasan |
|---|---|
| `src/lib/db.ts` | Proxy DB, API publik `dapatkanDb`, `DbVentra{select,execute}`, `eksporDatabase`, `salinDetailTeknis` — terbukti jalan |
| `src/lib/db-worker.ts` | Engine SQLite di worker — satu-satunya perubahan yang diizinkan: nilai `NAMA_FILE_DB` (bagian 3) dan impor migrasi |
| `vite.config.ts` | Header COOP/COEP + `worker.format: 'es'` + `base: './'` — penyebab blank page sudah pernah tertembak di sini |
| `src/pages/LoginPage.tsx` | Login terbukti jalan, termasuk tombol "Salin detail teknis" & layar galat |
| `src/lib/backup.ts` | Unduh backup via `eksporDatabase` — jalan |
| `src/features/pengguna/` | Login tanpa peran — jalan |
| `migrasi/001_awal.sql`, `migrasi/002_audit_keamanan.sql` | Lihat bagian 3 — kemungkinan **tidak dipakai** di DB baru; keputusan eksplisit di sana |
| `public/.htaccess` | Header COOP/COEP untuk deploy XAMPP — wajib tetap ada |

Catatan: `App.tsx` menyebut `ProductManagementPage` — setelah file dihapus, import-nya **wajib** dihapus bersamaan dalam satu push, atau build pecah (pelajaran insiden blank white page 20:39 WIB: import mati = putih total).

---

## 2. Kontrak modul

### 2.1 Batasan lapisan (tidak berubah)

```
UI (pages/, components/)
  ↓  hanya panggil service; dilarang query DB langsung
service-barang.ts   ← validasi + aturan bisnis; dilarang panggil repo fitur lain
  ↓
repo-barang.ts      ← satu-satunya yang boleh import DbVentra / dapatkanDb()
  ↓
DbVentra { select, execute }  (src/lib/db.ts → worker)
```

`dapatkanDb()` di-cache di repo (panggil sekali per sesi). Repo selalu me-`await` `dapatkanDb()` sebelum query.

### 2.2 Kontrak `service-barang.ts`

```ts
import type { Barang, Hasil } from '../../types';

export interface BarangInput {
  nama: string;
  stok: number;        // stok awal, integer ≥ 0
  harga_beli: number;  // integer ≥ 0
  harga_jual: number;  // integer ≥ 0
}

// CRUD
export function tambahBarang(input: BarangInput): Promise<Hasil<Barang>>;
export function ubahBarang(id: number, input: BarangInput): Promise<Hasil<Barang>>;
export function hapusBarang(id: number): Promise<Hasil<void>>;
export function daftarBarang(kataKunci?: string): Promise<Barang[]>;
export function ambilBarang(id: number): Promise<Barang | null>;

// Operasi stok (transaksi sederhana — bukan tabel terpisah)
export function beliBarang(id: number, jumlah: number): Promise<Hasil<Barang>>;  // stok += jumlah
export function jualBarang(id: number, jumlah: number): Promise<Hasil<Barang>>;  // stok -= jumlah, tolak bila < 0

// Ringkasan (dihitung di service, bukan disimpan)
export interface Ringkasan {
  total_jenis: number;   // COUNT(*)
  total_unit: number;    // SUM(stok)
  total_nilai: number;   // SUM(stok * harga_beli) — keputusan Rama: nilai stok pakai harga beli
}
export function hitungRingkasan(): Promise<Ringkasan>;
```

**Validasi (wajib, di service — bukan cuma di UI):**
- `nama`: 1–100 karakter setelah trim; nama tidak boleh duplikat (cek `SELECT` sebelum insert — pesan galat "Nama barang sudah ada").
- Angka: integer ≥ 0 untuk stok/harga; `jumlah` beli/jual: integer > 0.
- `jualBarang`: `stok - jumlah ≥ 0`, bila tidak → `Hasil.galat = 'Stok tidak cukup (sisa X).'` — stok **tidak boleh negatif** (keputusan Rama).
- `hapusBarang`: hapus permanen (soft-delete `aktif` dihapus dari skema sederhana); konfirmasi di UI sebelum panggil.

### 2.3 Kontrak UI

- `App.tsx`: `LoginPage` bila belum login; sesudah login tampilkan **satu halaman** `BarangPage` (tanpa tab navigasi; header hanya brand + akun + Keluar).
- `BarangPage.tsx` memuat:
  - **Ringkasan** (3 kartu: Total jenis barang, Total unit, Total nilai stok) — refresh tiap operasi sukses.
  - **Tabel barang**: kolom Nama, Stok (indikator visual: merah bila 0, kuning bila ≤ 5), Harga beli, Harga jual, Nilai stok (= stok × harga_beli), Aksi (Beli / Jual / Ubah / Hapus).
  - **Form tambah/ubah** (modal atau inline): nama, stok, harga_beli, harga_jual.
  - **Dialog beli/jual**: input jumlah + tombol konfirmasi; tampilkan pesan galat service bila gagal.
  - **Tombol "Unduh backup"** (`lib/backup.ts`) + tombol **"Salin detail teknis"** hanya muncul bila ada galat DB (pola dari LoginPage — jangan buat pola baru).
- `BarangPage` dilarang import `DbVentra`/`dapatkanDb` langsung. Semua lewat `service-barang.ts`.
- Toast untuk feedback sukses/gagal (pola `tampilToast` yang sudah ada di `App.tsx` — pertahankan).

### 2.4 Alur data (contoh: jual)

```
BarangPage (klik Jual, jumlah=3)
  → service-barang.jualBarang(id, 3)
      → validasi: jumlah > 0 integer; ambil barang; cek stok-3 ≥ 0
      → repo-barang.kurangiStok(id, 3)  // UPDATE barang SET stok = stok - 3 WHERE id = ?
      → return { ok, data: barangTerbaru } atau { ok:false, galat }
  → UI refresh daftar + ringkasan; tampilkan toast
```

---

## 3. Strategi database

**Keputusan (Sentot, 2026-10-14 — menggantikan riset Magna & model Broto yang dibatalkan):**

> **Pakai file database BARU yang fresh: `/ventra-simple.db` (OPFS, path absolut — wajib untuk VFS opfs-sahpool). Skema lama (`/stok.db` + migrasi 001/002/003) TIDAK dibawa.**

**Alasan:**
1. **Tanpa beban migrasi.** Skema lama mengandung tabel `kategori`, `kode_barang`, mapping M:N, dan view `v_barang` yang semuanya dihapus dari fitur. Migrasi 003 mustahil di-"downgrade" dengan aman; satu skema CREATE TABLE fresh menghilangkan seluruh kelas bug migrasi.
2. **Windows-friendly & aman.** File DB lama (`/stok.db`) tetap utuh di OPFS browser Rama bila ia pernah menjalankannya — tidak ada risiko wipe data lama karena kita tidak pernah menulis ke file itu. `pastikanOpfsBisaDitulis()` (guard anti-wipe di db-worker.ts) tetap berjalan sebelum file baru dibuat.
3. **Sederhana untuk implementer.** Satu file skema = satu sumber kebenaran; tidak perlu memahami 3 migrasi lama.

**Perubahan kode yang dibutuhkan (kecil & terlokalisasi):**
- `src/lib/db-worker.ts`: `NAMA_FILE_DB = '/ventra-simple.db'`; ganti impor `migrasi/001_awal.sql` & `002_audit_keamanan.sql` dengan **satu file skema baru** `migrasi/ventra-simple.sql` (atau satu string CREATE TABLE inline di worker — pilih yang lebih sedikit mengubah pola impor dinamis berlabel fase yang sudah ada; rekomendasi: satu file `.sql` baru dengan pola `?raw` yang sama).
- `migrasi/003_kode_barang.sql` dihapus (bagian 1.1).
- `migrasi/001_awal.sql` & `002_audit_keamanan.sql` **dipertahankan di repo sebagai arsip** tetapi tidak diimpor worker — atau dihapus bila implementer mau; catat pilihannya di commit message.

**Asumsi eksplisit:**
- (A1) Data barang lama Rama (bila ada di `/stok.db`) **tidak dimigrasikan** — Ventra Simple mulai dari kosong. Rama belum pernah input barang (daftarnya kosong sejak awal — temuan #28), jadi asumsi ini aman.
- (A2) Tabel `pengguna` (login) perlu ada di DB baru — sertakan CREATE TABLE pengguna minimal di skema baru (1 akun, bcrypt hash), karena LoginPage memakainya. Cek `repo-pengguna.ts` untuk kolom yang dibutuhkan.
- (A3) `backup.ts`/`eksporDatabase` bekerja per-koneksi (export file aktif) — otomatis mengikuti `/ventra-simple.db` tanpa perubahan kode.

**Skema `barang` (final):**

```sql
CREATE TABLE IF NOT EXISTS barang (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL UNIQUE,
  stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  harga_beli  INTEGER NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual  INTEGER NOT NULL DEFAULT 0 CHECK (harga_jual >= 0)
);
```

Tidak ada: kode, kategori_id, satuan, stok_minimum, keterangan, aktif, timestamp. `CHECK (stok >= 0)` sebagai sabuk pengaman lapis kedua selain validasi service.

---

## 4. Risiko & mitigasi

| # | Risiko | Mitigasi |
|---|---|---|
| R1 | **Blank page** akibat import mati (pelajaran 20:39 WIB: `ProductManagementPage` dihapus tapi import di `App.tsx` tertinggal) | Hapus file + hapus import-nya dalam **satu push yang sama**. Setelah push, `tsc` + `vite build` wajib hijau sebelum instruksi pull ke Rama. Checklist: grep `produk-manajemen\|kategori\|kode-barang\|zxing\|jsbarcode\|xlsx\|jspdf` di `src/` harus kosong. |
| R2 | **Worker gagal load** (VDB-W01 pesan kosong) | Jangan ubah pola konstruksi worker & impor dinamis di `db-worker.ts`. Perubahan hanya pada `NAMA_FILE_DB` dan file `.sql` — pola `?raw` tetap. Header COOP/COEP di `vite.config.ts` dan `public/.htaccess` jangan disentuh. |
| R3 | **Windows path** | Kode tidak boleh mengandung path absolut Windows atau asumsi separator `/` vs `\`. Semua path aset relatif (`base: './'`). User hanya menjalankan perintah npm di PowerShell — tidak ada skrip `.sh`. |
| R4 | **Dependensi dihapus tapi masih diimpor** | Setelah edit `package.json`: hapus `node_modules` + `package-lock.json`, `npm install` ulang, lalu `npm run build`. Bila build hijau, tidak ada import sisa. |
| R5 | **Stok negatif via race** (dua klik Jual bersamaan) | `UPDATE barang SET stok = stok - ? WHERE id = ? AND stok >= ?`, lalu `SELECT stok` ulang untuk verifikasi (`DbVentra.execute` hanya mengembalikan `lastInsertId`, tidak ada row-count — jadi verifikasi via SELECT, bukan via return value). Bila stok tidak berubah → tolak "Stok tidak cukup". |
| R6 | **Nama duplikat** | `UNIQUE` di skema + cek service sebelum insert → pesan ramah, bukan error SQL mentah. |
| R7 | **Backup menunjuk file lama** | `eksporDatabase` mengekspor file DB aktif di koneksi worker — otomatis `/ventra-simple.db` setelah `NAMA_FILE_DB` diubah. Verifikasi: unduh backup, nama file berisi timestamp (lihat `backup.ts`). |

---

## 5. Checklist "definisi selesai" (untuk implementer)

**Kode:**
- [ ] `src/pages/produk-manajemen/`, `src/features/kategori/`, `src/features/kode-barang/`, `migrasi/003_kode_barang.sql` terhapus dari repo
- [ ] `package.json` tanpa `@zxing/browser`, `jsbarcode`, `xlsx`, `jspdf`, `jspdf-autotable`; `npm install` bersih di Windows
- [ ] `service-barang.ts` + `repo-barang.ts` tulis ulang sesuai kontrak bagian 2.2; tanpa import ke fitur yang dihapus
- [ ] `BarangPage.tsx` tulis ulang: ringkasan + tabel + form + dialog beli/jual + tombol backup
- [ ] `App.tsx` tanpa tab PM; `src/types/index.ts` dipangkas
- [ ] `db-worker.ts`: `NAMA_FILE_DB = '/ventra-simple.db'` + skema baru terimpor; migrasi lama tidak dijalankan
- [ ] `db.ts`, `db-worker.ts` (selain 2 baris di atas), `vite.config.ts`, `LoginPage.tsx`, `backup.ts`, `features/pengguna/` tidak berubah

**Verifikasi:**
- [ ] `npm run build` (tsc + vite build) hijau tanpa error
- [ ] grep sisa import mati: `produk-manajemen|features/kategori|features/kode-barang|zxing|jsbarcode|xlsx|jspdf` → kosong di `src/`
- [ ] Smoke test manual (di laptop Rama / browser): login → tambah barang → beli → jual → jual melebihi stok (ditolak) → ubah → hapus → ringkasan benar → unduh backup → reload (data persist di OPFS)
- [ ] Tidak ada blank page pada fresh load maupun setelah reload

**Dokumen (push bersamaan — aturan realtime update):**
- [ ] README diperbarui (fitur Ventra Simple, cara jalan di Windows)
- [ ] Dokumen ini + skema final tetap sinkron dengan kode

**Laporan ke Rama (via manager):** persen selesai, apa yang jadi, 1 perintah untuk user (`git pull` → `npm install` → `npm run dev`), tanpa jargon.

---

*Catatan arsitek: file ini sengaja tidak mengatur detail visual (itu wilayah Prapto/mockup) dan tidak mengatur test plan (itu wilayah Testarossa). Bila implementer menemukan kontrak bagian 2 tidak cukup, kembalikan ke Sentot — jangan improvisasi kontrak sendiri.*
