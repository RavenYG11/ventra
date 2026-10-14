# SPESIFIKASI MVP BEKU — Ventra (Aplikasi Stock Barang)

- **Status:** BEKU — 14 Oktober 2026
- **Dibekukan oleh:** Kurniatot (Software & Project Analyst)
- **Dasar:** 18 jawaban final Rama. Jawaban Rama mengesampingkan semua asumsi Meeting #1.
- **Nama aplikasi:** Ventra — aplikasi stock barang sederhana, desktop, offline, lokal di laptop Rama.

## 1. Ringkasan satu paragraf

Ventra adalah aplikasi desktop offline satu-akun yang berjalan lokal di laptop Rama (tanpa server, tanpa internet, tanpa biaya infra).
Inti: master barang (kode/SKU unik + barcode Code128 per item) → catat stok masuk/keluar (tolak stok negatif) →
lihat sisa stok & kartu stok (audit trail append-only) → laporan Excel/PDF.
Satuan tunggal "pcs", tanpa multi-gudang, tanpa peran pengguna.
Harga beli & harga jual diinput manual; margin dan nilai stok dihitung otomatis.
Stok menipis hanya ditandai visual di dashboard (tanpa notifikasi WA).

## 2. Daftar fitur MVP final

**F1. Master barang**
Tambah/ubah/nonaktifkan barang. Field: kode/SKU unik (wajib), nama (wajib), kategori,
satuan tetap "pcs", harga beli (manual), harga jual (manual), stok awal, stok minimum,
barcode Code128 per item (generate otomatis, siap cetak label). Pencarian instan by nama/kode.

**F2. Catat stok masuk**
Tanggal, barang (pilih dari daftar / scan barcode), jumlah > 0, sumber (pembelian/retur/lainnya),
keterangan. Alur maksimal 3 langkah.

**F3. Catat stok keluar**
Tanggal, barang (pilih / scan barcode), jumlah, tujuan (penjualan/pemakaian/lainnya), keterangan.
Sistem MENOLAK transaksi yang membuat stok negatif.

**F4. Stok opname / penyesuaian**
Koreksi hasil hitung fisik dicatat sebagai transaksi penyesuaian beralasan.
Tidak ada edit/hapus diam-diam (append-only).

**F5. Kartu stok & riwayat mutasi**
Per barang: kapan, jenis transaksi (masuk/keluar/penyesuaian/stok awal), jumlah,
stok sebelum → sesudah, oleh akun. Append-only, tidak bisa diubah/dihapus.

**F6. Dashboard**
Total jenis barang, daftar barang menipis (stok ≤ stok minimum) dengan penanda visual
(badge/warna — bukan notifikasi), transaksi hari ini, tombol besar "Catat Masuk" / "Catat Keluar",
total nilai stok (otomatis: Σ sisa stok × harga beli).

**F7. Daftar & pencarian barang**
Filter nama, kode, kategori, plus filter khusus "stok menipis". Label Bahasa Indonesia.

**F8. Login satu akun**
Satu akun + password (disimpan sebagai hash). Fitur lupa/reset password TANPA meminta password lama
(mekanisme konkret dirancang Cipher). Tanpa peran admin/staf.

**F9. Laporan**
Stok akhir, rekap mutasi per periode, kartu stok per barang.
Tampil di layar + export Excel dan PDF.

**F10. Scan barcode**
Kolom scan barcode di layar transaksi F2/F3. Scanner USB (keyboard wedge) sebagai utama,
kamera sebagai cadangan.

**Fondasi non-fungsional (bukan fitur, wajib ada):**
aplikasi desktop offline di laptop Rama; database lokal; backup otomatis data lokal +
prosedur restore teruji; instalasi sekali-klik; validasi bisnis di sisi aplikasi;
penyimpanan password aman (hash); struktur kode modular per domain; runbook operasional.

**Rumus terkunci:**
- Margin per barang = harga jual − harga beli
- Nilai stok per barang = sisa stok × harga beli

## 3. Tabel keputusan terkunci (pertanyaan → jawaban → implikasi)

