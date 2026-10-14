# Spec Ventra Simple (v2)

**Web app stock barang super-sederhana — offline, lokal, 1 tabel barang.**
Disusun: 14 Okt 2026 oleh Kurniatot (Software & Project Analyst, Virtual Office).
Status: DRAFT — siap diserahkan ke implementasi.

> Versi ini MENGGANTIKAN scope kompleks sebelumnya (spec `stock-barang-mvp-v1.md`:
> kode barang, kategori, barcode/scan, laporan Excel/PDF, stok minimum per barang
> — SEMUANYA dibuang). Satu-satunya sumber kebenaran untuk build baru adalah
> dokumen ini.

---

## 1. Ringkasan

Aplikasi web offline untuk mencatat stok barang milik Rama (PC Windows,
`http://localhost/ventra` via XAMPP). Tanpa backend, tanpa internet, database
SQLite-WASM persisten di OPFS browser.

**Infrastruktur yang WAJIB dipakai ulang tanpa diubah** (sudah terbukti jalan):
- `src/lib/db.ts` — proxy main-thread (API: `dapatkanDb`, `DbVentra{select,execute}`, `eksporDatabase`)
- `src/lib/db-worker.ts` — engine SQLite di Web Worker
- `vite.config.ts` — header COOP/COEP (wajib; menghapusnya mematahkan SQLite)
- `package.json` — react+vite+TS+sqlite-wasm
- Template UI: **B (gelap operasional)** — gaya warna & komponen mengikuti Template B
- Login 1 akun + tombol "Unduh Backup" — pakai kode yang sudah ada

**Scope akhir: 5 fitur saja** (§3).

---

## 2. Model data

Satu tabel: `barang`.

```sql
CREATE TABLE barang (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  stok       INTEGER NOT NULL DEFAULT 0  CHECK (stok >= 0),
  harga_beli REAL    NOT NULL            CHECK (harga_beli >= 0),
  harga_jual REAL    NOT NULL            CHECK (harga_jual >= 0),
  dibuat_pada  TEXT  NOT NULL DEFAULT (datetime('now')),
  diubah_pada  TEXT  NOT NULL DEFAULT (datetime('now'))
);
```

**Keputusan yang diambil:**
1. **Nama barang wajib UNIK** (case-insensitive, mis. "Kabel" = "kabel") — karena tidak ada
   kode barang, nama menjadi satu-satunya identitas barang. Tanpa keunikan, transaksi
   bisa salah sasaran.
2. `id` adalah primary key internal (bukan ditampilkan; bukan kode barang).
3. Stok integer ≥ 0, harga real ≥ 0 — validasi keras ganda: di UI **dan** `CHECK` constraint di DB.
4. **Tidak ada tabel transaksi/riwayat** — koreksi kesalahan hanya via Catat BELI/JUAL baru.
   Ini disengaja demi kesederhanaan (bisa ditambah nanti bila Rama membutuhkannya).
5. Tabel `pengguna` (login) tetap ada dan tidak berubah.

**Migrasi:** `migrasi/004_sederhana.sql` — drop tabel `kategori`, `kode_barang`,
`kategori_kode_barang`; rebuild `barang` ke skema di atas (DROP COLUMN tidak didukung
SQLite, jadi rebuild via tabel sementara). Data lama di tabel yang dihapus dibuang
(belum ada data produksi — Rama baru coba-coba). Migration runner lama dipakai ulang.

> Opsional: dependency `jsbarcode`, `@zxing/browser`, `xlsx`, `jspdf`(+autotable) di
> `package.json` tidak dipakai Ventra Simple — boleh dicopot saat implementasi.

---

## 3. Fitur (5 saja)

### F1. Tambah Barang
Form: Nama (teks, wajib), Stok awal (integer ≥ 0, default 0), Harga beli (≥ 0),
Harga jual (≥ 0). Simpan → masuk daftar.

**Aturan:**
- Nama: wajib, di-trim; tidak boleh duplikat (case-insensitive) — error jelas "Barang
  dengan nama tersebut sudah ada".
- Harga jual BOLEH < harga beli (mis. barang rusak/obral) — tidak diblokir,
  hanya peringatan visual di daftar (nilai "potensi laba" per item jadi negatif).
- Satuan terkunci "pcs" (tampil statis, tidak bisa diubah).
- `diubah_pada` di-update setiap transaksi F3/F4.

**Acceptance:**
- [ ] Nama kosong / hanya spasi → ditolak, pesan jelas.
- [ ] Nama duplikat ("kabel" setelah "Kabel") → ditolak, pesan jelas.
- [ ] Harga beli/jual negatif → ditolak (UI + DB constraint).
- [ ] Stok awal negatif / pecahan → ditolak; stok pecahan tidak disimpan.
- [ ] Tambah berhasil → barang langsung muncul di daftar dengan stok awal.

