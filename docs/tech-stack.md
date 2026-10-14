# Tech Stack — Ventra (Aplikasi Stok Barang)

**Rekomendasi final — dikunci di Meeting #2 (14 Okt 2026):**
**Tauri 2 + TypeScript + React (Vite) + SQLite.**
Aplikasi desktop Windows yang 100% offline, data lokal di laptop Rama, installer ±5–15 MB, tanpa server, tanpa cloud, tanpa biaya infra.

Keputusan ini hasil konvergensi tiga lensa: Gunet (kemudahan dibangun & dirawat), Epthal (nol infra, instal & backup gampang), Magna (evaluasi jujur tiap alternatif, bedakan fakta/asumsi). Moderator (Muse) mengunci satu pilihan per poin — tidak ada yang masih terbuka. Semua keputusan terkunci Rama (satu akun + login, satuan pcs, tanpa multi-gudang, offline lokal, barcode per item display-only + scan via kamera laptop, tolak stok negatif, harga beli/jual manual, laporan Excel & PDF, indikator stok menipis) dijadikan syarat mutlak.

**Jawaban final Rama (14 Okt 2026) — pembaruan:** (1) barcode **display-only di UI** — seluruh alur cetak/print barcode **dihapus**; (2) scan **hanya via kamera laptop** — opsi USB keyboard-wedge **dihapus**; (3) backup **hanya lokal otomatis saat aplikasi ditutup** dengan retensi **7 hari** — opsi flashdisk/cloud **dihapus**; (4) target **Windows 10/11 64-bit** terkonfirmasi; (5) asumsi volume **<10.000 SKU** terkonfirmasi.

---

## 1. Bahasa & framework aplikasi: TypeScript + React (dibangun dengan Vite)

- **Satu bahasa untuk ±95% kode** — tampilan, logika bisnis, dan akses database semuanya TypeScript. Paling mudah dirawat, termasuk oleh developer junior (lensa Gunet).
- **React dipilih karena ekosistem npm terbesar** → paling mudah mencari developer pengganti dan library siap pakai; selaras dengan alur tim (Prapto membuat spek desain → prototipe web yang bisa diklik → dipindah jadi komponen React).
- **TypeScript menekan bug jangka panjang** (tipe data jelas untuk Barang, TransaksiStok, dsb.) — penting untuk aplikasi yang angkanya harus dipercaya.

**Konsekuensi:** Node.js + Rust toolchain hanya dibutuhkan di mesin development (milik tim), bukan di laptop Rama. Hasil build tetap kecil karena Tauri.

**Yang ditolak & kenapa (jujur):**
- *Svelte/Vue*: sama-sama bisa membangun CRUD, tapi ekosistem React jauh lebih besar → lebih aman untuk maintenance bertahun-tahun.
- *Python + Qt/Tkinter*: membangun UI modern jauh lebih lambat dan tidak nyambung dengan prototipe web Prapto.
- *C#/WPF*: mengunci ke Windows + skill yang lebih jarang; tidak ada keuntungan untuk aplikasi CRUD sederhana.

## 2. Database lokal: SQLite — SATU-SATUNYA pilihan

- **Satu file** (`stok.db`), tanpa instal database server, tanpa konfigurasi, tanpa service yang harus jalan (lensa Epthal: nol infra = nol yang bisa rusak). Diakses dari TypeScript via plugin resmi Tauri **`@tauri-apps/plugin-sql`**.
- **ACID + transaksi**: aturan "stok tidak boleh negatif" ditegakkan di level database via `CHECK (stok >= 0)` dan transaksi atomik (stok masuk/keluar + audit trail ditulis dalam satu transaksi) — bukan cuma validasi di UI yang bisa dibobol.
- **Mode WAL** (`PRAGMA journal_mode=WAL`) untuk ketahanan terhadap mati lampu / force-close.
- Skala: SQLite sanggup sampai jutaan baris — untuk asumsi volume Rama (<10.000 SKU) ini sangat longgar.
- **Backup = copy satu file.** Tidak ada dump/restore rumit.

**Yang ditolak:** file JSON/CSV (mudah corrupt saat crash, tanpa transaksi — berbahaya untuk data stok), database server apa pun (MySQL/PostgreSQL butuh instal & service → overkill dan melanggar nol infra).

## 3. Pendekatan aplikasi desktop offline: Tauri 2

