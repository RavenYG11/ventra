# Tech Stack — Ventra (Aplikasi Stok Barang)

**Rekomendasi final — dikunci di Meeting #2 (14 Okt 2026), direvisi via PIVOT WEB
(14 Okt 2026, keputusan Rama):**
**TypeScript + React (Vite) + SQLite via WebAssembly — aplikasi WEB MURNI, 100% offline.**
Data lokal di browser (OPFS), tanpa server, tanpa cloud, tanpa biaya infra, tanpa install.

Keputusan ini hasil konvergensi tiga lensa: Gunet (kemudahan dibangun & dirawat), Epthal (nol infra, instal & backup gampang), Magna (evaluasi jujur tiap alternatif, bedakan fakta/asumsi). Moderator (Muse) mengunci satu pilihan per poin — tidak ada yang masih terbuka. Semua keputusan terkunci Rama (satu akun + login, satuan pcs, tanpa multi-gudang, offline lokal, barcode per item display-only + scan via kamera laptop, tolak stok negatif, harga beli/jual manual, laporan Excel & PDF, indikator stok menipis) dijadikan syarat mutlak.

**Jawaban final Rama (14 Okt 2026) — pembaruan:** (1) barcode **display-only di UI** — seluruh alur cetak/print barcode **dihapus**; (2) scan **hanya via kamera laptop** — opsi USB keyboard-wedge **dihapus**; (3) backup **manual via tombol "Unduh Backup"** (file `.db`) — mekanisme "otomatis saat aplikasi ditutup" **dihapus** karena browser memblokir download saat tab ditutup; tanpa flashdisk/cloud; (4) target **Windows 10/11 64-bit + browser modern (Chrome/Edge)** terkonfirmasi; (5) asumsi volume **<10.000 SKU** terkonfirmasi; (6) **PIVOT: Tauri/desktop DIBATALKAN** — Rama menolak install Rust; aplikasi menjadi web murni yang diserve XAMPP (`http://localhost/ventra`).

---

## 1. Bahasa & framework aplikasi: TypeScript + React (dibangun dengan Vite)

- **Satu bahasa untuk ±95% kode** — tampilan, logika bisnis, dan akses database semuanya TypeScript. Paling mudah dirawat, termasuk oleh developer junior (lensa Gunet).
- **React dipilih karena ekosistem npm terbesar** → paling mudah mencari developer pengganti dan library siap pakai; selaras dengan alur tim (Prapto membuat spek desain → prototipe web yang bisa diklik → dipindah jadi komponen React).
- **TypeScript menekan bug jangka panjang** (tipe data jelas untuk Barang, TransaksiStok, dsb.) — penting untuk aplikasi yang angkanya harus dipercaya.

**Konsekuensi (edisi web):** yang dibutuhkan hanya **Node.js di mesin build** (milik tim) untuk `npm run build`. Di laptop Rama tidak perlu install apa pun selain XAMPP + browser — tidak ada Rust, tidak ada toolchain, tidak ada `.exe`.

**Yang ditolak & kenapa (jujur):**
- *Svelte/Vue*: sama-sama bisa membangun CRUD, tapi ekosistem React jauh lebih besar → lebih aman untuk maintenance bertahun-tahun.
- *Python + Qt/Tkinter*: membangun UI modern jauh lebih lambat dan tidak nyambung dengan prototipe web Prapto.
- *C#/WPF*: mengunci ke Windows + skill yang lebih jarang; tidak ada keuntungan untuk aplikasi CRUD sederhana.
- *Tauri 2 (desktop)*: **DIBATALKAN via pivot 14 Okt 2026** — butuh Rust toolchain yang Rama tolak install. Semua keuntungan Tauri (installer kecil, offline) tercapai juga oleh web statis + XAMPP tanpa toolchain tambahan.

## 2. Database lokal: SQLite via WebAssembly — SATU-SATUNYA pilihan

