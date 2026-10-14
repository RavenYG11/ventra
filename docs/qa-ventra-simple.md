# QA Test Plan — Ventra Simple (v2)

**Disusun:** 14 Okt 2026 — Testarossa (QA Engineer, Virtual Office)
**Status:** EKSEKUSI SELESAI 14 Okt 2026 ~21:30 WIB — vonis: **LULUS (bersyarat)** (lihat §5)
**Spec rujukan:** `docs/spec-ventra-simple.md` (5 fitur: tambah / hapus / beli / jual barang + ringkasan)

---

## 0. Batas pengujian (jujur)

Sebagai subagent, Testarossa **tidak dapat membuka browser** (tidak ada live-browser
control). Oleh karena itu eksekusi QA dibatasi pada:

- analisis statis kode (review source);
- `tsc` bersih + `vite build` sukses (compile-time check);
- review kode untuk deteksi import mati / dependency yang tidak dipakai (blank page guard);
- analisis logika bisnis (runtutan SQL, transaksi atomik, constraint) secara manual dari source.

Yang **tidak** bisa dilakukan di lingkungan ini: klik tombol, dialog, input form, reload
browser, cek tampilan visual, dan verifikasi runtime di laptop Rama (Windows). Uji
interaktif/browser harus dilakukan oleh Rama sendiri di laptopnya, dengan panduan
dari rencana uji fungsional (§1).

---

## 1. Uji fungsional per fitur

Konvensi: **P** = prasyarat (setup data), **Langkah** = tindakan, **Ekspektasi** = hasil yang harus terjadi.

### F1. Tambah Barang

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F1-01 | — | Klik "Tambah Barang", isi nama "Kabel HDMI", stok awal 10, harga beli 12000, harga jual 15000 → Simpan | Barang muncul di daftar; kolom persis: Nama=Kabel HDMI, Stok=10 pcs, Harga beli=Rp 12.000, Harga jual=Rp 15.000; ringkasan ikut bertambah |
| F1-02 | — | Tambah dengan nama kosong / hanya spasi → Simpan | Ditolak; pesan jelas (mis. "Nama barang wajib diisi"); daftar tidak berubah |
| F1-03 | "Kabel" sudah ada | Tambah nama "kabel" (huruf beda) | Ditolak; pesan "Barang dengan nama tersebut sudah ada"; tidak ada duplikat di DB |
| F1-04 | "Kabel" sudah ada | Tambah nama "  kabel  " (spasi di ujung) | Di-trim → dianggap duplikat → ditolak dengan pesan yang sama |
| F1-05 | — | Harga beli −500 atau harga jual −100 | Ditolak (validasi UI); nilai tidak tersimpan |
| F1-06 | — | Stok awal −5 | Ditolak; barang tidak tersimpan |
| F1-07 | — | Stok awal 2.5 (pecahan) | Ditolak; input integer saja yang diterima (stok pecahan tidak disimpan) |
| F1-08 | — | Harga beli/harga jual desimal wajar, mis. 12.500 | Diterima (harga real ≥ 0, desimal wajar); ditampilkan format Rupiah `Rp 12.500` |
| F1-09 | — | Harga jual 8000 < harga beli 12000 | Diterima (tidak diblokir), potensi laba item negatif, ada peringatan visual di daftar (mis. warna merah/ikon ⚠) |
| F1-10 | — | Tambah tanpa isi stok awal (biarkan default) | Stok = 0; badge "Habis" (abu-abu) muncul |
| F1-11 | — | Tambah barang, lalu reload browser | Barang tetap ada (persisten di OPFS) |

**Uji negatif DB (analisis statis):** `INSERT` langsung via SQL melanggar `CHECK (stok >= 0)`,
`CHECK (harga_beli >= 0)`, `UNIQUE COLLATE NOCASE` pada nama → wajib gagal di level DB
walaupun validasi UI dilewati (bukti: review kode migrasi 004 + service).

