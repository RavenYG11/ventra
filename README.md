# Ventra

Aplikasi **stock barang sederhana** — desktop, 100% offline, data lokal di laptop.
Dibangun oleh tim Virtual Office untuk Rama.

**Status (14 Okt 2026):** Spesifikasi MVP v1 **FINAL** (27 keputusan terkunci, tidak ada
pertanyaan terbuka). Build kode **v0.1 SELESAI** — scaffold Tauri + React + SQLite,
database + migrasi, login satu akun, master barang + kategori CRUD (kode otomatis),
layar login / daftar barang / kelola kategori ala Template B.

## Tech stack

- **Tauri 2 + TypeScript + React (Vite)** — aplikasi desktop Windows, installer ±15 MB
- **SQLite** — database satu file lokal (`stok.db`), tanpa server
- Barcode: generate Code128 per item (**jsbarcode**, tampil di UI) + scan via kamera laptop (**@zxing/browser**)
- Export laporan: Excel (**SheetJS**) & PDF (**jsPDF**)
- Backup otomatis lokal setiap aplikasi ditutup (retensi 7 hari)

## Fitur MVP (F1–F10)

Master barang (kode/SKU unik) → catat stok masuk → catat stok keluar
(**sistem menolak stok negatif**) → kartu stok / riwayat mutasi (audit trail
append-only) → dashboard + indikator stok menipis → laporan Excel/PDF →
stok opname → login satu akun → fondasi non-fungsional.

Detail lengkap: [`docs/stock-barang-mvp-v1.md`](docs/stock-barang-mvp-v1.md)

## Dokumen

| File | Isi |
|------|-----|
| `docs/stock-barang-mvp-v1.md` | Spesifikasi MVP final — 27 keputusan terkunci, fitur, acceptance criteria |
| `docs/tech-stack.md` | Rincian tech stack + alasan tiap pilihan (Sentot) |
| `docs/model-data.md` | Model data: tabel, SQL, validasi, contoh & kasus batas (Broto) |
| `docs/pendekatan-teknis-gunet.md` | Pendekatan teknis & rencana build v0.1 → v1.0 (Gunet) |
| `docs/desain-template-b.md` | Token desain Template B untuk implementasi (Prapto) |
| `docs/mvp-ventra.md` | Snapshot spesifikasi awal |

## Struktur

```
src/            # React + TypeScript (UI, domain, lib)
src-tauri/      # Konfigurasi Tauri + Rust minimal
migrasi/        # File migrasi SQL SQLite
docs/           # Spesifikasi & keputusan terkunci
```

## Cara menjalankan (development)

**Kebutuhan:** Windows 10/11 64-bit, Node.js 18+, Rust (via [rustup](https://rustup.rs)).

1. `git clone https://github.com/RavenYG11/ventra && cd ventra`
2. `npm install`
3. `npm run tauri dev` — aplikasi jalan dalam mode development

**Build installer (.exe):** `npm run build:all` → hasil di `src-tauri/target/release/bundle/`

**Catatan:** kode v0.1 sudah ditulis dan direview, tapi **belum diverifikasi compile**
(tidak ada toolchain Node/Rust di mesin build) — wajib spike `npm install` +
`npm run tauri dev` di laptop dev/Rama sebelum v0.1 dinyatakan selesai final.
Ikon aplikasi (`src-tauri/icons/`) belum ada — wajib diisi sebelum packaging.

## Keputusan terkunci (ringkas)

Satu akun + login (tanpa peran) · satuan pcs · tanpa multi-gudang ·
offline lokal · barcode per item (display-only, tanpa printer) · scan via kamera ·
stok tidak boleh negatif · harga beli & jual manual, margin & nilai stok otomatis
(nilai stok = stok × harga beli) · laporan Excel & PDF · indikator visual stok menipis ·
reset password tanpa password lama · backup otomatis saat aplikasi ditutup (7 hari) ·
internal only, tanpa integrasi.