- **SQLite dikompilasi ke WebAssembly** (paket resmi **`@sqlite.org/sqlite-wasm`**, v3.53.4) berjalan penuh di browser — SQL yang sama persis dengan SQLite desktop, termasuk `CHECK`, `RETURNING`, CTE, dan view. Skema database **tidak berubah** dari edisi Tauri.
- **Persistensi di OPFS** (Origin-Private FileSystem) via VFS resmi **`opfs-sahpool`**: database (`stok.db`) tersimpan permanen di penyimpanan privat browser untuk origin `http://localhost` — tetap ada setelah browser ditutup/dibuka ulang, tetap 100% lokal (tidak ada data keluar dari laptop).
- **Diakses dari TypeScript via satu lapisan tipis** (`src/lib/db.ts` — SATU-SATUNYA tempat query di aplikasi) yang membungkus API `oo1` sqlite-wasm. Pola pemakaian repo/service tidak berubah.
- **ACID + transaksi**: aturan "stok tidak boleh negatif" ditegakkan di level database via `CHECK (stok >= 0)` dan transaksi atomik — bukan cuma validasi di UI yang bisa dibobol.
- Skala: SQLite sanggup sampai jutaan baris — untuk asumsi volume Rama (<10.000 SKU) ini sangat longgar.
- **Backup = unduh satu file.** Tombol "Unduh Backup" mengekspor database utuh sebagai file `.db` (via `poolUtil.exportFile()` resmi) ke folder Download.

**Batasan jujur (tidak disembunyikan):**
1. **Satu file database = satu koneksi aktif.** Jangan buka Ventra di dua tab/browser bersamaan — tab kedua akan mendapat pesan galat yang jelas (bukan data corrupt).
2. Data "tinggal" di browser, bukan file yang terlihat di Windows Explorer — untuk salinan cadangan gunakan tombol "Unduh Backup" (bukan copy file manual).
3. Mode private/incognito browser dapat membatasi/mematikan persistensi OPFS — pakai mode normal.

**Yang ditolak:** file JSON/CSV (mudah corrupt saat crash, tanpa transaksi — berbahaya untuk data stok), database server apa pun (MySQL/PostgreSQL butuh instal & service → overkill dan melanggar nol infra), IndexedDB mentah/kv (tanpa SQL relasional, audit trail & constraint jauh lebih sulit).

## 3. Pendekatan aplikasi web offline: file statis + XAMPP

**Cara kerja:** `npm run build` menghasilkan file web statis (HTML/CSS/JS/WASM) di `dist/`. Folder `dist/` disalin ke `C:\xampp\htdocs\ventra`, Apache XAMPP diserve, aplikasi dibuka di `http://localhost/ventra`. Tidak ada proses server aplikasi, tidak ada database server — Apache hanya menyajikan file statis.

**Kenapa pas untuk kasus ini:**
- **Nol install di laptop Rama** selain XAMPP (yang umum dan ringan) — tanpa Rust, tanpa `.exe`, tanpa updater.
- Build kecil (JS + `sqlite3.wasm` ±1–3 MB) → salin cepat, jalan cepat.
- Offline by design: tidak ada kode jaringan sama sekali; `http://localhost` selalu bisa diakses tanpa internet.
- Update versi = timpa ulang isi folder `ventra` dengan hasil build baru (data di OPFS tidak ikut tertimpa — beda lokasi penyimpanan).

**Tradeoff jujur (tidak disembunyikan):**
1. Butuh **XAMPP/Apache** jalan saat memakai aplikasi — satu langkah "Start Apache" di XAMPP Control Panel (bisa di-set auto-start bila diinginkan).
2. Harus lewat `http://localhost/ventra` — tidak bisa dobel-klik `index.html` langsung (modul ES + WASM butuh HTTP; `file://` diblokir browser).
3. Data terikat pada **browser + origin** yang dipakai — ganti browser = database kosong (solusi: Unduh Backup di browser lama; restore direncanakan v0.2+).

**Yang ditolak:**
- *Tauri 2 (desktop)*: **dibatalkan** — butuh Rust toolchain (keputusan pivot Rama).
- *Electron*: installer 80–200 MB, rakus RAM — overkill untuk aplikasi CRUD di laptop biasa.
- *Hosting publik/cloud*: melanggar syarat offline & nol infra; data stok tidak boleh keluar laptop.

## 4. Library konkret (semua offline-friendly)