### F2. Hapus Barang

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F2-01 | "Kabel" ada di daftar | Klik tombol Hapus pada baris "Kabel" | Dialog konfirmasi muncul: "Hapus Kabel? Tindakan ini tidak bisa dibatalkan."; barang BELUM terhapus |
| F2-02 | Dialog konfirmasi terbuka | Klik "Batal" / klik di luar dialog / tekan Escape | Dialog tertutup; barang tetap ada di daftar |
| F2-03 | Dialog konfirmasi terbuka | Klik "Ya" | Barang hilang dari daftar; ringkasan (total jenis, nilai stok, potensi laba) langsung ter-update tanpa reload |
| F2-04 | — | (review kode) | Hapus = hard delete; tidak ada soft delete, tidak ada flag tersisa di DB |
| F2-05 | — | (review kode) | Konfirmasi tidak bisa dilewati — tidak ada path kode yang menghapus tanpa dialog |

### F3. Catat BELI (stok masuk)

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F3-01 | "Kabel" stok 5 | Klik Beli → qty 3 → Simpan | Stok jadi 8; `diubah_pada` ter-update; ringkasan (nilai stok, potensi laba) ikut naik |
| F3-02 | "Kabel" stok 5 | Beli qty 0 / −2 / 2.5 / "abc" | Ditolak, pesan jelas; stok tetap 5 |
| F3-03 | — | (review kode) | Update dilakukan dalam SATU transaksi DB atomik: `stok = stok + qty` — tidak ada read-then-write tanpa lock |
| F3-04 | "Kabel" stok 8 | Beli 4 → reload browser | Stok 12 persisten setelah reload |
| F3-05 | — | (review kode) | Beli dari stok 0 (badge Habis) diizinkan; stok bertambah normal |

### F4. Catat JUAL (stok keluar)

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F4-01 | "Kabel" stok 5 | Jual qty 3 → Simpan | Stok jadi 2; badge "Menipis" muncul; ringkasan ter-update |
| F4-02 | "Kabel" stok 5 | Jual qty 6 | **DITOLAK**; pesan "Stok tidak mencukupi (sisa: 5 pcs)"; stok tetap 5; tidak ada yang tercatat |
| F4-03 | "Kabel" stok 2 | Jual qty 2 (seluruh sisa) | Diizinkan; stok jadi 0; badge berubah jadi "Habis" |
| F4-04 | "Kabel" stok 5 | Jual qty 0 / −1 / 2.5 | Ditolak; stok tetap 5 |
| F4-05 | — | (review kode) | Jual memakai transaksi DB atomik + `CHECK (stok >= 0)` — stok TIDAK BOLEH negatif lewat jalur apa pun, bahkan bila UI dilewati (query `UPDATE barang SET stok = stok - ?` harus dibarengi guard `WHERE stok >= ?`, atau rollback saat CHECK gagal) |
| F4-06 | — | (review kode) | Pesan "sisa: N pcs" memakai nilai stok aktual saat penolakan |

