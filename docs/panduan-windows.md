# Ventra Simple — Panduan Windows (Laptop Rama)

**Untuk:** Rama · laptop Lenovo Windows 10/11 · **Oleh:** Epthal (DevOps) · 14 Okt 2026, ~21:30 WIB

Dokumen ini berdasarkan **verifikasi langsung** terhadap kode final implementasi Gunet
(repo `~/workspace/ventra-simple`): `npm install` fresh OK, `npm run build` LULUS
(tsc bersih + Vite 3,95 dtk), `npm run dev` merespons **HTTP 200** dengan header
COOP/COEP terserve dengan benar. Diuji di VM Linux (Node v24.20.0 / npm 10.9.4);
proyek ini tanpa native module & tanpa skrip shell khusus OS, jadi perilaku di
Windows praktis identik — yang beda hanya sintaks shell (dokumen ini memakai
PowerShell) dan path `C:\...`.

> ⚠️ **Catatan penting:** dokumen lama `docs/ventra-simple-windows.md` (assignment #41)
> mendeskripsikan desain *localStorage tanpa WASM* — itu rencana scaffold yang
> **tidak lagi sesuai** dengan kode final. Implementasi final memakai
> **SQLite-WASM + OPFS + Web Worker + COOP/COEP**. Ikuti dokumen ini, bukan yang lama.

---

## 1. Yang perlu diinstal (cukup sekali)

1. **Git for Windows** — https://git-scm.com/download/win (instal standar, next-next).
2. **Node.js LTS 18+** — https://nodejs.org (ambil versi LTS). Cek di PowerShell:
   ```powershell
   node -v
   npm -v
   ```
   Harus keluar angka versi (mis. `v20.x.x` / `10.x.x`). Kalau muncul
   `'npm' is not recognized`: **tutup PowerShell lalu buka lagi** (PATH baru
   terbaca setelah terminal dibuka ulang).
3. **Chrome / Edge versi terbaru** — wajib baru. Database memakai OPFS + Web Worker
   yang hanya stabil di Chrome/Edge modern (Chrome 109 ke atas; paling aman:
   update ke versi terbaru via ⋮ → Bantuan → Tentang Google Chrome).
4. **XAMPP** — hanya untuk mode produksi (Bagian 3). Tidak dibutuhkan untuk `npm run dev`.

Buka **PowerShell** (bukan CMD, bukan WSL). Ketik perintah **satu per satu** —
jangan digabung pakai `&&` (PowerShell 5.1 tidak mendukungnya).

---

## 2. Mode development — `git pull` → `npm install` → `npm run dev`

```powershell
# 1. Masuk ke folder REPO (tempat git clone — sesuaikan dengan lokasi Rama)
cd C:\xampp\htdocs\ventra-simple

# 2. Ambil kode terbaru dari GitHub
git pull

# 3. Instal dependensi (cukup sekali; ulangi hanya bila package.json berubah)
npm install

# 4. Jalankan dev server
npm run dev
```

Kalau berhasil, terminal menampilkan kurang-lebih:

```
  VITE v6.4.4  ready in 263 ms

  ➜  Local:   http://localhost:5173/
```

Buka **http://localhost:5173** di Chrome/Edge. Untuk berhenti: `Ctrl+C` di terminal.

**Aturan tab (PENTING — baca sebelum membuka):**

| Aturan | Alasan |
|---|---|
| Buka Ventra di **satu tab saja** | Database dikunci satu tab (OPFS). Tab kedua akan menampilkan pesan peringatan tab ganda, bukan error misterius. |
| Sebelum `git pull` / restart `npm run dev`: **tutup SEMUA tab** `localhost:5173`, lalu buka satu tab fresh | Mencegah lock basi & bundle lama nyangkut di cache worker. |
| **Jangan** pakai mode Incognito/Private | OPFS di private mode bisa dibatasi/dihapus browser sewaktu-waktu — data tidak aman. |
| Selalu hard-reload setelah update kode: `Ctrl+Shift+R` | Worker + WASM di-cache agresif oleh browser. |

---

## 3. Mode produksi (XAMPP) — `npm run build`

```powershell
# 1. Masuk ke folder REPO, pastikan kode terbaru
cd C:\xampp\htdocs\ventra-simple
git pull

# 2. Build (sekali jalan: type-check TypeScript + bundling Vite)
npm run build
```

Hasilnya ada di folder **`dist/`**. Salin **isi** `dist/` ke folder deploy Apache:

```powershell
# 3. Buat folder deploy bila belum ada, lalu salin isi dist/
New-Item -ItemType Directory -Force C:\xampp\htdocs\ventra
Copy-Item -Recurse -Force dist\* C:\xampp\htdocs\ventra\
```

Lalu:

4. Buka **XAMPP Control Panel** → klik **Start** pada Apache.
5. Buka browser: **http://localhost/ventra**

**Yang membuat ini jalan di XAMPP** (sudah termasuk di hasil build, tidak perlu
disetting manual):

- `dist/.htaccess` — ikut ter-copy dari `public/`. Isinya header
  `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`.
  **WAJIB ADA** — tanpa ini Chrome menolak memuat Web Worker database
  (error kosong yang mustahil didiagnosis; pelajaran 14 Okt 2026).
  Syarat Apache: modul `mod_headers` aktif — di XAMPP **aktif secara default**.
  Kalau Apache error soal `Header`, cek `httpd.conf` baris `LoadModule headers_module`.
- `base: './'` di `vite.config.ts` — semua URL aset (JS/CSS/WASM) relatif,
  jadi aplikasi jalan walau diserve dari subpath `/ventra`, bukan root domain.
  Terverifikasi: `dist/index.html` memuat `./assets/index-*.js`.

> ⚠️ Jangan buka dengan cara dobel-klik `index.html` di Explorer — Vite memakai
> ES module sehingga file harus diserve lewat HTTP (`npm run dev` atau Apache).
> Dibuka langsung dari file akan tampil kosong.

---

## 4. Gotcha Windows (daftar periksa)

1. **`'npm' is not recognized`** → tutup PowerShell, buka lagi. Masih gagal:
   instal ulang Node.js LTS (centang "Add to PATH").
2. **Port `5173` sudah dipakai** → dev server lama masih jalan. Tutup terminal
   lama (Ctrl+C), atau `npm run dev -- --port 5174` lalu buka port 5174.
3. **Layar "Memuat…" / error database setelah pull** → tutup SEMUA tab Ventra,
   buka satu tab fresh, `Ctrl+Shift+R`. Kalau error menampilkan kode `VDB-Wxx`,
   kirim teks lengkapnya ke tim (ada tombol "Salin detail teknis" di layar galat).
4. **Data "hilang" setelah pindah mode** → normal, bukan bug. Database terikat
   **origin**: dev (`http://localhost:5173`) dan produksi (`http://localhost`)
   adalah database **terpisah**. Pindahkan data via tombol **Unduh Backup**
   (file `.db`) lalu pulihkan di mode satunya.
5. **`npm run build` gagal dengan error TypeScript** → itu tugas tim, bukan Rama.
   Screenshot terminal, kirim ke tim. Jangan edit kode sendiri.
6. **Setelah `git pull`, tampilan aneh** → hard reload `Ctrl+Shift+R`; kalau
   tetap, tutup semua tab lalu buka satu tab baru (aturan tab, Bagian 2).
7. **Jangan campur folder repo dan folder deploy.** Contoh di atas memakai
   `C:\xampp\htdocs\ventra-simple` sebagai repo dan `C:\xampp\htdocs\ventra`
   sebagai deploy — `Copy-Item dist\*` hanya menyalin *isi*, bukan foldernya.
   Jangan pernah menjalankan `npm run dev` dari dalam `C:\xampp\htdocs\ventra`.

---

## 5. Ringkasan verifikasi DevOps (14 Okt 2026, ~21:30 WIB)

| Pemeriksaan | Hasil |
|---|---|
| `npm install` fresh (tanpa node_modules) | ✅ OK — 74 paket, 0 error |
| `npm run build` (`tsc && vite build`) | ✅ LULUS — tsc bersih, build 3,95 dtk |
| Isi `dist/` | ✅ `index.html`, bundle JS app, `db-worker-*.js` (worker DB), `sqlite3-*.wasm`, CSS, SQL migrasi ter-bundle, `.htaccess` ikut ter-copy |
| `npm run dev` | ✅ HTTP 200 di `http://localhost:5173`, header COOP/COEP terserve |
| Scripts `package.json` | ✅ lintas-OS semua (`tsc`, `vite`, `vite build`, `vite preview`) — tanpa `rm`/`cp`/shell Unix |
| Path hardcode gaya Unix di kode | ✅ tidak ada |
| `base: './'` (subpath XAMPP) | ✅ ya |
| Header COOP/COEP di `vite.config.ts` | ✅ ada (`same-origin` / `require-corp`) — JANGAN dihapus |
| `public/.htaccess` untuk XAMPP | ✅ ada |
| Worker DB (`src/lib/db-worker.ts`, format ES) | ✅ ter-bundle sebagai `dist/assets/db-worker-*.js` |

**Batas jujur:** verifikasi toolchain di atas berjalan di **Linux (VM)**, bukan
Windows — tetapi proyek ini tanpa native module dan tanpa skrip platform-spesifik,
sehingga perbedaan perilaku npm/Node antara Linux dan Windows praktis nol.
Verifikasi perilaku browser (boot aplikasi, login, transaksi) tetap dilakukan di
laptop Windows Rama oleh QA.

---

*Epthal (DevOps Engineer) — 14 Okt 2026. Dokumen ini ditulis lokal di
`docs/panduan-windows.md` dan **tidak di-push** (sesuai instruksi tugas).*
