# VENTRA — Spesifikasi MVP v1 (FINAL/BEKU)

**Aplikasi stock barang sederhana — offline, web, lokal di laptop Rama.**
Disusun: 14 Okt 2026 oleh tim Virtual Office (Manager: Muse). Diperbarui: 14 Okt 2026 — 3 keputusan final Rama (Template B dipilih; mekanisme lupa-password final; format kode barang per kategori) — baris 25–27 baru; §6, §8, §11 disesuaikan.
**Revisi pivot (14 Okt 2026, keputusan Rama):** Tauri/desktop DIBATALKAN — aplikasi menjadi **WEB MURNI** (tanpa Rust, tanpa `.exe`; diserve XAMPP di `http://localhost/ventra`); database SQLite via WASM + OPFS; backup "otomatis saat aplikasi ditutup" diganti tombol **"Unduh Backup"** manual. §1, §4, §10, §11 dan baris 19/21 disesuaikan.
Sumber: hasil Meeting #1 + 18 jawaban final Rama + 6 jawaban tambahan Rama (14 Okt 2026) — jawaban Rama mengesampingkan semua asumsi lama.
Status: **BEKU** — jangan mulai coding di luar daftar ini tanpa persetujuan Rama.

---

## 1. Ringkasan

Ventra adalah aplikasi web yang 100% offline untuk mencatat stok barang: master barang → catat stok masuk → catat stok keluar → lihat sisa stok → riwayat/laporan. Satu akun, satu lokasi, satuan pcs, database lokal SQLite (via WebAssembly + OPFS di browser), tanpa server/cloud/internet. Dijalankan via XAMPP di `http://localhost/ventra`.

**Rekomendasi teknologi (konvergensi Sentot–Gunet–Epthal–Magna + pivot web 14 Okt 2026): TypeScript + React (Vite) + SQLite-WASM.** Tanpa install, nol biaya infra. Detail lengkap: `tech-stack.md`.

**Referensi desain (TERKUNCI):** Template B — mockup `specs/mockups/template-b.html` menjadi acuan visual build (dipilih Rama 14 Okt 2026).

---

## 2. Tabel keputusan terkunci (27 jawaban Rama)

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
| 16 | Data sensitif | Tidak ada; adakan reset & forgot password TANPA meminta password lama | Mekanisme reset FINAL: username → cek akun → jika ada, field reset menjadi unrestricted (langsung set password baru tanpa password lama) — MENGGANTIKAN opsi A/B (lihat §8) |
| 17 | Internal/integrasi | Internal, tanpa integrasi | Tanpa API/integrasi pihak ketiga |
| 18 | Tenggat | Secepatnya; "sederhana banget" | Scope minimal; tanpa fitur di luar daftar ini |
| 19 | OS target | Windows 10/11 64-bit + browser modern (Chrome/Edge) | Tanpa `.exe`/installer — aplikasi web via XAMPP `http://localhost/ventra`; OS terkunci — tanpa dukungan OS lain di MVP |
| 20 | Printer | Tidak ada; barcode display-only di UI | Tanpa alur cetak label; barcode dirender di UI saja |
| 21 | Backup | Manual via tombol "Unduh Backup" (file `.db` ke folder Download) | Backup otomatis saat aplikasi ditutup DIBATALKAN (browser memblokir download saat tab ditutup); tanpa cloud/eksternal otomatis di MVP |
| 22 | USB scanner | Tidak ada & tidak perlu dibeli | Scan hanya via kamera laptop; tanpa keyboard-wedge |
| 23 | Multi-user/cabang | Dibutuhkan di masa depan; MVP tetap 1 akun tanpa peran | Catat implikasi arsitektur (lihat tech-stack.md); tanpa over-engineering sekarang |
| 24 | Volume data | Di bawah 10.000 SKU | Asumsi volume; SQLite sangat longgar |
| 25 | Referensi desain (final, 14 Okt 2026) | Template B DIPILIH | Mockup `specs/mockups/template-b.html` menjadi acuan visual build; Template A tidak dipakai |
| 26 | Mekanisme lupa-password (final, 14 Okt 2026) | Username → cek keberadaan akun → jika ada, field reset password menjadi unrestricted (langsung set password baru tanpa password lama) | MENGGANTIKAN opsi A (kode pemulihan) dan B (pertanyaan keamanan); event reset tetap dicatat di audit log |
| 27 | Format kode barang (final, 14 Okt 2026) | User mengonfigurasi sendiri pola kode PER KATEGORI; setiap barang baru auto-generate kode sekuensial (cth. `BRG-0000001`, `BRG-0000002`); kategori barang = entitas yang bisa CRUD | Tabel `kategori` baru di model data; pola per kategori disimpan di konfigurasi kategori; kode tetap UNIQUE |

