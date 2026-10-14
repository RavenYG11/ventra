# VENTRA — Spesifikasi MVP v1 (FINAL/BEKU)

**Aplikasi stock barang sederhana — offline, desktop, lokal di laptop Rama.**
Disusun: 14 Okt 2026 oleh tim Virtual Office (Manager: Muse). Diperbarui: 14 Okt 2026 — 6 jawaban final Rama (baris 19–21 baru; baris 1, 5, 7 disesuaikan; §4/§6/§7/§10/§11 diselaraskan).
Sumber: hasil Meeting #1 + 18 jawaban final Rama + 6 jawaban tambahan Rama (14 Okt 2026) — jawaban Rama mengesampingkan semua asumsi lama.
Status: **BEKU** — jangan mulai coding di luar daftar ini tanpa persetujuan Rama.

---

## 1. Ringkasan

Ventra adalah aplikasi desktop Windows yang 100% offline untuk mencatat stok barang: master barang → catat stok masuk → catat stok keluar → lihat sisa stok → riwayat/laporan. Satu akun, satu lokasi, satuan pcs, database lokal SQLite, tanpa server/cloud/internet.

**Rekomendasi teknologi (konvergensi Sentot–Gunet–Epthal–Magna): Tauri 2 + TypeScript + React (Vite) + SQLite.** Installer ±15 MB, nol biaya infra. Detail lengkap: `tech-stack.md`.

---

## 2. Tabel keputusan terkunci (24 jawaban Rama)

| # | Pertanyaan | Jawaban Rama | Implikasi |
|---|-----------|--------------|-----------|
| 1 | Pengguna & peran | Satu akun, tanpa peran, wajib ada login page; multi-user = kebutuhan masa depan (di luar MVP) | Tabel `pengguna` 1 baris; tanpa RBAC; semua layar terkunci di balik login; multi-user dicatat untuk versi mendatang |
| 2 | Lokasi/gudang | Tidak perlu | Tanpa field lokasi; tanpa multi-gudang |
| 3 | Perangkat | PC/laptop | UI desktop-first |
| 4 | Online/offline | Offline | 100% lokal; tanpa sinkronisasi, tanpa ketergantungan internet |
| 5 | Skala | <10.000 SKU (asumsi) | SQLite lebih dari cukup |
| 6 | Data awal | Input manual | Form tambah barang; tanpa fitur import |
| 7 | Barcode | Belum ada → generate barcode BARU per ITEM + fitur scan via kamera laptop; barcode display-only di UI (tanpa printer/cetak) | Generate Code128 per item + scan kamera laptop (@zxing/browser, offline); tanpa USB scanner; tanpa alur print |
| 8 | Stok negatif | Realtime, tidak boleh negatif | Validasi keras: tolak transaksi keluar yang melebihi stok |
| 9 | Satuan | Pcs saja | Satuan terkunci "pcs"; tanpa konversi |
| 10 | Nilai uang | Harga beli & harga jual input manual; sisanya auto-calculate | Kolom harga_beli + harga_jual; margin & nilai stok dihitung otomatis |
| 11 | Laporan | Excel & PDF | Export kedua format |
| 12 | Stok menipis | Indikator visual saja | Badge/warna di dashboard & daftar; tanpa notifikasi aktif |
| 13 | Pencatatan existing | Tidak ada | Tanpa migrasi data |
| 14 | Hosting | Lokal di laptop Rama | Tanpa server/cloud/VPS; anggaran infra nol |
| 15 | Akses | Lokal | Tanpa akses internet |
| 16 | Data sensitif | Tidak ada; adakan reset & forgot password TANPA meminta password lama | Mekanisme reset (pilihan final menunggu Rama — lihat §8) |
| 17 | Internal/integrasi | Internal, tanpa integrasi | Tanpa API/integrasi pihak ketiga |
| 18 | Tenggat | Secepatnya; "sederhana banget" | Scope minimal; tanpa fitur di luar daftar ini |
| 19 | OS target | Windows 10/11 64-bit | Installer `.exe` 64-bit; OS terkunci — tanpa dukungan OS lain di MVP |
| 20 | Printer | Tidak ada; barcode display-only di UI | Tanpa alur cetak label; barcode dirender di UI saja |
| 21 | Backup | Otomatis lokal saja, tanpa eksternal | Backup otomatis ke folder Backup lokal (retensi 7 hari); tanpa cloud/eksternal/flashdisk di MVP |
| 22 | USB scanner | Tidak ada & tidak perlu dibeli | Scan hanya via kamera laptop; tanpa keyboard-wedge |
| 23 | Multi-user/cabang | Dibutuhkan di masa depan; MVP tetap 1 akun tanpa peran | Catat implikasi arsitektur (lihat tech-stack.md); tanpa over-engineering sekarang |
| 24 | Volume data | Di bawah 10.000 SKU | Asumsi volume; SQLite sangat longgar |

