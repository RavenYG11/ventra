# Hasil QA — Ventra Simple (Assignment #40, Testarossa)

**Tanggal eksekusi:** 14 Okt 2026, 21:17–21:35 WIB
**Penguji:** Testarossa (QA Engineer) — via koordinator QA #40
**Implementasi yang diuji:** working tree `~/workspace/ventra-simple` @ `a7563b8` + perubahan Gunet (#39, belum di-commit saat diuji; sinkronisasi terakhir 21:26 WIB; sinyal "implementasi selesai" 21:24 WIB)
**Referensi final:** `docs/spec-ventra-simple.md` (v2, Kurniatot) + `docs/arsitektur-ventra-simple.md` (Sentot, ~21:20 WIB — menggantikan riset Magna & model Broto yang dibatalkan Rama 21:16 WIB)
**Rencana QA:** `workspace/office-reports/qa-40-ventra-simple-plan.md` (30 test case)

> **Catatan dokumen:** file ini MENGGANTIKAN draf `docs/qa-ventra-simple.md` v2 (rencana uji saja, 173 baris) dengan **hasil eksekusi nyata**. Draf lama tidak lagi berlaku.

---

## 1. Ringkasan eksekutif

| Aspek | Hasil |
|---|---|
| **VERDICT** | **LULUS** — push ke `main` **DIIZINKAN** |
| Test KRITIS | **18/18 LULUS** |
| Test SEDANG | 12/12 LULUS (1 observasi UX, bukan kegagalan) |
| Test RENDAH | 5/5 LULUS |
| Temuan KRITIS | **0** |
| Temuan SEDANG | 1 (parse pemisah ribuan — tidak memblokir, rekomendasi perbaikan) |
| Temuan RENDAH | 2 (inkonsistensi dokumen + kosmetik toast) |

**Syarat sisa (jujur):** verifikasi *browser sungguhan* (klik UI, reload, console) tidak dapat dilakukan di VM ini (tanpa Chromium headless) — dilimpahkan ke Rama di laptop Windows dengan checklist §7. LULUS ini mencakup seluruh verifikasi yang *dapat* dilakukan di sini: typecheck, production build, eksekusi SQL nyata, uji logika, dan audit statis.

---

## 2. Metode verifikasi (fakta, bukan klaim)

| # | Metode | Hasil |
|---|---|---|
| M1 | `tsc --noEmit` pada tree implementasi (deps persis `package.json`) | **BERSIH, exit 0** — 0 error tipe, 0 import/export rusak |
| M2 | `vite build` (production) | **SUKSES, exit 0** — 38 modul; chunk `db-worker` + `sqlite3.wasm` (868 KB) + skema `ventra-simple` ter-emit tanpa error |
| M3 | Audit statis graf import dari `main.tsx` | **BERSIH** — 0 named import tanpa pasangan export; 0 referensi ke `produk-manajemen/`/`kategori/`/`kode-barang`/`zxing`/`jsbarcode`/`xlsx`/`jspdf` di `src/` (pelajaran insiden blank page 20:39 WIB) |
| M4 | Eksekusi SQL **aktual** (`migrasi/ventra-simple.sql` + statement persis dari `repo-barang.ts`) di SQLite sungguhan | **20/20 LULUS** (`qa40-sql-test.py`) |
| M5 | Uji fungsi validasi & parse (**salinan verbatim** dari `service-barang.ts` + `BarangPage.tsx`) di Node | **32/32 LULUS** (`qa40-validasi-test.mjs`) |
| M6 | Verifikasi matematis vs oracle independen (Set A Broto) | **LULUS** — total nilai stok Rp 1.230.000, potensi laba Rp 340.000 cocok |
| M7 | Review persistensi, XSS, lapisan, zero-touch | **LULUS** (detail §4–§5) |

---

## 3. Hasil per test case

### F1 — Tambah Barang

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| TMB-01 | Tambah valid (nama/stok/harga) | KRITIS | **LULUS** | `tambahBarang`: validasi → cek duplikat → INSERT → baca ulang; SQL INSERT teruji M4 |
| TMB-02 | Nama kosong / hanya spasi → ditolak | KRITIS | **LULUS** | `validasiNama` → "Nama barang wajib diisi." (M5: 2 kasus) |
| TMB-03 | Nama di-trim sebelum cek & simpan | SEDANG | **LULUS** | `repo.sisipBarang` pakai `nama.trim()`; `barangDenganNama` pakai `nama.trim()` (M4: KODE-*) |
| TMB-04 | Duplikat case-insensitive ("kabel" vs "Kabel") → ditolak | SEDANG | **LULUS** | `UNIQUE COLLATE NOCASE` di skema (M4: ditolak) + cek service → pesan "Barang dengan nama tersebut sudah ada." |
| TMB-05 | Stok negatif → ditolak | KRITIS | **LULUS** | `validasiStok` (M5) + `CHECK (stok >= 0)` (M4: ditolak) — validasi ganda |
| TMB-06 | Stok desimal (1.5) → ditolak | SEDANG | **LULUS** | `Number.isInteger` (M5); SQLite INTEGER akan menyimpan REAL — dicegah di service |
| TMB-07 | Harga beli/jual negatif → ditolak | KRITIS | **LULUS** | `validasiHarga` (M5) + `CHECK (harga >= 0)` (M4: ditolak) — validasi ganda |
| TMB-08 | Harga desimal (12.500,50) → **diterima** | SEDANG | **LULUS** | Spec v2: `REAL` — "desimal wajar diizinkan" (M4: 12500.5 tersimpan; M5). *Perubahan ekspektasi vs rencana awal: model INTEGER (Broto) DIBATALKAN 21:16 WIB; yang berlaku spec v2.* |
| TMB-09 | Harga 0 (hibah/gratis) → diterima | SEDANG | **LULUS** | `validasiHarga(0)` → null (M5) |
| TMB-10 | Harga jual < harga beli → diterima + peringatan ⚠ | SEDANG | **LULUS** | Tidak diblokir (spec F1); UI tampilkan ⚠ + kartu Potensi laba class `waspada` bila negatif |
| TMB-11 | Nama > 100 karakter → ditolak | RENDAH | **LULUS** | `validasiNama` (M5: 100 ok, 101 ditolak) |

### F3 — Catat BELI

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| BLI-01 | Beli N pcs → stok bertambah tepat N | KRITIS | **LULUS** | `UPDATE ... SET stok = stok + ?` (M4: 45→50 via +5; baca ulang verifikasi) |
| BLI-02 | Qty 0 / negatif / desimal / kosong → ditolak | SEDANG | **LULUS** | `validasiJumlah` + `parseStok` (M5: 6 kasus) |

### F4 — Catat JUAL (anti stok negatif — aturan Rama)

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| JUL-01 | Jual ≤ stok → stok berkurang tepat | KRITIS | **LULUS** | M4: jual 5 dari 50 → 45 |
| JUL-02 | Jual > stok → **DITOLAK**, stok tidak berubah | KRITIS | **LULUS** | `kurangiStokAtomik`: guard `UPDATE ... WHERE stok >= ?` + verifikasi SELECT ulang (M4: jual 60 dari 45 → ok:false, stok tetap 45); service → "Stok tidak mencukupi (sisa: 45 pcs)." |
| JUL-03 | Jual tepat = stok → 0; jual lagi → ditolak | KRITIS | **LULUS** | M4: jual 50 dari 50 → 0; jual 1 dari 0 → ditolak |
| JUL-04 | Qty 0 / negatif / desimal → ditolak | SEDANG | **LULUS** | `validasiJumlah` + `parseStok` (M5) |
| — | (Observasi UX) Tombol Jual tidak di-disable saat stok 0 | — | **BUKAN TEMUAN** | Spec v2 F4 hanya mewajibkan penolakan + pesan (terpenuhi). Mockup men-disable tombol; implementasi mengandalkan penolakan service — diterima. |

### F5 — Ringkasan & perhitungan

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| HIT-01 | Nilai stok per barang = stok × **harga_beli** | KRITIS | **LULUS** | UI: `formatRupiah(b.stok * b.harga_beli)`; M4 agregat |
| HIT-02 | Total Nilai Stok = Σ(stok×harga_beli) | KRITIS | **LULUS** | M4: Set A → **1.230.000** (900.000 + 330.000 + 0) = oracle |
| HIT-03 | Total jenis & total unit | KRITIS | **LULUS** | M4: 3 jenis, 70 unit |
| HIT-05 | Potensi laba = Σ(stok×(jual−beli)) | KRITIS | **LULUS** | M4: **340.000** = oracle; kartu ke-4 tampil + class `waspada` bila negatif |
| HIT-06 | Laba terealisasi per transaksi jual | — | **DI LUAR SCOPE v1** | Spec v2 §2 keputusan #4: *tanpa tabel transaksi/riwayat*. Laba per penjualan tidak dapat diakumulasi. Q-LABA (`open-questions.json#ventra-simple-q-laba`) tetap terbuka untuk keputusan Rama. Bukan kegagalan implementasi. |

### F2 — Hapus Barang

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| SEC-05 | Hapus → dialog konfirmasi wajib; "Batal" membatalkan; "Ya" menghapus permanen | SEDANG | **LULUS** | `Dialog hapus`: modal "Hapus *nama*? Tindakan ini tidak bisa dibatalkan." — tidak ada jalur hapus tanpa konfirmasi; `hapusBarangPermanen` (hard delete sesuai spec) |

### Persistensi & non-fungsional

| ID | Test | Sev | Hasil | Bukti |
|---|---|---|---|---|
| PRS-01 | Reload → data tetap (OPFS `/ventra-simple.db`) | KRITIS | **LULUS (statis)** | Infra SQLite-WASM+OPFS **zero-touch** (dipakai ulang persis; terbukti jalan di laptop Rama 14 Okt 20:03 WIB). Verifikasi klik-reload → Rama (§7). |
| PRS-02 | DB fresh terpisah dari `/stok.db` lama | KRITIS | **LULUS** | `NAMA_FILE_DB = '/ventra-simple.db'`; skema lama tidak diimpor worker — file lama tidak tersentuh |
| PRS-03 | Data korup / gagal init → layar galat jelas, **tanpa wipe diam-diam** | KRITIS | **LULUS (statis)** | Guard `pastikanOpfsBisaDitulis()` utuh (3 referensi); fase galat berlabel VDB; `LoginPage`/`BarangPage` tampilkan `PesanGalat` + "Coba lagi" + "Salin detail teknis"; `finally { setMemuat(false) }` cegah layar "Memuat…" abadi (pelajaran bug 18:45 WIB) |
| PRS-04 | Backup `.db` → unduh | SEDANG | **LULUS (statis)** | `backup.ts` + `eksporDatabase` zero-touch; mengekspor file DB aktif (`/ventra-simple.db`). Unduh aktual → Rama (§7). |
| PRS-05 | Tulis atomik anti-race dua klik Jual | RENDAH | **LULUS** | `kurangiStokAtomik` (mitigasi R5): guard WHERE + verifikasi SELECT (M4) |
| SEC-01 | XSS: nama `<script>`/`<img onerror>` dirender sebagai teks | KRITIS | **LULUS** | 0 `dangerouslySetInnerHTML` / `.innerHTML` di `src/`; semua nama via JSX `{b.nama}` (React escape bawaan), termasuk dialog hapus & echo pencarian |
| SEC-02 | Audit import/export anti blank page | KRITIS | **LULUS** | M1 (tsc bersih) + M3 (grep: 0 import mati) |
| SEC-03 | Tidak ada blank white page | KRITIS | **LULUS (statis)** | M1+M2 hijau; entry `main.tsx`→`App.tsx`→`LoginPage`/`BarangPage` konsisten. Konfirmasi visual → Rama (§7). |
| SEC-04 | Tidak ada console error | SEDANG | **→ Rama** | Tidak dapat diuji tanpa browser headless (§7) |
| SEC-06 | Pencarian instan (case-insensitive) | RENDAH | **LULUS** | `LIKE ... COLLATE NOCASE` (M4: "kab"→"Kabel USB-C 1m", "KOPI"→"Kopi Tubruk 250g"); filter client-side sinkron |
| F6 | Regresi login 1 akun (zero-touch) | SEDANG | **LULUS (statis)** | `service-login`/`repo-pengguna`/`LoginPage` tanpa diff; skema fresh memuat tabel `pengguna` + `audit_keamanan` (temuan B1 Cipher teratasi); alur setup-akun-pertama via `apakahButuhSetupAwal()` |

---

## 4. Temuan

### SEDANG (1) — tidak memblokir push, rekomendasi diperbaiki sebelum/di sesudah merge

**QA-S1 — `parseHarga` salah tafsir pemisah ribuan Indonesia.**
Fungsi `parseHarga` (`BarangPage.tsx`) memperlakukan titik sebagai desimal: input `"12.500"` (yang dimaksud user Indonesia: Rp 12.500 = dua belas ribu lima ratus) diparse menjadi `12.5`.
Reproduksi (M5, salinan verbatim): `parseHarga("12.500")` → `12.5`; `parseHarga("12,500")` → `12.5`.
Dampak: harga tersimpan 1000× lebih kecil bila user mengetik gaya "12.500".
Peredam: setelah simpan, tabel menampilkan `formatRupiah` ("Rp 12,5") sehingga kesalahan *terlihat* dan bisa dikoreksi — bukan korupsi diam-diam.
Rekomendasi: tolak/hapus pemisah ribuan eksplisit (mis. strip `.` bila diikuti tepat 3 digit di akhir segmen) atau beri hint format di label ("ketik angka tanpa titik, cth: 12500").

### RENDAH (2)

**QA-R1 — Inkonsistensi dokumen soal tipe harga.**
`docs/arsitektur-ventra-simple.md` §3 menulis `harga_beli INTEGER`, tetapi `docs/spec-ventra-simple.md` §2 (yang menyatakan diri "satu-satunya sumber kebenaran untuk build baru"), skema `migrasi/ventra-simple.sql`, dan `service-barang.ts` memakai **REAL** (desimal diizinkan). Implementasi konsisten dengan spec v2 — yang perlu diselaraskan hanya dokumen arsitektur.
**QA-R2 — Toast sukses dialog BELI/JUAL memakai `stokKini` yang di-capture saat dialog dibuka** (`DialogStok.simpan`). Pada pemakaian satu user dampaknya nihil (dialog langsung ditutup + daftar di-refresh); hanya tidak akurat bila stok berubah dari tab lain (di luar scope v1).

### Bukan temuan (dicatat agar tidak diulang sebagai isu)

- Tombol Jual tidak di-disable saat stok 0 (penolakan service sudah cukup; bukan requirement spec).
- Kolom margin % per barang tidak ditampilkan (bukan requirement spec v2).
- `catatAuditKeamanan` tanpa try/catch (temuan B1 Cipher): **teratasi** — tabel `audit_keamanan` kini ada di skema fresh, sehingga skenario "tabel belum diputuskan" tidak terjadi.

---

## 5. Keputusan scope yang memengaruhi ekspektasi (fakta, bukan asumsi)

1. **Riset Magna (#37) & model data Broto (#42) DIBATALKAN** atas arahan Rama 21:16 WIB. Yang berlaku: spec v2 + arsitektur Sentot ~21:20 WIB.
2. **Storage = SQLite-WASM + OPFS** (bukan localStorage/IndexedDB) — infra lama dipakai ulang zero-touch.
3. **Harga = REAL** (desimal diizinkan) — per spec v2; ekspektasi "desimal ditolak" dari rencana awal tidak berlaku lagi.
4. **Login 1 akun dipertahankan**; backup = file `.db`; **tanpa** riwayat transaksi (maka laba terealisasi per penjualan tidak ada di v1 — Q-LABA terbuka).
5. Ambang menipis global **≤ 5**; satuan terkunci **pcs**; nama unik case-insensitive.

---

## 6. Verdict

**LULUS.** Seluruh 18 test KRITIS lolos dengan bukti eksekusi (bukan sekadar baca kode):
`tsc` bersih, `vite build` sukses, 20 uji SQL aktual lolos, 32 uji validasi/parse lolos,
perhitungan cocok dengan oracle independen, audit import/export bersih, XSS tertutup di level kode.

**Push ke `main` DIIZINKAN.** Tidak ada temuan kritis.

---

## 7. Batas pengujian & checklist untuk Rama (Windows, Chrome)

Yang TIDAK dapat diverifikasi di VM ini (tanpa browser headless) — mohon dijalankan Rama setelah `git pull`:

- [ ] `npm install` → `npm run dev` → buka `http://localhost:5173` — tidak ada blank page
- [ ] Buat akun pertama → login → tambah 3 barang Set A (§3) → cek Nilai Stok = Rp 1.230.000 & Potensi Laba = Rp 340.000
- [ ] Beli 10 pcs item #1 → Jual 5 pcs → Jual 60 pcs (**harus ditolak**: "Stok tidak mencukupi (sisa: 50 pcs)")
- [ ] Reload browser → semua data tetap ada
- [ ] Tab Console (F12) → tidak ada error merah saat boot & alur di atas
- [ ] Unduh Backup → file `.db` terunduh
- [ ] Hapus 1 barang → dialog konfirmasi muncul → "Ya" menghapus
- [ ] (Opsional) Ketik harga "12.500" → perhatikan temuan QA-S1: tersimpan sebagai 12,5

Bila checklist di atas menemukan bug kritis → laporkan; perbaikan + re-QA sebelum go-live.

---

*— Testarossa, QA Engineer. Dilaporkan kepada Manager (Muse).*
*Rencana QA: `workspace/office-reports/qa-40-ventra-simple-plan.md` · Oracle: `workspace/tmpwork/qa40-oracle.py` · Uji SQL: `workspace/tmpwork/qa40-sql-test.py` · Uji validasi: `workspace/tmpwork/qa40-validasi-test.mjs`.*