| Kebutuhan | Pilihan (nama paket npm persis) | Catatan |
|---|---|---|
| SQLite di browser | **@sqlite.org/sqlite-wasm** (v3.53.4, pin eksak) | Build WASM resmi dari tim SQLite; persistensi OPFS via VFS `opfs-sahpool`; tidak butuh header COOP/COEP. |
| Generate barcode Code128 per item | **jsbarcode** | Pure-JS, tanpa dependensi, lisensi MIT (terverifikasi v3.12.3, Jan 2026). **Display-only di UI** — output SVG dirender di halaman Master Barang / Detail Barang. **Tidak ada alur cetak/print label.** Isi barcode = SKU/kode barang. |
| Scan via kamera laptop | **@zxing/browser** | Pure-JS/WASM, jalan offline, minta izin kamera sekali. **Jalur utama & SATU-SATUNYA** (jawaban final Rama — opsi USB scanner keyboard-wedge dihapus). Jalan native di browser (butuh secure context — `http://localhost` memenuhi syarat). |
| Export Excel | **xlsx (SheetJS Community)** | Pure-JS, tulis file `.xlsx` asli, dibundel via npm (bukan CDN) agar offline penuh. Alur: `XLSX.utils.json_to_sheet(data)` → `XLSX.writeFile(wb, 'laporan.xlsx')`. Kunci versi & verifikasi lisensi Apache-2.0 sebelum build (cocok untuk pemakaian internal). |
| Export PDF | **jspdf + jspdf-autotable** | Laporan = tabel otomatis rapi (kop, header, nomor halaman) via autotable. |
| Hash password | **bcryptjs** | Pure-JS, offline, jalan native di browser. Password tidak pernah disimpan plain-text (kebijakan Cipher). |

**Detail implementasi barcode (dari Magna):** ukuran modul minimum + quiet zone agar barcode tetap mudah dipindai walau hanya tampil di layar. Barcode ditampilkan di halaman Master Barang / Detail Barang (display-only, tanpa cetak).

**Detail scan kamera (jawaban final Rama — scan hanya via kamera laptop):** `@zxing/browser` mendekode barcode Code128 dari frame kamera secara offline (WASM). Pastikan pratinjau kamera cukup jelas dengan pencahayaan ruangan yang wajar; aplikasi melakukan lookup SKU otomatis setelah decode berhasil dan mengisi form. Izin kamera diminta browser sekali (di `http://localhost` tidak butuh HTTPS).

## 5. Build & deploy — cara menjalankan di laptop Rama

**Di mesin build (tim), sekali per rilis:**
1. Instal Node.js LTS (tidak perlu Rust — sudah tidak dipakai).
2. `npm install` — termasuk `@sqlite.org/sqlite-wasm`, `jsbarcode`, `xlsx`, `jspdf`, `jspdf-autotable`, `@zxing/browser`, `bcryptjs`.
3. Kembangkan fitur; `npm run dev` untuk coba jalan di browser.
4. `npm run build` → menghasilkan **file web statis** di `dist/` (termasuk `sqlite3.wasm`).

**Di laptop Rama (setup sekali):**
1. Instal XAMPP (bila belum ada) → salin **isi** `dist/` ke `C:\xampp\htdocs\ventra\`.
2. Buka XAMPP Control Panel → **Start Apache**.
3. Buka browser → **http://localhost/ventra**.
4. **Setup pertama:** buat username + password → selesai. (Tidak ada kode pemulihan — reset password via username-check → unrestricted.)
5. Login tiap membuka aplikasi (satu akun, tanpa peran — sesuai keputusan terkunci).

**Lokasi data:** OPFS browser pada origin `http://localhost` (database `stok.db`; tidak terlihat di Explorer — kelola via aplikasi).
**Update aplikasi:** timpa ulang isi `C:\xampp\htdocs\ventra\` dengan `dist/` versi baru (data di OPFS aman, tidak tertimpa).
**Sejak awal:** siapkan skrip deploy satu perintah + dokumentasi operasional singkat agar operasional harian tidak bergantung pada developer (usulan Epthal).

## 6. Backup data lokal

- **Manual via tombol "Unduh Backup"** (toolbar layar Daftar Barang): mengunduh salinan penuh database sebagai file `ventra-backup-YYYYMMDD-HHMMSS.db` ke folder Download. Dari sana user dapat memindahkan ke flashdisk/tempat aman.
- **Kenapa tidak otomatis saat aplikasi ditutup:** browser **memblokir** download yang dipicu saat tab ditutup — mekanisme lama edisi Tauri tidak mungkin diimplementasikan di web. Ini batasan teknis browser, bukan pilihan desain.
- **Tidak ada backup ke cloud** — dihapus sesuai jawaban final Rama.
- **Restore:** direncanakan (impor file `.db` kembali ke OPFS) — belum ada di v0.1. Untuk sekarang, jaga file backup hasil unduhan baik-baik.
- **Risiko jujur (konsekuensi keputusan):** karena backup bergantung pada kedisiplinan menekan tombol, **jadwalkan kebiasaan backup** (mis. tiap akhir hari kerja). Laptop rusak/hilang tanpa salinan `.db` = data hilang total. Ini keputusan sadar Rama; mitigasinya saat ini hanya menjaga kondisi fisik laptop + file backup (tidak ada salinan otomatis di luar laptop).

## 7. Struktur modul aplikasi

**Struktur folder (feature-based, edisi web):**
```
src/
  pages/            # Dashboard, MasterBarang, StokMasuk, StokKeluar, Riwayat, Laporan, Pengaturan
  features/
    barang/         # komponen + logika khusus master barang / SKU / barcode
  components/       # dipakai ulang: tombol, tabel, modal, ScanInput, BarcodeDisplay
  lib/
    db.ts           # SATU-SATUNYA tempat query SQLite (via @sqlite.org/sqlite-wasm + OPFS)
    backup.ts       # unduh backup database (.db)
    barcode.ts      # pembungkus JsBarcode
    excel.ts        # pembungkus SheetJS xlsx
    pdf.ts          # pembungkus jsPDF + autotable
  hooks/            # hooks React dipakai ulang
  types/            # tipe data TypeScript bersama (Barang, TransaksiStok, ...)
