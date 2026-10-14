# Ventra Simple

Aplikasi **stock barang super-sederhana** — web, 100% offline, data lokal di browser.
Dibangun oleh tim Virtual Office untuk Rama.

**Status (14 Okt 2026):** Ventra Simple (v2) **SELESAI diimplementasi** — menggantikan
scope kompleks sebelumnya (kode barang, kategori, barcode/scan, laporan Excel/PDF).
Satu tabel barang, satu halaman utama, 5 fitur: tambah / hapus / catat BELI /
catat JUAL / ringkasan otomatis. Spec: `docs/spec-ventra-simple.md`; arsitektur:
`docs/arsitektur-ventra-simple.md`; rencana uji: `docs/qa-ventra-simple.md`.

## Fitur

- **Login 1 akun** (bcrypt) + lupa password (cek username → reset langsung)
- **Daftar Barang** — tabel + pencarian instan
- **Tambah / Ubah / Hapus** barang (hapus selalu minta konfirmasi)
- **Catat BELI** (stok +) dan **Catat JUAL** (stok −, ditolak bila stok tidak cukup)
- **Ringkasan otomatis**: jenis barang, total unit, nilai stok
  (Σ stok × harga beli), potensi laba (Σ stok × (harga jual − harga beli))
- **Badge stok**: Habis (0), Menipis (≤ 5), peringatan bila harga jual < harga beli
- **Unduh Backup** — file `.db` ke folder Download
- Tema **Template B** (gelap operasional)

## Teknologi

React 18 + Vite + TypeScript. Database **SQLite-WASM** (`@sqlite.org/sqlite-wasm`)
persisten di **OPFS browser** — engine berjalan di Web Worker
(`src/lib/db-worker.ts`; file DB baru `/ventra-simple.db`), tanpa server,
tanpa internet. Satuan terkunci "pcs".

## Cara jalan di Windows (laptop Rama)

```powershell
git pull
npm install
npm run dev
```

Lalu buka `http://localhost:5173`. Buat akun sekali (setup awal), masuk, pakai.

Deploy via XAMPP: `npm run build` → salin isi `dist/` ke `C:\xampp\htdocs\ventra`
→ buka `http://localhost/ventra` (file `.htaccess` di `public/` menyertakan
header COOP/COEP yang wajib untuk SQLite di worker).

> Catatan: database dev (`localhost:5173`) dan XAMPP (`localhost/ventra`) adalah
> origin berbeda → database terpisah.

## Struktur singkat

```
src/
  App.tsx                    Login → Daftar Barang (tanpa tab)
  pages/BarangPage.tsx        Daftar + ringkasan + dialog beli/jual/hapus
  pages/LoginPage.tsx         Login / setup awal / lupa password
  features/barang/           repo-barang.ts (SQL) + service-barang.ts (validasi)
  features/pengguna/         Login (1 akun, tanpa peran)
  lib/db.ts                  Proxy main-thread → worker (JANGAN ubah sembarangan)
  lib/db-worker.ts           Engine SQLite di worker (VFS opfs-sahpool)
  lib/backup.ts              Unduh backup (.db)
  components/ui.tsx          Komponen Template B
migrasi/ventra-simple.sql    Skema fresh (barang + pengguna + audit_keamanan)
```

## Troubleshooting

| Gejala | Solusi |
|---|---|
| Stuck "Memuat…" / galat database | Tutup SEMUA tab Ventra, buka satu tab baru, muat ulang. Klik "Salin detail teknis" untuk diagnosis. |
| Setelah update, tampilan aneh | `git pull` → `npm install` → restart `npm run dev` (matikan dulu dengan Ctrl+C). |