| # | Pertanyaan (Meeting #1) | Jawaban final Rama | Implikasi |
|---|---|---|---|
| Q1 | Pengguna & peran? | Satu akun + login, **tanpa peran** | Auth sederhana; tanpa RBAC; audit trail tetap mencatat akun |
| Q2 | Multi-gudang? | **Tidak** — satu lokasi | Tanpa entitas/tabel gudang; stok per barang tunggal |
| Q3 | Perangkat utama? | Laptop/komputer, **desktop-first** | UI desktop-first; HP bukan target utama |
| Q4 | Online / offline / lokal? | **Offline penuh, lokal di laptop** | Tanpa server, tanpa internet, tanpa sinkronisasi |
| Q5 | Volume SKU & transaksi? | **Belum dikunci** (contoh kerja: puluhan SKU) | Desain untuk skala kecil; uji beban menunggu angka Rama |
| Q6 | Data awal: manual / import? | **Belum dikunci** | Opsi: input manual atau import Excel/CSV — tunggu Rama |
| Q7 | Barcode / scan? | **Ya** — barcode Code128 per item + scan | F1 generate barcode; F10 kolom scan di transaksi |
| Q8 | Stok boleh negatif? | **Tidak — sistem menolak** | Validasi: keluar > stok → transaksi ditolak |
| Q9 | Satuan ganda? | **Tidak — pcs saja** | Satuan fixed "pcs"; tanpa tabel konversi |
| Q10 | Stok saja atau + nilai uang? | **+ nilai uang**: harga beli & jual manual | Margin & nilai stok auto-calculate (lihat rumus) |
| Q11 | Laporan & format? | Stok akhir, rekap mutasi, kartu stok; **Excel & PDF** (+ layar) | F9 |
| Q12 | Stok menipis: visual / notifikasi? | **Indikator visual saja** | Badge/warna di dashboard; tanpa WA/push |
| Q13 | Sistem pencatatan saat ini? | **Belum dikunci** | Perlu contoh format Rama agar alur familier |
| Q14 | Hosting & anggaran? | **Lokal di laptop; tanpa server/VPS/cloud; anggaran infra nol** | Instalasi desktop; backup lokal otomatis |
| Q15 | Akses internet / downtime? | **Cukup lokal** (konsekuensi Q4+Q14) | Tidak perlu akses internet; downtime = laptop mati |
| Q16 | Data kritis & keamanan? | Audit trail transaksi + event keamanan; login hash; **reset tanpa password lama** | Kebijakan dirancang Cipher; audit: siapa/kapan/jenis/jumlah/stok sebelum-sesudah |
| Q17 | Internal / dijual? Integrasi? | **Internal saja; tanpa integrasi di MVP** | Custom build; tanpa API POS/akuntansi/marketplace |
| Q18 | Target tanggal MVP operasional? | **Belum dikunci** | Estimasi & jadwal menunggu tanggal Rama |

Status: **14 dari 18 terkunci.** Q5 (sebagian), Q6, Q13, Q18 menunggu jawaban Rama — lihat §6.

## 4. Definisi target versi

**v0.1 — "Bisa dipakai internal"**
F1 (master barang) + F2/F3 (catat masuk/keluar) + F8 (login satu akun).
Kriteria: alur inti jalan end-to-end di laptop Rama; setiap perubahan stok tercatat di audit trail.

**v1.0 — "Siap operasional"**
Seluruh F1–F10 + fondasi non-fungsional.
Kriteria keberhasilan: semua acceptance criteria per fitur lulus (Testarossa),
audit trail utuh dan tidak bisa dimanipulasi, backup + restore teruji,
instalasi desktop berjalan di laptop Rama.

**Pasca-MVP (tetap di luar cakupan):**
multi-gudang, multi-satuan + konversi, integrasi POS/akuntansi/marketplace,
notifikasi WA/push, multi-user + peran, akses online/sinkronisasi cloud.

## 5. Asumsi lama yang dikesampingkan jawaban Rama

- Web responsif/mobile-first → diganti **desktop-first offline** (Q3, Q4).
- Login + peran admin/staf → diganti **satu akun tanpa peran** (Q1).
- Barcode/QR ditunda → **masuk MVP** (Q7).
- Harga/HPP/margin ditunda → **masuk MVP** (Q10).
- "Mode offline tidak termasuk MVP" → aplikasi **memang offline-lokal** (Q4).
- Estimasi kasar 3–6 minggu (asumsi Opsi A) → **tidak dipakai**; estimasi baru disusun setelah spesifikasi beku.
- Tetap di luar MVP: multi-gudang, multi-satuan, notifikasi WA/push, integrasi pihak ketiga.

## 6. Pertanyaan susulan untuk Rama (via Manager)

1. Q5: berapa transaksi stok per hari (perkiraan)?
2. Q6: data barang awal mau input manual atau import dari Excel/CSV? (Jika ada file, minta contoh.)
3. Q13: sistem pencatatan yang dipakai sekarang (buku/Excel/aplikasi)? Minta contoh formatnya.
4. Q18: target tanggal Ventra bisa dipakai operasional?
5. OS laptop Rama: Windows / Mac / Linux? (untuk paket instalasi)
6. Apakah tersedia printer label barcode?

---
*Dokumen ini adalah acuan beku untuk Gunet (build), Sentot (arsitektur), Prapto (mockup),
Testarossa (acceptance criteria), Cipher (keamanan), Epthal (backup/runbook),
Magna (validasi teknologi), dan Broto (model data). Perubahan setelah ini = perubahan cakupan,
wajib lewat Manager (Muse).*