---

## 3. Daftar fitur MVP final

- **F1. Master barang** — CRUD barang + **CRUD kategori barang** (entitas baru). Pola kode barang dikonfigurasi sendiri oleh user PER KATEGORI (cth. prefix + nomor urut); setiap barang baru **auto-generate kode sekuensial** (cth. `BRG-0000001`, `BRG-0000002`, …), kode wajib & unik. Nama (wajib), kategori (wajib), satuan terkunci "pcs", harga beli & harga jual (manual, ≥ 0), stok awal, stok minimum. Barcode Code128 ter-generate otomatis per item (unik, tampil di UI — tanpa cetak). Pencarian instan (nama/kode/barcode). Soft delete (nonaktif, riwayat tetap utuh).
- **F2. Stok masuk** — Tanggal, barang (pilih/cari/scan barcode), jumlah > 0 (stepper), sumber (pembelian/retur/lainnya), keterangan. Alur maksimal 3 langkah.
- **F3. Stok keluar** — Tanggal, barang, jumlah, tujuan (penjualan/pemakaian/lainnya), keterangan. **WAJIB menolak** transaksi yang membuat stok negatif (pesan jelas "Stok tidak mencukupi", stok tidak berubah, tidak ada baris transaksi tertulis).
- **F4. Kartu stok / riwayat mutasi** — Per barang: siapa, kapan, jenis transaksi, jumlah, stok sebelum/sesudah. Append-only; koreksi hanya lewat transaksi penyesuaian beralasan (keterangan wajib).
- **F5. Dashboard** — Total jenis barang, total nilai stok (stok × harga beli), daftar barang menipis (stok ≤ minimum) dengan badge visual (mis. merah "menipis", abu "habis"), transaksi hari ini; tombol aksi besar "Catat Masuk" / "Catat Keluar".
- **F6. Daftar barang + pencarian & filter** — Nama, kode, kategori, barcode, status stok; hasil kosong yang informatif; label Bahasa Indonesia.
- **F7. Login satu akun** — Username + password (di-hash). Link "Lupa password?" → reset tanpa password lama (mekanisme §8).
- **F8. Laporan** — Stok akhir, rekap mutasi per periode, kartu stok per barang; export **Excel (.xlsx)** & **PDF** (isi §7).
- **F9. Stok opname** — Penyesuaian hasil hitung fisik tercatat sebagai transaksi penyesuaian beralasan, bukan edit diam-diam.
- **F10. Fondasi non-fungsional** — Validasi bisnis di lapisan aplikasi + constraint database (`CHECK(stok >= 0)`, transaksi atomik), password di-hash, audit trail utuh, backup manual (tombol "Unduh Backup") + uji restore sebelum go-live, struktur kode modular per domain, dokumentasi skema data.

**Target versi:** v0.1 = F1–F3 + F7 (bisa dipakai internal) → v1.0 = F1–F9 + kriteria: 100 barang & 1.000 transaksi tanpa error, audit trail utuh, backup/restore teruji.

---

## 4. Rekomendasi teknologi (satu rekomendasi, sudah konvergen)

**Headline: TypeScript + React (Vite) + SQLite via WebAssembly** — aplikasi web "Ventra", 100% offline, tanpa install, nol infra. **(Pivot 14 Okt 2026: Tauri/desktop dibatalkan atas keputusan Rama — tanpa Rust, tanpa `.exe`.)**

- **Framework:** TypeScript + React (Vite) untuk UI; database SQLite berjalan sebagai WASM di browser (`@sqlite.org/sqlite-wasm`), persisten di OPFS.
- **Database:** SQLite, satu database `stok.db` di OPFS browser — tanpa server, tanpa konfigurasi. Aturan anti-stok-negatif ditegakkan di DB (`CHECK(stok >= 0)` + transaksi atomik).
- **Web:** hasil `npm run build` = file statis di `dist/`, disalin ke `C:\xampp\htdocs\ventra`, diserve Apache → `http://localhost/ventra`. Tradeoff jujur: butuh XAMPP jalan; tidak bisa dobel-klik `index.html` (`file://` diblokir untuk modul ES/WASM); jangan buka di dua tab bersamaan (satu database = satu koneksi).
- **Barcode generate:** jsbarcode (Code128, pure-JS, tampil di UI saja — tanpa cetak). **Scan:** kamera laptop via @zxing/browser (offline, jalan native di browser); tanpa USB scanner di MVP.
- **Export Excel:** SheetJS (`xlsx` Community). **Export PDF:** jsPDF + autotable (bagian ini menggantikan penyebutan pdfmake sebelumnya — yang dipakai di kode adalah jsPDF). Keduanya pure-JS, offline penuh.
- **Instalasi:** tidak ada installer — salin `dist/` → `C:\xampp\htdocs\ventra` → Start Apache → buka `http://localhost/ventra` → buat akun → pakai. Data di OPFS browser (origin `http://localhost`).
- **Backup:** tombol **"Unduh Backup"** (toolbar Daftar Barang) → file `ventra-backup-YYYYMMDD-HHMMSS.db` ke folder Download. Backup otomatis saat aplikasi ditutup **tidak mungkin di browser** (download saat tab ditutup diblokir) — diganti manual.
- **Modul:** auth, dashboard, barang, barcode, transaksi, laporan, pengaturan & backup.
- Detail lengkap: `tech-stack.md`. Model data lengkap: `model-data.md`. Pendekatan build: `pendekatan-teknis-gunet.md`.