**Cara kerja:** jendela aplikasi native + webview bawaan sistem operasi untuk menampilkan UI web. Tidak ada Chromium yang dibundel, tidak ada proses web server lokal yang harus dikelola user.

**Kenapa pas untuk kasus ini:**
- Installer kecil (±5–15 MB vs Electron 80–200 MB) → unduh & instal cepat di laptop biasa (lensa Epthal).
- Ringan di RAM (puluhan MB vs ratusan MB) dan startup <1 detik.
- Memakai WebView2 bawaan Windows 10/11 → tanpa runtime tambahan di laptop Rama.
- Offline by design: tidak ada kode jaringan sama sekali. Update berikutnya via updater bawaan Tauri dari dalam aplikasi.

**Tradeoff jujur (tidak disembunyikan):**
1. Di Windows butuh **WebView2** — sudah bawaan Windows 11 dan sebagian besar Windows 10 modern; bila laptop Rama memakai Windows lama, installer menyertakan bootstrapper WebView2 (perlu dicek saat spike).
2. Toolchain **Rust hanya dibutuhkan di laptop dev** saat build; laptop Rama tidak butuh apa-apa selain installer.
3. Komunitas lebih kecil dari Electron — tapi untuk aplikasi CRUD, dokumentasi dan plugin resmi yang ada sudah lebih dari cukup.

**Yang ditolak:**
- *Electron*: installer 80–200 MB, rakus RAM — overkill untuk aplikasi CRUD di laptop biasa.
- *Web server lokal + browser*: bukan aplikasi beneran — user harus menyalakan server, tab bisa tertutup tidak sengaja, risiko konflik port.

## 4. Library konkret (semua offline-friendly)

| Kebutuhan | Pilihan (nama paket npm persis) | Catatan |
|---|---|---|
| Generate barcode Code128 per item | **jsbarcode** | Pure-JS, tanpa dependensi, lisensi MIT (terverifikasi v3.12.3, Jan 2026). **Display-only di UI** — output SVG dirender di halaman Master Barang / Detail Barang. **Tidak ada alur cetak/print label.** Isi barcode = SKU/kode barang. |
| Scan via kamera laptop | **@zxing/browser** | Pure-JS/WASM, jalan offline, minta izin kamera sekali. **Jalur utama & SATU-SATUNYA** (jawaban final Rama — opsi USB scanner keyboard-wedge dihapus). |
| Export Excel | **xlsx (SheetJS Community)** | Pure-JS, tulis file `.xlsx` asli, dibundel via npm (bukan CDN) agar offline penuh. Alur: `XLSX.utils.json_to_sheet(data)` → `XLSX.writeFile(wb, 'laporan.xlsx')`. Kunci versi & verifikasi lisensi Apache-2.0 sebelum build (cocok untuk pemakaian internal). |
| Export PDF | **jspdf + jspdf-autotable** | Laporan = tabel otomatis rapi (kop, header, nomor halaman) via autotable. |
| Hash password | **bcryptjs** | Pure-JS, offline. Password & kode pemulihan tidak pernah disimpan plain-text (kebijakan Cipher). |

**Detail implementasi barcode (dari Magna):** ukuran modul minimum + quiet zone agar barcode tetap mudah dipindai walau hanya tampil di layar. Barcode ditampilkan di halaman Master Barang / Detail Barang (display-only, tanpa cetak).

**Detail scan kamera (jawaban final Rama — scan hanya via kamera laptop):** `@zxing/browser` mendekode barcode Code128 dari frame kamera secara offline (WASM). Pastikan pratinjau kamera cukup jelas dengan pencahayaan ruangan yang wajar; aplikasi melakukan lookup SKU otomatis setelah decode berhasil dan mengisi form.

## 5. Build & packaging — cara instal di laptop Rama

**Di laptop dev (tim), sekali saja:**
1. Instal Rust (`rustup`) dan Node.js LTS.
2. Buat proyek (`npm create tauri-app`), lalu `npm install` — termasuk `jsbarcode`, `xlsx`, `jspdf`, `jspdf-autotable`, `@zxing/browser`, `bcryptjs`, `@tauri-apps/plugin-sql`.
3. Kembangkan fitur; `npm run tauri dev` untuk coba jalan.
4. `npm run tauri build` → menghasilkan **`Ventra-setup.exe`** (installer NSIS) di `src-tauri/target/release/bundle/`.