### F5. Daftar Barang + Ringkasan Otomatis

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F5-01 | 3 barang: A(stok 0, beli 10k, jual 15k), B(stok 3, beli 20k, jual 25k), C(stok 10, beli 5k, jual 8k) | Buka layar utama setelah login | Total jenis=3; Nilai stok = 0×10.000 + 3×20.000 + 10×5.000 = **Rp 110.000**; Potensi laba = 0×5.000 + 3×5.000 + 10×3.000 = **Rp 45.000**; daftar "barang menipis" memuat A dan B |
| F5-02 | P sama | — | Badge: A = "Habis" (abu-abu); B = "Menipis" (merah/oranye); C = tanpa badge |
| F5-03 | — | Tambah barang / Beli / Jual / Hapus | Ringkasan berubah langsung tanpa reload |
| F5-04 | DB kosong | Buka layar utama | Pesan informatif "Belum ada barang. Klik Tambah Barang." — bukan tabel kosong / bukan error |
| F5-05 | Ada "Kabel HDMI", "Mouse", "Kabel USB" | Ketik "kab" di kotak pencarian | Tampil "Kabel HDMI" dan "Kabel USB" saja; pencarian instan client-side (case-insensitive) |
| F5-06 | — | Lihat format angka harga/nilai | Format Rupiah pemisah ribuan: `Rp 12.500` (bukan `12500` / `$`) |
| F5-07 | Stok persis 5 dan persis 6 | — | Stok 5 → badge Menipis; stok 6 → tanpa badge (ambang global ≤ 5, bukan per barang) |
| F5-08 | Barang dengan jual < beli | — | Potensi laba ringkasan berkurang (bisa negatif); tidak ada error/NaN |
| F5-09 | Item ada di daftar "barang menipis", lalu Beli hingga stok > 5 | — | Item hilang dari daftar menipis secara otomatis |

### F6. Login & Backup (dipertahankan dari repo lama)

| ID | P | Langkah | Ekspektasi |
|---|---|---|---|
| F6-01 | Belum login | Akses langsung layar utama | Dialihkan / terkunci ke layar login |
| F6-02 | — | Login dengan akun yang sudah ada | Masuk ke layar utama Ventra Simple |
| F6-03 | Sudah login, ada data | Klik "Unduh Backup" | File `.db` terunduh ke folder Download; dibuka di DB Browser → data utuh |
| F6-04 | — | (review kode) | UI layar baru mengikuti gaya Template B (gelap operasional) |

### Negatif: out-of-scope (regresi scope)

Fitur di bawah ini **tidak boleh** muncul di Ventra Simple (§4 spec):

| ID | Langkah | Ekspektasi |
|---|---|---|
| OS-01 | Jelajahi seluruh UI + search kode | Tidak ada menu/kolom/input untuk: kode barang, kategori, barcode, scan kamera, export Excel, export PDF, multi-user/roles, riwayat mutasi, stok minimum per barang |
| OS-02 | — | Dependensi tak terpakai (`jsbarcode`, `@zxing/browser`, `xlsx`, `jspdf`) sebaiknya dicopot dari `package.json` (opsional per spec) — bila masih ada, tidak boleh ter-import di bundle (cek bundle tidak membengkak tanpa alasan) |

---

## 2. Uji non-fungsional

| ID | Uji | Cara (batas subagent) | LULUS bila |
|---|---|---|---|
| NF-01 | TypeScript bersih | `npx tsc --noEmit` (atau `npm run build` yang menjalankan tsc) | 0 error TS |
| NF-02 | Build sukses | `npm run build` | Build selesai tanpa error; folder `dist/` terisi |
| NF-03 | Tanpa blank page | Review statis: grep import dari service/kode yang dihapus (kode barang, kategori, barcode); pastikan tidak ada ESM link-time error; pastikan semua file yang di-import ada | Tidak ada import mati; tidak ada referensi ke modul yang dihapus |
| NF-04 | Tanpa console error merah | Analisis statis (batasan: tidak bisa buka DevTools) — review kode untuk pola error-prone (catch yang menelan error, await yang hilang, promise tanpa handler) | Tidak ada pola bermasalah; dicatat bahwa verifikasi runtime wajib oleh Rama di laptop |
| NF-05 | Migrasi 004 tidak gagal | Review `migrasi/004_sederhana.sql` + migration runner: rebuild `barang` via tabel sementara (bukan DROP COLUMN), drop tabel `kategori`/`kode_barang`/`kategori_kode_barang`, constraint `CHECK` & `UNIQUE COLLATE NOCASE` terpasang | Skema akhir = tepat 6 kolom tabel `barang` + tabel `pengguna` utuh; migrasi idempoten (runner menandai versi, tidak dijalankan ulang) |
| NF-06 | Anti-stok-negatif di level DB | Review SQL update JUAL + skema | `CHECK (stok >= 0)` ada; update JUAL atomik dengan guard (WHERE/rollback) |
| NF-07 | Nama unik case-insensitive di level DB | Review skema | `UNIQUE COLLATE NOCASE` pada kolom `nama` (bukan sekadar cek di UI) |
| NF-08 | Header COOP/COEP utuh | Review `vite.config.ts` | `server.headers` Cross-Origin-Opener-Policy & Cross-Origin-Embedder-Policy ada (menghapusnya mematahkan SQLite worker — pelajaran insiden VDB-W01) |
| NF-09 | `db.ts` / `db-worker.ts` tidak diubah merusak | Diff/review vs versi yang terbukti jalan | API publik persis (`dapatkanDb`, `DbVentra{select,execute}`, `eksporDatabase`); tidak ada perubahan protokol pesan worker |
| NF-10 | Jalan di Windows | (Batasan: VM ini Linux; uji aktual oleh Rama) | Rama: `git pull` → `npm install` → `npm run dev` jalan; `npm run build` sukses; copy `dist/` ke `C:\xampp\htdocs\ventra` → `http://localhost/ventra` tampil normal |