---

## 5. Model data (ringkas — lengkap di `model-data.md`)

| Tabel | Fungsi |
|-------|--------|
| `barang` | Master: kode (UNIQUE, auto-generate sekuensial sesuai pola kategorinya; barcode = kode), nama, kategori_id (FK), satuan terkunci 'pcs', harga_beli, harga_jual (manual, ≥ 0), stok (turunan, ≥ 0), stok_awal, stok_minimum, aktif (soft delete) |
| `kategori` | Entitas CRUD: nama (UNIQUE), pola_kode (cth. prefix + digit nomor urut), counter terakhir per pola. Satu kategori → satu pola; kode barang baru = pola + nomor berikutnya |
| `transaksi_stok` | Audit trail append-only: barang_id, jenis (masuk/keluar/penyesuaian), jumlah, stok_sebelum, stok_sesudah, referensi, keterangan (wajib utk penyesuaian), dibuat_oleh, dibuat_pada. Tanpa UPDATE/DELETE. |
| `pengguna` | Satu baris (id=1): nama_pengguna, kata_sandi_hash |
| `pengaturan` | Key–value: nama_toko, stok_minimum_default, peringatan_stok_menipis |

Dihitung saat dibaca (tidak disimpan): margin_rp = harga_jual − harga_beli; margin_persen; nilai_stok = stok × harga_beli; status_stok = habis / menipis / aman.

---

## 6. Desain barcode & kode barang (tanpa printer — display-only di UI)

- **Symbology:** Code128 (mendukung alfanumerik, umum untuk label internal).
- **Cakupan:** SATU barcode per ITEM (bukan per kategori) — sesuai permintaan Rama.
- **Penomoran (FINAL, 14 Okt 2026):** pola kode **dikonfigurasi sendiri oleh user PER KATEGORI** (cth. prefix + jumlah digit nomor urut). Setiap barang baru **auto-generate kode sekuensial** sesuai pola kategorinya — cth. `BRG-0000001`, `BRG-0000002`, … (UNIQUE di database). Kategori barang = entitas yang bisa CRUD (tabel `kategori`; pola + counter disimpan per kategori).
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
- **Reset/forgot password TANPA password lama (FINAL, 14 Okt 2026 — MENGGANTIKAN opsi A & B):** link "Lupa password?" → user memasukkan **username** → sistem **mengecek keberadaan akun** → jika akun ada, field reset password menjadi **unrestricted**: user langsung menetapkan password baru **tanpa memasukkan password lama**.
  - ~~A. Kode pemulihan~~ — DIHAPUS dari scope.
  - ~~B. Pertanyaan keamanan~~ — DIHAPUS dari scope.
  - **Alur langkah-demi-langkah:**
    1. Di layar login, user klik link "Lupa password?".
    2. Aplikasi menampilkan satu field username; user memasukkan username, lalu menekan "Lanjut".
    3. Sistem mengecek keberadaan akun terhadap tabel `pengguna`.
    4. **Jika username TIDAK ditemukan:** alur berhenti. Aplikasi menampilkan pesan generik yang tidak membocorkan informasi ("Silakan periksa kembali username yang dimasukkan") — username valid maupun tidak valid mendapat tampilan yang sama, untuk mencegah enumerasi akun.
    5. **Jika username DITEMUKAN:** aplikasi menampilkan form reset password dalam keadaan **unrestricted** — user langsung memasukkan password baru + konfirmasi, **tanpa** password lama, **tanpa** kode pemulihan, **tanpa** pertanyaan keamanan.
    6. User menekan "Simpan". Sistem meng-hash password baru (bcrypt/argon2) dan menimpanya ke tabel `pengguna`; hash lama langsung tidak berlaku. Aplikasi menampilkan konfirmasi berhasil dan mengarahkan kembali ke layar login.
  - **Audit log:** setiap kejadian reset dicatat satu baris (append-only, tidak bisa diedit/dihapus dari aplikasi): event `password_reset` + **timestamp** (tanggal & jam waktu lokal) + **akun** (username yang di-reset) + status (berhasil/gagal). Catatan jujur: log hanya mencatat BAHWA reset terjadi — bukan SIAPA yang melakukannya, karena alur ini tidak memverifikasi identitas pelaku reset.
  - **Catatan risiko (jujur):** **Siapapun yang memegang/memiliki akses fisik ke laptop ini dapat me-reset password dan mengambil alih akun.** Tidak ada pemisahan antara "pemegang laptop" dan "pemilik akun aplikasi" — jika laptop jatuh ke tangan orang lain, keamanan akun aplikasi ikut jatuh. Ini adalah konsekuensi langsung dari desain aplikasi single-user lokal tanpa verifikasi identitas sekunder, dan **risiko ini diterima oleh Rama (14 Okt 2026).**
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
- F10: 100 barang & 1.000 transaksi tanpa error; backup terunduh & restore teruji sebelum go-live.