migrasi/            # file SQL per versi (diterapkan otomatis saat aplikasi dibuka)
```

**Aturan main (dari Gunet, mengikat):**
- Satu fitur = satu page + komponennya; satu file maksimal ±300 baris (keras: ≤500).
- **Tidak ada query database di dalam komponen tampilan** — semua lewat `lib/db.ts`.
- Semua logika di TypeScript; tidak ada kode native/Rust sama sekali.
- Transaksi stok (update stok + tulis audit trail) selalu dalam **satu transaksi atomik** di `db.ts`.

**Modul fitur (isi aplikasi):** Auth (login wajib; lupa password = username → cek keberadaan akun → jika ada, reset unrestricted langsung set password baru, tanpa password lama) → Dashboard (total SKU, total nilai stok, indikator visual stok menipis) → Master Barang (CRUD: nama, kode/SKU, harga beli, harga jual, stok awal, stok minimum; **margin Rp/% dan nilai stok auto-calculate**) → Barcode (generate Code128 per item, **tampil di UI saja — display-only, tanpa cetak label**) → Transaksi Stok (masuk/keluar; **keluar melebihi stok langsung ditolak** di aplikasi + constraint database) → Laporan (stok & mutasi per periode; export Excel & PDF) → Pengaturan & Backup.

## 8. Skema data inti (ringkas — detail penuh di `model-data.md`)

- `pengguna` — satu baris: username (unik), password_hash. Tanpa peran. (Recovery key dihapus — reset = username-check → unrestricted, lihat §9.)
- `barang` — kode/SKU **unik** (case-insensitive), nama, kategori_id (FK), satuan terkunci `pcs`. `CHECK (stok >= 0)`. Barcode = kode (tidak ada kolom barcode terpisah).
- `kategori` — nama (UNIQUE), prefix_kode (UNIQUE), counter terakhir per pola; kode barang baru = pola + nomor urut 7 digit.
- `transaksi_stok` — item, tipe (`masuk`/`keluar`/`penyesuaian`), qty, stok_sebelum, stok_sesudah, catatan, waktu, dibuat_oleh. Ditulis **satu transaksi** bersama update stok.
- `audit_keamanan` — append-only: peristiwa (`login`/`password_reset`), akun, status, waktu.
- `pengaturan` — key/value (nama_toko, stok_minimum_default, peringatan_stok_menipis, dll).

**Definisi terkunci:** margin_rp = harga_jual − harga_beli; margin_% = margin_rp ÷ harga_beli × 100; nilai_stok = stok × harga_beli (nilai modal). Stok menipis = stok ≤ stok_min.

## 9. Status pertanyaan untuk Rama (per 14 Okt 2026)

1. **OS laptop** — ✅ **TERKONFIRMASI: Windows 10/11 64-bit** (jawaban final Rama). Target edisi web: **browser modern (Chrome/Edge terbaru)** di Windows tersebut, via XAMPP `http://localhost/ventra`. Tidak ada `.exe`/installer.
2. **Printer** — ❌ **DIHAPUS.** Tidak ada lagi alur cetak/print barcode (jawaban final Rama). Seluruh sub-poin printer label thermal vs printer biasa tidak berlaku.
3. **USB barcode scanner** — ❌ **DIHAPUS.** Scan hanya via kamera laptop (jawaban final Rama).
4. **Multi-user/multi-cabang di masa depan?** — Dijawab sebagai catatan arsitektur di Bagian 10 (bukan keputusan bangun-sekarang).
5. **Perkiraan jumlah barang** — ✅ **TERKONFIRMASI: <10.000 SKU** (jawaban final Rama). SQLite aman sampai jutaan baris.
6. **Backup** — ✅ **TERKUNCI (pivot 14 Okt 2026):** tombol **"Unduh Backup"** manual (file `.db` ke folder Download). Backup otomatis saat aplikasi ditutup **DIBATALKAN** (browser memblokir download saat tab ditutup). Tanpa cloud/eksternal otomatis di MVP.
7. **Mekanisme lupa password** — ✅ **TERKUNCI (14 Okt 2026):** user memasukkan username → sistem mengecek keberadaan akun → jika ada, field reset password menjadi **unrestricted** (langsung set password baru tanpa password lama). Opsi kode pemulihan & pertanyaan keamanan DIBATALKAN. Lihat `stock-barang-mvp-v1.md` §8.
8. **Tauri/desktop** — ❌ **DIBATALKAN (pivot 14 Okt 2026, keputusan Rama):** tanpa Rust, tanpa `.exe`. Diganti web murni (bagian 3 & 5).