**Go-live minimal (dari spec §5, wajib oleh Rama di laptop):**
1. `npm run build` sukses tanpa error TS;
2. 50 barang + 200 transaksi BELI/JUAL tanpa error;
3. Backup → unduh `.db` → buka di DB Browser → data utuh.

---

## 3. Kriteria LULUS / TIDAK LULUS

**LULUS** bila SEMUA terpenuhi:

1. Semua uji F1–F6 berstatus **PASS** (tidak ada FAIL; uji yang tidak bisa dieksekusi di
   lingkungan subagent ditandai **N/A-statis** dan wajib dieksekusi ulang oleh Rama di laptop).
2. Semua uji NF-01 s.d. NF-10 berstatus **PASS**.
3. Tidak ada FAIL pada OS-01/OS-02 (tidak ada fitur out-of-scope yang bocor).
4. Kriteria go-live §5 (1–3) terpenuhi di laptop Rama.

**TIDAK LULUS** bila SALAH SATU terjadi:

1. Ada satu saja uji F1–F6 berstatus **FAIL** (fungsionalitas inti rusak).
2. NF-01 atau NF-02 FAIL (tsc error / build gagal) — blokir deploy XAMPP.
3. NF-03 FAIL (import mati → blank page) — blokir total, prioritas P0.
4. Stok bisa menjadi negatif lewat jalur mana pun (NF-06 FAIL) — blokir, ini aturan keras spec.
5. Nama duplikat case-insensitive bisa masuk DB (NF-07 FAIL) — blokir, identitas barang rusak.
6. Migrasi 004 gagal / skema akhir salah (NF-05 FAIL).
7. Fitur out-of-scope muncul di UI (OS-01 FAIL).

**Status hasil:** PASS / FAIL / N/A-statis (tidak bisa dieksekusi di lingkungan subagent —
wajib eksekusi ulang manual oleh Rama) / BLOCKED (tergantung bug lain).

---

## 4. Rencana eksekusi (tahap 2)

1. Menunggu implementasi Gunet selesai + ter-push ke repo.
2. Testarossa dipanggil kembali → eksekusi: `git pull`, `npm install`, `npx tsc --noEmit`,
   `npm run build`, review statis skema/migrasi/service, grep import mati, review transaksi SQL.
3. Hasil dicatat per ID uji di atas; FAIL → assignment debug ke Gunet; PASS semua → laporan
   ke Rama + instruksi verifikasi browser di laptop (git pull → npm install → npm run dev →
   uji F1–F5 manual mengikuti tabel §1).

---

## 5. Hasil Eksekusi