---

## 3. Daftar fitur MVP final

- **F1. Master barang** — CRUD barang. Kode/SKU unik (wajib), nama (wajib), kategori, satuan terkunci "pcs", harga beli & harga jual (manual, ≥ 0), stok awal, stok minimum. Barcode Code128 ter-generate otomatis per item (unik, tampil di UI — tanpa cetak). Pencarian instan (nama/kode/barcode). Soft delete (nonaktif, riwayat tetap utuh).
- **F2. Stok masuk** — Tanggal, barang (pilih/cari/scan barcode), jumlah > 0 (stepper), sumber (pembelian/retur/lainnya), keterangan. Alur maksimal 3 langkah.
- **F3. Stok keluar** — Tanggal, barang, jumlah, tujuan (penjualan/pemakaian/lainnya), keterangan. **WAJIB menolak** transaksi yang membuat stok negatif (pesan jelas "Stok tidak mencukupi", stok tidak berubah, tidak ada baris transaksi tertulis).
- **F4. Kartu stok / riwayat mutasi** — Per barang: siapa, kapan, jenis transaksi, jumlah, stok sebelum/sesudah. Append-only; koreksi hanya lewat transaksi penyesuaian beralasan (keterangan wajib).
- **F5. Dashboard** — Total jenis barang, total nilai stok (stok × harga beli), daftar barang menipis (stok ≤ minimum) dengan badge visual (mis. merah "menipis", abu "habis"), transaksi hari ini; tombol aksi besar "Catat Masuk" / "Catat Keluar".
- **F6. Daftar barang + pencarian & filter** — Nama, kode, kategori, barcode, status stok; hasil kosong yang informatif; label Bahasa Indonesia.
- **F7. Login satu akun** — Username + password (di-hash). Link "Lupa password?" → reset tanpa password lama (mekanisme §8).
- **F8. Laporan** — Stok akhir, rekap mutasi per periode, kartu stok per barang; export **Excel (.xlsx)** & **PDF** (isi §7).
- **F9. Stok opname** — Penyesuaian hasil hitung fisik tercatat sebagai transaksi penyesuaian beralasan, bukan edit diam-diam.
- **F10. Fondasi non-fungsional** — Validasi bisnis di lapisan aplikasi + constraint database (`CHECK(stok >= 0)`, transaksi atomik), password di-hash, audit trail utuh, backup otomatis + uji restore sebelum go-live, struktur kode modular per domain, dokumentasi skema data.

**Target versi:** v0.1 = F1–F3 + F7 (bisa dipakai internal) → v1.0 = F1–F9 + kriteria: 100 barang & 1.000 transaksi tanpa error, audit trail utuh, backup/restore teruji.

---

## 4. Rekomendasi teknologi (satu rekomendasi, sudah konvergen)

**Headline: Tauri 2 + TypeScript + React (Vite) + SQLite** — aplikasi desktop Windows "Ventra", 100% offline, installer ±15 MB, nol infra.