### F2. Hapus Barang
Tombol hapus per baris → dialog konfirmasi ("Hapus *nama*? Tindakan ini tidak bisa
dibatalkan.") → Ya / Batal.

**Acceptance:**
- [ ] Klik hapus TIDAK langsung menghapus — konfirmasi selalu muncul dulu.
- [ ] "Batal" / klik di luar dialog → barang tetap ada.
- [ ] "Ya" → barang hilang dari daftar, ringkasan otomatis ter-update.
- [ ] (Hard delete — tidak ada soft delete; tidak ada riwayat yang perlu dijaga.)

### F3. Catat BELI (stok masuk)
Per baris barang: tombol/tambah "Beli" → input qty (integer > 0) → simpan → stok
bertambah `stok = stok + qty`. Update dalam satu transaksi DB (atomik).

**Acceptance:**
- [ ] qty ≤ 0 atau bukan bilangan bulat → ditolak, stok tidak berubah.
- [ ] qty valid → stok bertambah tepat sesuai qty, `diubah_pada` ter-update.
- [ ] Setelah reload → stok tetap (persisten di OPFS).

### F4. Catat JUAL (stok keluar)
Per baris barang: tombol "Jual" → input qty (integer > 0) → simpan.
- Jika `qty ≤ stok`: stok berkurang `stok = stok − qty` (atomik, satu transaksi DB).
- Jika `qty > stok`: **DITOLAK** — pesan jelas "Stok tidak mencukupi (sisa: N pcs)".
  Stok tidak berubah; tidak ada yang tercatat.

**Acceptance:**
- [ ] Jual 3 saat stok 5 → stok jadi 2.
- [ ] Jual 6 saat stok 5 → ditolak, pesan "Stok tidak mencukupi (sisa: 5 pcs)",
  stok tetap 5.
- [ ] Jual seluruh sisa (stok 2, qty 2) → diizinkan, stok jadi 0, badge "Habis".
- [ ] qty ≤ 0 / pecahan → ditolak.

### F5. Daftar Barang + Ringkasan Otomatis
Satu layar utama (setelah login): tabel semua barang + kotak ringkasan di atas,
selalu ter-update otomatis setiap ada perubahan.

**Kolom tabel:** Nama | Stok (pcs) | Harga beli | Harga jual | Status | Aksi (Beli / Jual / Hapus)

**Ringkasan (auto-calculate):**
| Metrik | Rumus |
|---|---|
| Total jenis barang | COUNT(\*) |
| Nilai stok | Σ(stok × harga_beli) — keputusan final Rama (sesuai spec lama §baris-27) |
| Potensi laba | Σ(stok × (harga_jual − harga_beli)) |
| Barang menipis | daftar barang dengan stok ≤ 5 |

**Indikator visual stok (ambil alih fungsi "stok minimum" yang dibuang):**
- Ambang **menipis: stok ≤ 5** (disarankan task; diterapkan global, bukan per barang).
- Badge per baris: **"Habis"** (abu-abu) bila stok = 0; **"Menipis"** (merah/oranye)
  bila 1–5; tanpa badge bila > 5.
- (Opsional, bila sempat: tombol filter "tampilkan yang menipis saja".)

**Pencarian:** satu kotak search — filter instan berdasarkan nama (client-side).

**Acceptance:**
- [ ] Setiap perubahan stok (BELI/JUAL/tambah/hapus) → ringkasan berubah tanpa reload.
- [ ] Daftar kosong → tampil pesan informatif ("Belum ada barang. Klik Tambah Barang."), bukan tabel kosong.
- [ ] Badge Habis/Menipis muncul sesuai ambang di atas.
- [ ] Pencarian "kab" menemukan "Kabel HDMI".
- [ ] Nilai stok = jumlah akurat stok×harga_beli (spot-check dengan kalkulator).
- [ ] Format uang: Rupiah dengan pemisah ribuan (mis. `Rp 12.500`).

### F6 (non-fitur). Tetap dipertahankan
- **Login 1 akun** — pakai `pengguna` + layar login yang sudah ada; seluruh app terkunci di balik login.
- **Tombol "Unduh Backup"** — pakai `eksporDatabase()` yang sudah ada (file `.db` ke folder Download).
- **Template B gelap operasional** untuk semua layar baru.

---

## 4. Out of scope (eksplisit, JANGAN dikerjakan)

- Kode barang (generate/auto/custom) — TIDAK ADA.
- Kategori barang — TIDAK ADA.
- Barcode (generate/display) & scan kamera — TIDAK ADA.
- Laporan/export Excel & PDF — TIDAK ADA.
- Multi-user, peran/roles, RBAC — TIDAK ADA (tetap 1 akun).
- Riwayat mutasi/kartu stok — TIDAK ADA (lihat §2 keputusan #4).
- Stok minimum per barang — TIDAK ADA (diganti ambang global ≤ 5).
- Stok opname khusus — koreksi cukup via BELI/JUAL.

---

## 5. Non-fungsional

- **Offline penuh:** tidak ada fetch/XHR ke mana pun. (Keputusan Lama Rama — berlaku.)
- **Validasi ganda:** constraint `CHECK` di DB (stok/harga ≥ 0, nama UNIQUE)
  + validasi di UI. Aturan anti-stok-negatif ditegakkan dengan transaksi DB atomik,
  bukan sekadar cek di UI.
- **Desktop-first**, Chrome/Edge di Windows 10/11.
- **Satu tab saja** — database satu koneksi (aturan lama; OPFS di origin
  `localhost:5173` untuk dev dan `localhost/ventra` untuk XAMPP = DB terpisah).
- **Kriteria go-live minimal:** (1) `npm run build` sukses tanpa error TS;
  (2) 50 barang + 200 transaksi BELI/JUAL tanpa error di laptop Rama;
  (3) backup → unduh file `.db` → buka di DB Browser → data utuh.

---

## 6. Urutan kerja yang disarankan untuk implementasi

1. Migrasi `004_sederhana.sql` (rebuild `barang`, drop tabel tak terpakai).
2. Service barang baru (CRUD + beli/jual atomik) — repository lama diarsipkan.
3. Layar utama: daftar + ringkasan + search (Template B).
4. Form Tambah Barang + dialog hapus + dialog BELI/JUAL.
5. Verifikasi §5 + update README/docs + push (aturan realtime update).

---

*Catatan:* halaman login & backup sudah ada di repo lama — gunakan ulang, jangan tulis ulang.