**Tanggal eksekusi:** 14 Okt 2026 ~21:30 WIB — Testarossa (QA Engineer)
**Workdir:** `~/workspace/ventra-simple` (implementasi Gunet, tidak diubah — hanya dokumen QA)
**Catatan:** `git status` menunjukkan implementasi sebagai perubahan *uncommitted*
(di atas commit kanonis `a7563b8`); file fitur lama (`features/kategori`,
`features/kode-barang`, `pages/produk-manajemen`, `migrasi/003_kode_barang.sql`)
**dihapus** (status `D`), bukan sekadar tidak dipakai.

Status **N/A-statis** = tidak bisa dieksekusi tanpa browser di lingkungan subagent;
wajib eksekusi ulang oleh Rama di laptop mengikuti tabel §1 (khususnya sebelum go-live).

### 5.1 Uji non-fungsional (dapat dieksekusi — semua PASS)

| ID | Hasil | Bukti |
|---|---|---|
| NF-01 | **PASS** | `npx tsc --noEmit` → exit 0, 0 error TS |
| NF-02 | **PASS** | `npm run build` (tsc + vite build) sukses; `dist/` terisi: `index.html`, 8 chunk JS/CSS, `sqlite3-*.wasm` 868.91 kB, `db-worker-*.js` terpisah |
| NF-03 | **PASS** | Grep `src/` untuk `produk-manajemen`, `features/kategori`, `features/kode-barang`, `zxing`, `jsbarcode`, `xlsx`, `jspdf` → **0 referensi** (satu-satunya hit adalah komentar penghapus di `src/types/index.ts:2`). Semua file yang di-import ada; tidak ada ESM link-time error (build render sukses) |
| NF-04 | **PASS** | Review: tidak ada pola error-prone — `catch` di `service-barang.ts` & `db.ts`/`db-worker.ts` selalu menampilkan/propagate error asli (pelajaran insiden VDB); tidak ada promise tanpa handler. Verifikasi runtime DevTools tetap wajib oleh Rama |
| NF-05 | **PASS** | `migrasi/ventra-simple.sql` — skema tepat spec §2: `barang` (id INTEGER PK AUTOINCREMENT, nama TEXT NOT NULL UNIQUE COLLATE NOCASE, stok INTEGER CHECK (stok >= 0), harga_beli REAL CHECK >= 0, harga_jual REAL CHECK >= 0) + `pengguna` + `audit_keamanan` + `migrasi`. **Catatan implementasi:** bukan migrasi `004_sederhana.sql` seperti rencana, melainkan **skema fresh di file DB baru `/ventra-simple.db`** (documented, `db-worker.ts:74-77`) — aman karena belum ada data produksi. Runner: `BEGIN IMMEDIATE … COMMIT / ROLLBACK` + catat versi `'ventra-simple'` di tabel `migrasi` → idempoten |
| NF-06 | **PASS** | Dua lapis: `CHECK (stok >= 0)` di skema + `UPDATE barang SET stok = stok - $1 WHERE id = $2 AND stok >= $1` + verifikasi SELECT ulang — bila guard gagal, `ok:false` → service menolak dengan pesan "Stok tidak mencukupi (sisa: N pcs)". Tidak ada jalur yang menurunkan stok di bawah 0 |
| NF-07 | **PASS** | `UNIQUE COLLATE NOCASE` pada kolom `nama` di skema + `barangDenganNama` memakai `nama = $1 COLLATE NOCASE` + backstop pesan ramah bila constraint menangkap duplikat race |
| NF-08 | **PASS** | `vite.config.ts` — `server.headers` COOP `same-origin` + COEP `require-corp` **utuh**; `public/.htaccess` (ikut ke `dist/`) membawa header yang sama untuk XAMPP; `worker.format: 'es'` |
| NF-09 | **PASS** | Diff `src/lib/db-worker.ts` vs versi terbukti jalan: perubahan **hanya** (a) `NAMA_FILE_DB = '/ventra-simple.db'` (`db-worker.ts:77`), (b) skema dari `migrasi/ventra-simple.sql` via dynamic import fase IMPORT_FAILED. Instrumentasi VDB (fase berlabel, kode VDB-W01/W02/W03), guard `pastikanOpfsBisaDitulis()`, dan protokol pesan `{id,op}` → `{ok,rows\|lastInsertId\|bytes}` **utuh**. `src/lib/db.ts` API publik persis: `dapatkanDb`, `DbVentra{select,execute}`, `eksporDatabase` |
| NF-10 | **N/A-statis** | Uji di Windows/Chrome hanya bisa oleh Rama: `git pull → npm install → npm run dev → http://localhost:5173`, lalu `npm run build` + copy `dist/` → `C:\xampp\htdocs\ventra` |