**Di laptop Rama:**
1. Klik dua kali `Ventra-setup.exe` → Next → Finish (±1 menit).
2. Ikon "Ventra" muncul di desktop & Start Menu → buka aplikasi.
3. **Setup pertama:** buat username + password → aplikasi menampilkan **kode pemulihan** satu kali → Rama catat/cetak dan simpan di tempat aman.
4. Login tiap membuka aplikasi (satu akun, tanpa peran — sesuai keputusan terkunci).

**Lokasi data (Windows):** `%APPDATA%\Ventra\stok.db` (+ folder `backup\` di sebelahnya).
**Update aplikasi:** via updater bawaan Tauri dari dalam aplikasi; alternatif manual = jalankan installer versi baru (timpa, data tidak hilang).
**Sejak awal:** siapkan skrip build satu perintah (mis. `npm run build:all`) + dokumentasi operasional singkat agar operasional harian tidak bergantung pada developer (usulan Epthal).

## 6. Backup data lokal

- **Otomatis saat aplikasi ditutup (satu-satunya mekanisme backup):** tiap aplikasi ditutup, salin `stok.db` ke subfolder `backup\` dengan nama bertimestamp; simpan **7 hari terakhir** (yang lama dihapus otomatis).
- **Tidak ada backup manual ke flashdisk, tidak ada cloud, tidak ada pengingat backup eksternal** — dihapus sesuai jawaban final Rama.
- **Restore:** menu "Restore" → pilih file `.db` backup → buka ulang aplikasi. Wajib **uji restore sebelum go-live** (usulan Epthal).
- **Risiko jujur (konsekuensi keputusan):** karena backup hanya lokal di laptop yang sama, **laptop rusak/hilang = data hilang total**. Ini keputusan sadar Rama; mitigasinya saat ini hanya menjaga kondisi fisik laptop (tidak ada salinan di luar laptop).

## 7. Struktur modul aplikasi

**Struktur folder (feature-based, selaras Tauri + plugin SQL):**
```
src/
  pages/            # Dashboard, MasterBarang, StokMasuk, StokKeluar, Riwayat, Laporan, Pengaturan
  features/
    barang/         # komponen + logika khusus master barang / SKU / barcode
  components/       # dipakai ulang: tombol, tabel, modal, ScanInput, BarcodeDisplay
  lib/
    db.ts           # SATU-SATUNYA tempat query SQLite (via @tauri-apps/plugin-sql)
    barcode.ts      # pembungkus JsBarcode
    excel.ts        # pembungkus SheetJS xlsx
    pdf.ts          # pembungkus jsPDF + autotable
    backup.ts       # backup & restore file .db
  hooks/            # hooks React dipakai ulang
  types/            # tipe data TypeScript bersama (Barang, TransaksiStok, ...)
src-tauri/          # konfigurasi Tauri + kode Rust MINIMAL (dialog file native, updater, info versi)
```

**Aturan main (dari Gunet, mengikat):**
- Satu fitur = satu page + komponennya; satu file maksimal ±300 baris.
- **Tidak ada query database di dalam komponen tampilan** — semua lewat `lib/db.ts`.
- Hampir semua logika di TypeScript (±95% kode); Rust hanya untuk yang tidak bisa dilakukan web.
- Transaksi stok (update stok + tulis audit trail) selalu dalam **satu transaksi atomik** di `db.ts`.

**Modul fitur (isi aplikasi):** Auth (login wajib; lupa password via kode pemulihan, tanpa menanyakan password lama) → Dashboard (total SKU, total nilai stok, indikator visual stok menipis) → Master Barang (CRUD: nama, kode/SKU, harga beli, harga jual, stok awal, stok minimum; **margin Rp/% dan nilai stok auto-calculate**) → Barcode (generate Code128 per item, **tampil di UI saja — display-only, tanpa cetak label**) → Transaksi Stok (masuk/keluar; **keluar melebihi stok langsung ditolak** di aplikasi + constraint database) → Laporan (stok & mutasi per periode; export Excel & PDF) → Pengaturan & Backup.

## 8. Skema data inti (ringkas — detail penuh di `specs/model-data.md`)

- `pengguna` — satu baris: username (unik), password_hash, recovery_key_hash. Tanpa peran.
- `barang` — kode/SKU **unik** (case-insensitive), barcode unik per item, nama, harga_beli, harga_jual, stok, stok_min, satuan terkunci `pcs`. `CHECK (stok >= 0)`.
- `transaksi_stok` — item, tipe (`masuk`/`keluar`/`penyesuaian`), qty, stok_sebelum, stok_sesudah, catatan, waktu. Ditulis **satu transaksi** bersama update stok.
- `pengaturan` — key/value (batas default stok menipis, nama toko untuk kop laporan, dll).

**Definisi terkunci:** margin_rp = harga_jual − harga_beli; margin_% = margin_rp ÷ harga_beli × 100; nilai_stok = stok × harga_beli (nilai modal). Stok menipis = stok ≤ stok_min.

## 9. Status pertanyaan untuk Rama (per 14 Okt 2026)

1. **OS laptop** — ✅ **TERKONFIRMASI: Windows 10/11 64-bit** (jawaban final Rama). Installer `.exe` (NSIS).
2. **Printer** — ❌ **DIHAPUS.** Tidak ada lagi alur cetak/print barcode (jawaban final Rama). Seluruh sub-poin printer label thermal vs printer biasa tidak berlaku.
3. **USB barcode scanner** — ❌ **DIHAPUS.** Scan hanya via kamera laptop (jawaban final Rama).
4. **Multi-user/multi-cabang di masa depan?** — Dijawab sebagai catatan arsitektur di Bagian 10 (bukan keputusan bangun-sekarang).
5. **Perkiraan jumlah barang** — ✅ **TERKONFIRMASI: <10.000 SKU** (jawaban final Rama). SQLite aman sampai jutaan baris.
6. **Lokasi backup eksternal** — ❌ **DIHAPUS.** Backup hanya lokal otomatis saat aplikasi ditutup, retensi 7 hari (jawaban final Rama).
7. **Mekanisme lupa password** — ⏳ **masih perlu konfirmasi Rama.** Disarankan **kode pemulihan** (ditampilkan sekali saat setup, disimpan Rama). Alternatif: pertanyaan keamanan.

## 10. Asumsi, batasan & langkah berikut

- Satu user, satu laptop, satu lokasi — tanpa sinkronisasi antar perangkat (sengaja, sesuai permintaan offline).
- Tanpa integrasi ke sistem lain (internal saja).
- **Asumsi terkonfirmasi Rama (14 Okt 2026):** volume **<10.000 SKU** (SQLite sangat longgar sampai jutaan baris); target **Windows 10/11 64-bit**.
- **Catatan arsitektur untuk multi-user/multi-cabang di masa depan (tanpa over-engineering sekarang):** semua akses database dipusatkan di `lib/db.ts` dan transaksi stok selalu atomik — lapisan ini dirancang agar pemanggilnya bisa diganti (SQLite lokal hari ini, API server esok) tanpa menyentuh komponen UI. Tidak ada kode sinkronisasi/resolusi konflik yang dibangun sekarang. Bila kebutuhan multi-cabang muncul, migrasi realistisnya adalah memperkenalkan server ringan (mis. SQLite tetap di server + REST) dan mengganti `lib/db.ts` dengan client HTTP — perubahan terkonsentrasi di satu lapisan.
- **S1.** Konfirmasi Q7 (mekanisme lupa password) ke Rama (relay proaktif di chat — jangan menunggu Rama membuka War Room).
- **S2.** **Spike 1–2 hari sebelum full build** (usulan Magna): prototipe Tauri + SQLite (tambah barang, simulasi scan via kamera, ekspor Excel/PDF) lalu **uji langsung di laptop Rama** → go/no-go final untuk stack ini. Termasuk verifikasi lisensi paket `xlsx` dan cek WebView2 di laptop Rama.
- **S3.** Skrip build satu perintah + dokumentasi operasional singkat (cara instal, backup/restore, update).

---

**Sumber verifikasi (Okt 2026):** dokumentasi resmi Tauri (tauri.app) — installer kecil, WebView2, updater bawaan; sqlite.org — serverless, ACID, domain publik; JsBarcode v3.12.3 MIT (github.com/lindell/JsBarcode); SheetJS `xlsx` Apache-2.0; jsPDF + jspdf-autotable MIT; `@tauri-apps/plugin-sql` v2.5.0. Angka ukuran bundle Tauri vs Electron terverifikasi dari benchmark independen 2026 (Tauri ±3–15 MB vs Electron 80–200+ MB). Item bertanda "asumsi / butuh konfirmasi Rama" belum terverifikasi.