---

## 10. Backup & runbook (Epthal)

- **Backup manual:** tombol **"Unduh Backup"** (toolbar layar Daftar Barang) → file `ventra-backup-YYYYMMDD-HHMMSS.db` terunduh ke folder Download; pindahkan ke flashdisk/tempat aman. **Hanya lokal — tanpa backup eksternal/cloud otomatis di MVP.** Backup otomatis saat aplikasi ditutup **DIBATALKAN** (pivot web 14 Okt 2026): browser memblokir download yang dipicu saat tab ditutup — batasan teknis, bukan pilihan desain. Biasakan backup tiap akhir hari kerja.
- **Restore:** direncanakan (impor file `.db` kembali ke OPFS) — belum ada di v0.1. **Wajib uji restore 1× sebelum go-live** (usulan Epthal).
- **Instalasi:** salin `dist/` → `C:\xampp\htdocs\ventra` → Start Apache → buka `http://localhost/ventra` → buat akun → pakai. Tanpa internet.
- **Runbook:** aplikasi tidak bisa dibuka → cek Apache jalan → reload `http://localhost/ventra`. Data hilang/rusak → (setelah fitur restore ada) restore backup terbaru → cek dashboard. Backup bermasalah → pakai backup sehari sebelumnya; catat transaksi yang hilang untuk input ulang. Jangan buka Ventra di dua tab bersamaan.

---

## 11. Hal yang masih terbuka (dengan rekomendasi — tidak ditebak)

1. **OS laptop Rama** — **TERKUNCI:** Windows 10/11 64-bit (lihat baris 19). Tidak lagi terbuka.
2. **Mekanisme lupa password** — **TERKUNCI (14 Okt 2026):** username → cek keberadaan akun → jika ada, field reset unrestricted (langsung set password baru tanpa password lama). Opsi A (kode pemulihan) dan B (pertanyaan keamanan) DIBATALKAN. Lihat §8 dan baris 26.
3. **Format kode/barcode** — **TERKUNCI (14 Okt 2026):** pola kode dikonfigurasi sendiri user PER KATEGORI; setiap barang baru auto-generate kode sekuensial (cth. `BRG-0000001`); kategori = entitas CRUD. Lihat §6 dan baris 27.
4. **Definisi nilai stok — TERKUNCI (14 Okt 2026):** nilai stok = stok × **harga beli** (keputusan final Rama).
5. **Jadwal backup — TERKUNCI (pivot web 14 Okt 2026):** backup **manual via tombol "Unduh Backup"** (file `.db`, keputusan Rama). Mekanisme lama "otomatis saat aplikasi ditutup" **DIBATALKAN** — browser memblokir download saat tab ditutup. §4 dan §10 sudah diselaraskan.

---

## 12. Referensi file

- `tech-stack.md` — rincian tech stack lengkap (Sentot).
- `model-data.md` — model data lengkap + contoh + kasus batas (Broto).
- `pendekatan-teknis-gunet.md` — pendekatan teknis & rencana build (Gunet).
- `mockups/template-a.html` — mockup Template A (terang, minimal) — TIDAK dipakai.
- `mockups/template-b.html` — mockup Template B (padat-operasional, kontras tinggi) — **DIPILIH Rama 14 Okt 2026; acuan visual build.**
