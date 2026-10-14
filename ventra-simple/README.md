# Ventra Simple

Aplikasi stok barang **super-sederhana** — web murni, offline, 100% lokal di browser.
Satu tabel barang. Tanpa backend, tanpa internet.

> Branch kerja `ventra-simple` — **JANGAN merge ke `main` sebelum QA lolos** (assignment #40).

---

## Fitur (5 saja)

| # | Fitur | Keterangan |
|---|-------|-----------|
| F1 | Tambah barang | Nama (unik), stok awal, harga beli, harga jual + pratinjau hitungan otomatis |
| F2 | Hapus barang | Selalu konfirmasi dulu (hard delete) |
| F3 | Catat BELI | Stok += jumlah (atomik) |
| F4 | Catat JUAL | Stok −= jumlah; **DITOLAK** bila melebihi stok (stok tidak boleh negatif) |
| F5 | Daftar + ringkasan otomatis | Total jenis, nilai stok, potensi laba, barang menipis — ter-update tiap perubahan |

**Rumus** (keputusan final Rama):
- Nilai stok = Σ(stok × **harga beli**)
- Potensi laba = Σ(stok × (harga jual − harga beli))
- Badge: **Habis** (stok = 0) · **Menipis** (1–5 pcs) · **Aman** (> 5 pcs)

---

## Cara menjalankan (Windows)

```bat
git pull
npm install
npm run dev
```
Buka `http://localhost:5173` di Chrome/Edge.

**Deploy XAMPP:** `npm run build` → salin **isi** folder `dist/` ke
`C:\xampp\htdocs\ventra-simple` → Start Apache → buka `http://localhost/ventra-simple`.

> Catatan: harus dibuka via `http://` (localhost), tidak bisa dobel-klik `index.html`
> karena aplikasi memakai ES module — sama seperti Ventra full.

---

## Arsitektur

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────────────────┐
│  UI (React)  │ ───▶ │ PenyimpananBarang│ ──▶ │ SQLite-WASM (OPFS)       │
│  ui/*.tsx    │      │ (kontrak.ts)    │      │ worker.ts + sqlite.ts    │
│              │      │  = interface    │      │  di Web Worker           │
└──────────────┘      └─────────────────┘      └──────────────────────────┘
                                                     │ gagal? (crash/timeout/
                                                      │ OPFS tak tersedia)
                                                     ▼
                                              ┌──────────────────────────┐
                                              │ localStorage (fallback)  │
                                              │ lokal.ts                 │
                                              └──────────────────────────┘
```

- **UI tidak tahu backend apa** — hanya memanggil `PenyimpananBarang`
  (ide Sentot #43: interface sebagai pintu migrasi).
- **Aturan bisnis ditegakkan di penyimpanan**, bukan cuma di UI:
  nama unik (`UNIQUE COLLATE NOCASE`), `CHECK (stok >= 0)`, jual melebihi stok
  ditolak sebelum data diubah.
- **Fungsi murni** (`model.ts`, `ringkasan.ts`) — validasi & hitungan bisa diuji
  tanpa browser.

### Kenapa SQLite di worker?

`installOpfsSAHPoolVfs()` butuh `createSyncAccessHandle` yang **hanya ada di
Web Worker** (temuan 2026-10-14, assignment #21 — terbukti dari source resmi).
Pola ini dipakai ulang dari Ventra full yang sudah terbukti jalan.

### Kenapa ada fallback localStorage?

Pelajaran insiden 14 Okt 2026: satu kegagalan init = aplikasi blank. Di sini,
bila SQLite gagal total, aplikasi otomatis beralih ke localStorage dan
menampilkan banner **"Mode darurat"** + badge backend di topbar — aplikasi
tetap jalan, pengguna tahu apa yang terjadi.

### Header COOP/COEP — JANGAN DIHAPUS

`vite.config.ts` (dev) dan `public/.htaccess` (XAMPP) memaksa
`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`.
Tanpa ini, SharedArrayBuffer (dipakai SAH pool) tidak aktif dan worker SQLite
ditolak browser **secara diam-diam** (insiden VDB-W01). Ini pelajaran termahal
hari ini — header ini bukan opsional.

---

## Struktur folder

```
ventra-simple/
├── index.html            # entry HTML
├── package.json          # react, vite, TS, sqlite-wasm (versi terbukti)
├── vite.config.ts        # base './' + header COOP/COEP + worker format es
├── tsconfig.json
├── public/.htaccess      # COOP/COEP untuk Apache/XAMPP
├── README.md             # file ini
└── src/
    ├── main.tsx          # entry React
    ├── App.tsx           # boot, orkestrasi aksi, toast, layar galat
    ├── styles.css        # Template B (gelap operasional)
    ├── model.ts          # tipe + validasi murni + format rupiah
    ├── ringkasan.ts      # hitungan ringkasan (fungsi murni)
    ├── db/
    │   ├── kontrak.ts    # interface PenyimpananBarang (satu-satunya kontrak)
    │   ├── worker.ts     # engine SQLite di Web Worker (1 tabel `barang`)
    │   ├── sqlite.ts     # klien RPC main-thread + timeout + worker.onerror
    │   ├── lokal.ts      # fallback localStorage (aturan bisnis identik)
    │   └── buka.ts       # pilih backend: SQLite dulu, fallback localStorage
    └── ui/
        ├── Ringkasan.tsx     # 4 kartu ringkasan
        ├── FormBarang.tsx    # form tambah + pratinjau hitungan
        ├── DaftarBarang.tsx   # tabel + pencarian + badge + aksi
        ├── ModalJumlah.tsx   # modal stepper Beli/Jual
        └── DialogHapus.tsx   # konfirmasi hapus
```

Total ±1.500 baris (termasuk komentar Indonesia) — tidak ada file > 400 baris.

---

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|--------|---------------|--------|
| Badge "DB: LocalStorage" + banner kuning | OPFS gagal (mode private / worker diblokir) | Pakai Chrome/Edge mode normal, satu tab saja |
| "Timeout inisialisasi SQLite (15 detik)" lalu fallback | Worker lambat/gagal load | `Ctrl+C` semua proses vite → `npm run dev` ulang |
| Putih kosong setelah pull | Cache browser / service worker lama | Hard refresh (`Ctrl+Shift+R`) |
| Build gagal: `tsc` error | Tipe tidak cocok | Baca pesan error — biasanya di file yang disebut barisnya |

---

## Batasan jujur (v1)

1. Tanpa login/multi-user, tanpa riwayat transaksi, tanpa barcode, tanpa laporan Excel/PDF.
2. Satu tab disarankan (database satu koneksi).
3. Data terikat browser + origin: `localhost:5173` (dev) dan `localhost/ventra-simple`
   (XAMPP) = database **terpisah**.
4. Mode darurat localStorage: kuota ±5 MB (cukup untuk &lt;10.000 SKU).

---

*Diimplementasikan oleh Gunet (Software Engineer) — Assignment #44, 14 Okt 2026.*
*Desain: mockup Prapto #36 (Template B) · Arsitektur: Sentot #43 (interface PenyimpananBarang) ·
Spec: Kurniatot (spec-ventra-simple.md) · QA: Testarossa #40 (wajib lolos sebelum merge ke main).*
