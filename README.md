# Ventra

Aplikasi **stock barang sederhana** — desktop, 100% offline, data lokal di laptop.
Dibangun oleh tim Virtual Office untuk Rama.

**Status (14 Okt 2026):** Spesifikasi MVP v1 **BEKU**. Build kode v0.1 dimulai
setelah 3 keputusan final (mekanisme lupa-password, format kode barang, definisi
nilai stok) + pilihan template mockup.

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
| `docs/stock-barang-mvp-v1.md` | Spesifikasi MVP final — 24 keputusan terkunci, fitur, acceptance criteria |
| `docs/tech-stack.md` | Rincian tech stack + alasan tiap pilihan (Sentot) |
| `docs/model-data.md` | Model data: tabel, SQL, validasi, contoh & kasus batas (Broto) |
| `docs/pendekatan-teknis-gunet.md` | Pendekatan teknis & rencana build v0.1 → v1.0 (Gunet) |
| `docs/mvp-ventra.md` | Snapshot spesifikasi awal |

## Struktur (rencana)

```
src/            # React + TypeScript (UI, domain, lib)
src-tauri/      # Konfigurasi Tauri + Rust minimal
docs/           # Spesifikasi & keputusan terkunci
```

## Cara menjalankan

_Segera hadir setelah build v0.1 dimulai._

## Keputusan terkunci (ringkas)

Satu akun + login (tanpa peran) · satuan pcs · tanpa multi-gudang ·
offline lokal · barcode per item (display-only, tanpa printer) · scan via kamera ·
stok tidak boleh negatif · harga beli & jual manual, margin & nilai stok otomatis ·
laporan Excel & PDF · indikator visual stok menipis · reset password tanpa password lama ·
internal only, tanpa integrasi.