- **Framework:** TypeScript + React (Vite) untuk UI; Rust via Tauri hanya sebagai jembatan (Gunet kemungkinan tidak perlu menulis Rust — akses DB via `tauri-plugin-sql`).
- **Database:** SQLite, satu file `stok.db` — tanpa server, tanpa konfigurasi. Aturan anti-stok-negatif ditegakkan di DB (`CHECK(stok >= 0)` + transaksi atomik), mode WAL anti-corrupt.
- **Desktop:** Tauri 2 (jendela native + webview sistem). Tradeoff jujur: butuh WebView2 (umumnya sudah ada di Win 10/11); toolchain Rust hanya di laptop dev. Ditolak: Electron (150 MB+, rakus RAM), web server lokal + browser (bukan aplikasi beneran).
- **Barcode generate:** jsbarcode (Code128, pure-JS, tampil di UI saja — tanpa cetak). **Scan:** kamera laptop via @zxing/browser (offline); tanpa USB scanner di MVP.
- **Export Excel:** SheetJS (`xlsx` Community). **Export PDF:** pdfmake. Keduanya pure-JS, offline penuh.
- **Instalasi:** `Ventra-setup.exe` → Next → Finish → buat akun → pakai. Data di folder data aplikasi lokal.
- **Backup:** otomatis tiap aplikasi dibuka ke folder Backup lokal (rotasi 7 hari, tanpa eksternal) + tombol "Backup sekarang".
- **Modul:** auth, dashboard, barang, barcode, transaksi, laporan, pengaturan & backup.
- Detail lengkap: `tech-stack.md`. Model data lengkap: `model-data.md`. Pendekatan build: `pendekatan-teknis-gunet.md`.

---

## 5. Model data (ringkas — lengkap di `model-data.md`)

| Tabel | Fungsi |
|-------|--------|
| `barang` | Master: kode (UNIQUE), nama, barcode (UNIQUE, per item), satuan terkunci 'pcs', harga_beli, harga_jual (manual, ≥ 0), stok (turunan, ≥ 0), stok_awal, stok_minimum, aktif (soft delete) |
| `transaksi_stok` | Audit trail append-only: barang_id, jenis (masuk/keluar/penyesuaian), jumlah, stok_sebelum, stok_sesudah, referensi, keterangan (wajib utk penyesuaian), dibuat_oleh, dibuat_pada. Tanpa UPDATE/DELETE. |
| `pengguna` | Satu baris (id=1): nama_pengguna, kata_sandi_hash |
| `pengaturan` | Key–value: nama_toko, stok_minimum_default, peringatan_stok_menipis |

Dihitung saat dibaca (tidak disimpan): margin_rp = harga_jual − harga_beli; margin_persen; nilai_stok = stok × harga_beli; status_stok = habis / menipis / aman.

---

## 6. Desain barcode (tanpa printer — display-only di UI)

- **Symbology:** Code128 (mendukung alfanumerik, umum untuk label internal).
- **Cakupan:** SATU barcode per ITEM (bukan per kategori) — sesuai permintaan Rama.
- **Penomoran:** otomatis `BRG-000001`, `BRG-000002`, … (UNIQUE di database). Disarankan; pola custom menunggu konfirmasi Rama (lihat §11).
- **Generate:** otomatis saat barang dibuat (jsbarcode, render ke canvas/SVG — **hanya tampil di UI, tanpa cetak**).
- **Scan:** kamera laptop (@zxing/browser, offline). **Tanpa USB scanner di MVP.**
- **Tanpa printer:** aplikasi tidak menyediakan alur cetak label; barcode ditampilkan di layar untuk dilihat atau dipindai ulang dari layar bila perlu.

---

## 7. Isi laporan (Excel & PDF)

Kop: nama toko (dari pengaturan) + tanggal cetak + periode.

Catatan: export Excel/PDF adalah unduhan file, bukan cetak ke printer — konsisten dengan keputusan tanpa printer (baris 20).

- **Laporan Stok Akhir:** tabel barang (kode, nama, barcode, stok, stok minimum, status, harga beli, harga jual, margin, nilai stok) + baris total nilai stok.
- **Rekap Mutasi per Periode:** filter tanggal; tabel transaksi (tanggal, barang, jenis, jumlah, stok sebelum/sesudah, sumber/tujuan, keterangan, dicatat oleh).
- **Kartu Stok per Barang:** header info barang + seluruh riwayat transaksinya.

---

## 8. Kebijakan password & audit (Cipher)