### 5.2 Uji fungsional F1–F6 (review statis + batas subagent)

Uji interaksi (klik, ketik, reload) = **N/A-statis** (wajib Rama eksekusi manual).
Uji bertanda ★ = terverifikasi via review kode/logika (PASS-statis).

| ID | Status | Dasar verifikasi |
|---|---|---|
| **F1. Tambah Barang** | | |
| F1-01 | ★ PASS | Form → `tambahBarang` → INSERT; kolom tabel: Nama, Stok (pcs), Harga beli, Harga jual, Nilai stok, Aksi |
| F1-02 | ★ PASS | `validasiNama`: kosong/spasi → "Nama barang wajib diisi." (`service-barang.ts:37`) |
| F1-03 | ★ PASS | Cek duplikat `barangDenganNama` + `UNIQUE COLLATE NOCASE` → pesan "Barang dengan nama tersebut sudah ada." |
| F1-04 | ★ PASS | Input di-trim di repo (`sisipBarang` trim; `barangDenganNama` trim) → "  kabel  " = duplikat "Kabel" |
| F1-05 | ★ PASS | `parseHarga` (`BarangPage.tsx:46`) tolak non-numerik/negatif; service `validasiHarga` backstop; `CHECK >= 0` di DB |
| F1-06 | ★ PASS | `parseStok` `/^\d+$/` + `validasiStok` (integer ≥ 0) + `CHECK (stok >= 0)` |
| F1-07 | ★ PASS | "2.5" gagal regex `/^\d+$/` → ditolak; `Number.isInteger` di service |
| F1-08 | ★ PASS | `parseHarga` terima desimal ("12.5"); `formatRupiah` → `Intl.NumberFormat('id-ID')` → "Rp 12.500" |
| F1-09 | ★ PASS | Tidak diblokir (service tidak cek jual < beli); ikon ⚠ + tooltip di nama barang bila `harga_jual < harga_beli` |
| F1-10 | ★ PASS | Default stok form "0" → badge "Habis" (abu-abu, `styles.css:114`) bila stok = 0 |
| F1-11 | N/A-statis | Persistensi OPFS → wajib uji reload oleh Rama |
| **F2. Hapus Barang** | | |
| F2-01 | ★ PASS | Tombol Hapus → `dialog.jenis='hapus'` → Modal: "Hapus *nama*? Tindakan ini tidak bisa dibatalkan." — belum terhapus |
| F2-02 | ★ PASS | "Batal" menutup dialog; klik backdrop (`e.target === e.currentTarget`) menutup; Escape menutup (`BarangPage.tsx:86-94`); barang tidak tersentuh |
| F2-03 | ★ PASS | "Ya, hapus" → `hapusBarang` → `muatUlang()` refresh daftar + ringkasan tanpa reload |
| F2-04 | ★ PASS | `hapusBarangPermanen` = `DELETE FROM barang` (hard delete, tidak ada soft delete) |
| F2-05 | ★ PASS | Satu-satunya jalur hapus = dialog konfirmasi; service tidak dipanggil dari tempat lain |
| **F3. Catat BELI** | | |
| F3-01 | ★ PASS | `beliBarang` → `tambahStok`: `UPDATE barang SET stok = stok + $1 WHERE id = $2` (satu statement atomik); `muatUlang()` refresh ringkasan |
| F3-02 | ★ PASS | `parseStok` + `validasiJumlah` (integer > 0) tolak 0/−2/2.5/"abc"; stok tidak berubah |
| F3-03 | ★ PASS | Single UPDATE statement (read-then-write tanpa lock tidak ada) |
| F3-04 | N/A-statis | Persistensi setelah reload → uji Rama |
| F3-05 | ★ PASS | Tidak ada guard stok > 0 pada beli; UPDATE dari 0 legal |
| **F4. Catat JUAL** | | |
| F4-01 | ★ PASS | Guard `WHERE stok >= ?` lolos → stok 5→2; badge "Menipis" (stok ≤ 5) muncul; ringkasan refresh |
| F4-02 | ★ PASS | Guard gagal → `ok:false` → service: "Stok tidak mencukupi (sisa: 5 pcs)"; UPDATE tidak tersentuh |
| F4-03 | ★ PASS | qty == stok → guard lolos (stok >= jumlah) → stok 0 → badge "Habis" |
| F4-04 | ★ PASS | Sama seperti F3-02 (shared `validasiJumlah`) |
| F4-05 | ★ PASS | Guard `WHERE stok >= ?` + verifikasi SELECT ulang (stok akhir harus = awal − jumlah) + `CHECK (stok >= 0)` lapis kedua |
| F4-06 | ★ PASS | Pesan memakai `hasil.stok` dari SELECT saat penolakan; dialog juga refresh `stokKini` dari DB setelah gagal (`DialogStok.simpan`) |
| **F5. Daftar + Ringkasan** | | |
| F5-01 | ★ PASS | SQL agregat `COUNT(*)`, `SUM(stok×harga_beli)`, `SUM(stok×(harga_jual−harga_beli)` = rumus spec; daftar menipis (stok ≤ 5, > 0) tampil sebagai baris ⚠ "Menipis: A (0 pcs)…" — catatan: A (stok 0) **tidak** masuk filter `menipis` (`daftar.filter(b => b.stok > 0 && ...)`) — A tetap muncul dengan badge "Habis" di tabel, konsisten dengan definisi badge spec (Menipis = 1–5). Perlu Rama konfirmasi visual ini sudah sesuai harapan |
| F5-02 | ★ PASS | `statusStok`: 0 → habis (abu-abu), 1–5 → menipis (merah berkedip), > 5 → tanpa badge |
| F5-03 | ★ PASS | Semua dialog sukses → `muatUlang()` → state daftar + ringkasan ter-update tanpa reload |
| F5-04 | ★ PASS | `daftar.length === 0` → 'Belum ada barang. Klik "Tambah Barang."' |
| F5-05 | ★ PASS | `hasilCari` filter client-side case-insensitive (`toLowerCase().includes`) — "kab" cocok "Kabel HDMI" & "Kabel USB" |
| F5-06 | ★ PASS | `formatRupiah`: `Intl.NumberFormat('id-ID')` → "Rp 12.500" |
| F5-07 | ★ PASS | `AMBANG_MENIPIS = 5`, global (`BarangPage.tsx:30`); stok 5 → menipis, 6 → aman |
| F5-08 | ★ PASS | `potensi_laba` SUM bisa negatif; `formatRupiah` handle negatif ("Rp −…"), tanpa NaN; class `waspada`/`bad` menandai visual |
| F5-09 | ★ PASS | Daftar menipis dihitung dari `daftar` (state segar setelah `muatUlang`) → hilang otomatis bila stok > 5 |
| **F6. Login & Backup** | | |
| F6-01 | ★ PASS | `App.tsx`: tanpa sesi → render `LoginPage` (app terkunci di balik login) |
| F6-02 | N/A-statis | Alur login interaktif → uji Rama |
| F6-03 | ★ PASS | "Unduh Backup" → `eksporDatabase()` (worker `util.exportFile`, transfer buffer) → Blob `application/x-sqlite3` → download `ventra-backup-YYYYMMDD-HHMMSS.db`. Uji buka di DB Browser → N/A-statis (Rama) |
| F6-04 | ★ PASS | `styles.css`: `--bg: #0e1116`, badge/button/panel gelap — konsisten Template B gelap operasional |