## 10. Asumsi, batasan & langkah berikut

- Satu user, satu laptop, satu browser, satu lokasi — tanpa sinkronisasi antar perangkat (sengaja, sesuai permintaan offline).
- Tanpa integrasi ke sistem lain (internal saja).
- **Asumsi terkonfirmasi Rama (14 Okt 2026):** volume **<10.000 SKU** (SQLite sangat longgar sampai jutaan baris); target **Windows 10/11 64-bit + Chrome/Edge**.
- **Catatan arsitektur untuk multi-user/multi-cabang di masa depan (tanpa over-engineering sekarang):** semua akses database dipusatkan di `lib/db.ts` dan transaksi stok selalu atomik — lapisan ini dirancang agar pemanggilnya bisa diganti (SQLite-OPFS hari ini, API server esok) tanpa menyentuh komponen UI. Tidak ada kode sinkronisasi/resolusi konflik yang dibangun sekarang.
- **S1.** Konfirmasi Q7 (mekanisme lupa password) ke Rama (relay proaktif di chat — jangan menunggu Rama membuka War Room).
- **S2.** **Spike deploy sebelum v0.1 dinyatakan selesai** (pengganti spike Tauri): `npm install` → `npm run build` → salin `dist/` ke `C:\xampp\htdocs\ventra` → Start Apache → uji langsung di laptop Rama (`http://localhost/ventra`): setup akun, tambah barang, reload (data persist = OPFS jalan), Unduh Backup. Termasuk verifikasi lisensi paket `xlsx`.
- **S3.** Skrip deploy satu perintah + dokumentasi operasional singkat (cara instal, backup/restore, update).

---

**Sumber verifikasi (Okt 2026):** dokumentasi resmi sqlite-wasm — `sqlite.org/wasm/doc/trunk/persistence.md` (VFS `opfs-sahpool`: tanpa COOP/COEP, path absolut, `installOpfsSAHPoolVfs` → `poolUtil.OpfsSAHPoolDb`, `exportFile` untuk backup); paket npm `@sqlite.org/sqlite-wasm` v3.53.4-build2 (ESM, `exports` mencakup `./sqlite3.wasm`); demo resmi `github.com/sqlite/sqlite-wasm` (sahpool-demo, main-thread-demo); sqlite.org — serverless, ACID, domain publik; JsBarcode v3.12.3 MIT (github.com/lindell/JsBarcode); SheetJS `xlsx` Apache-2.0; jsPDF + jspdf-autotable MIT; `@zxing/browser` (jalan di secure context; `http://localhost` memenuhi syarat). Item bertanda "asumsi / butuh konfirmasi Rama" belum terverifikasi.