- Login: username + password; password disimpan sebagai hash (bcrypt/argon2), tidak pernah plaintext. Semua layar terkunci di balik login; login gagal/berhasil dicatat.
- **Reset/forgot password TANPA password lama** — dua kandidat, pilihan final menunggu Rama:
  - **A. Kode pemulihan (disarankan tim teknis):** dibuat sekali saat akun dibuat, wajib dicatat/disimpan Rama. Lupa password → masukkan kode pemulihan → buat password baru. Lebih aman; risiko: kode hilang = tidak bisa reset (jalan keluar: instal ulang + restore backup).
  - **B. Pertanyaan keamanan:** jawab pertanyaan yang ditetapkan di awal → buat password baru. Lebih simpel (tidak ada yang perlu disimpan); lebih lemah (mudah ditebak orang dekat).
  - Event reset selalu dicatat di audit log; password lama langsung tidak berlaku.
- Audit trail transaksi: siapa, kapan, jenis, jumlah, stok sebelum/sesudah — tidak bisa diedit/dihapus.

---

## 9. Acceptance criteria (ringkas — Testarossa)

- F1: kode duplikat/nama kosong/harga negatif → ditolak; barcode unik ter-generate; hapus = soft delete.
- F2: jumlah 0/negatif → ditolak; barang wajib dipilih.
- F3: jumlah > stok → **DITOLAK** ("Stok tidak mencukupi"), stok tidak berubah, tidak ada baris tertulis.
- F4: riwayat lengkap & tidak bisa diedit/dihapus dari UI; koreksi hanya via penyesuaian beralasan.
- F5: angka dashboard cocok dengan data; badge visual untuk menipis/habis; tombol aksi membuka layar yang benar.
- F6: pencarian nama/kode/barcode tepat; hasil kosong informatif.
- F7: kredensial salah → ditolak; tanpa login → dialihkan; reset password mengikuti §8.
- F8: angka laporan = data aplikasi; periode kosong → laporan kosong yang jelas.
- F9: alasan kosong → ditolak; stok berubah sesuai selisih.
- F10: 100 barang & 1.000 transaksi tanpa error; backup terbentuk & restore teruji sebelum go-live.

---

## 10. Backup & runbook (Epthal)

- **Backup otomatis:** tiap aplikasi ditutup (min. 1×/hari), salin `stok.db` ke folder Backup dengan nama bertanggal; retensi 7 hari. **Hanya lokal — tanpa backup eksternal/cloud/flashdisk di MVP.** Tombol "Backup sekarang" (mis. sebelum opname) — tetap ke folder Backup lokal.
- **Restore:** Pengaturan → Pulihkan Backup → pilih file → konfirmasi. Manual: timpa file db saat aplikasi tertutup.
- **Instalasi:** `Ventra-setup.exe` → Next → Finish → buat akun → pakai. Tanpa internet.
- **Runbook:** aplikasi tidak bisa dibuka → instal ulang (data terpisah, aman). Data hilang/rusak → restore backup terbaru → cek dashboard. Backup bermasalah → pakai backup sehari sebelumnya; catat transaksi yang hilang untuk input ulang. **Wajib uji restore 1× sebelum go-live.**

---

## 11. Hal yang masih terbuka (dengan rekomendasi — tidak ditebak)

1. **OS laptop Rama** — **TERKUNCI:** Windows 10/11 64-bit (lihat baris 19). Tidak lagi terbuka.
2. **Mekanisme lupa password** — disarankan A (kode pemulihan); alternatif B (pertanyaan keamanan). Lihat §8.
3. **Format kode/barcode** — disarankan otomatis `BRG-000001`; atau pola sendiri dari Rama.
4. **Definisi nilai stok** — disarankan stok × harga beli; alternatif × harga jual.
5. **Jadwal backup otomatis** — §4 menyebut saat aplikasi dibuka, §10 menyebut saat aplikasi ditutup. Perlu satu keputusan final dari Rama.

---

## 12. Referensi file

- `tech-stack.md` — rincian tech stack lengkap (Sentot).
- `model-data.md` — model data lengkap + contoh + kasus batas (Broto).
- `pendekatan-teknis-gunet.md` — pendekatan teknis & rencana build (Gunet).
- `mockups/template-a.html` — mockup Template A (terang, minimal).
- `mockups/template-b.html` — mockup Template B (padat-operasional, kontras tinggi).