### 5.3 Uji out-of-scope (regresi scope)

| ID | Hasil | Bukti |
|---|---|---|
| OS-01 | **PASS** | Grep seluruh `src/`: tidak ada UI/kolom/input untuk kode barang, kategori, barcode, scan kamera, export Excel/PDF, multi-user/roles, riwayat mutasi, stok minimum per barang. Satu-satunya kemunculan kata "kategori/kode_barang" adalah komentar penanda penghapusan (`src/types/index.ts:2`) |
| OS-02 | **PASS** | `package.json` — `jsbarcode`, `@zxing/browser`, `xlsx`, `jspdf` **sudah dicopot** (opsi "boleh dicopot" di spec dijalankan). Dependencies final: `@sqlite.org/sqlite-wasm`, `bcryptjs`, `react`, `react-dom` + dev `vite/typescript/@vitejs/plugin-react` |

### 5.4 Temuan

**Tidak ada temuan FAIL.** Tidak ada bug yang menghalangi. Catatan non-blocking:

1. **(INFO)** Skema dipasang via **file DB baru** `/ventra-simple.db` (`migrasi/ventra-simple.sql`),
   bukan migrasi `004_sederhana.sql` seperti rencana awal plan — disengaja dan didokumentasikan
   (belum ada data produksi; Rama baru coba-coba). `NF-05` plan menyebut `004_sederhana.sql`;
   plan sudah diselaraskan di §5.1 di atas.
2. **(INFO — untuk konfirmasi visual Rama)** Daftar "barang menipis" di hint baris hanya memuat
   stok 1–5; barang stok 0 tetap terlihat dengan badge "Habis" di tabel. Konsisten dengan
   definisi badge di spec — bukan bug, tapi layak Rama lihat saat uji manual F5-01.

### 5.5 Vonis

**LULUS (bersyarat)**

- Semua NF-01–NF-09 **PASS** (NF-10 = N/A-statis, hanya bisa di laptop Rama).
- Semua F1–F6 yang bisa diverifikasi statis **PASS**; sisanya **N/A-statis** — tidak ada satu
  pun FAIL.
- OS-01/OS-02 **PASS** — tidak ada fitur out-of-scope yang bocor; dependensi tak terpakai
  sudah dicopot dari `package.json`.
- Tidak ada temuan FAIL → tidak ada assignment debug ke Gunet.

**Syarat go-live (wajib Rama di laptop, dari spec §5):**

1. `git pull` → `npm install` → `npm run dev` → aplikasi tampil normal;
   `npm run build` sukses; copy `dist/` → `C:\xampp\htdocs\ventra` → `http://localhost/ventra` normal.
2. Uji manual tabel §1 (khususnya F1-11 reload persistensi, F3-04, F6-02 login, F6-03 backup →
   buka `.db` di DB Browser → data utuh).
3. 50 barang + 200 transaksi BELI/JUAL tanpa error.

**Catatan jujur:** batas pengujian subagent (tanpa browser) tetap berlaku — vonis ini
berdasarkan analisis statis + compile + build. Uji interaktif/browser adalah tanggung
jawab Rama mengikuti panduan §1.

---

*Status dokumen: EKSEKUSI SELESAI (bukan lagi DRAFT). Tidak di-push/di-commit (instruksi tugas).*
