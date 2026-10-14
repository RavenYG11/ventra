# Checklist QA — Ventra v0.1-web (Acceptance Test)

**Untuk:** Rama — dijalankan di laptop sendiri (Windows + Chrome terbaru, **BUKAN** mode incognito/private).
**Tujuan:** memastikan fondasi v0.1-web (login, kategori, barang, database lokal OPFS, backup) berjalan benar sebelum lanjut ke v0.2.
**Cara pakai:** kerjakan berurutan. Centang `[x]` bila hasil sesuai harapan. Bila GAGAL, catat **nomor item + teks error persis** yang muncul di layar.

> **BLOKIR YANG SUDAH DIKETAHUI (temuan QA #19, 14 Okt 2026):**
> 1. **Tambah kategori SELALU gagal** — bug di `src/features/kategori/repo-kategori.ts` (baca `lastInsertId` dari fungsi yang tidak mengembalikannya). Gejala yang akan Rama lihat: pesan *"Nama atau prefix sudah dipakai kategori lain"* padahal nama/prefix baru — dan datanya **tetap masuk** diam-diam (cek dengan reload: kategori muncul di daftar). Item 6–8 di bawah menandai ini.
> 2. **`npm run build` GAGAL** (TypeScript `strict` menolak kode di atas) — jadi Bagian H (XAMPP) **belum bisa dijalankan** sampai diperbaiki. Perbaikan sudah dijadwalkan (assignment #20 untuk Gunet).
> 3. Penyebab error *"Gagal membuka database lokal"* milik Rama **belum pasti** — Bagian A memandu cara menangkap teks penyebab aslinya.

## 0. Persiapan

- [ ] `git pull` (pastikan kode terbaru) → `npm install` → `npm run dev`
- [ ] Buka **SATU tab saja**: http://localhost:5173 — tutup semua tab Ventra/localhost lain
- [ ] Pastikan bukan mode incognito/private (ikon topi di pojok Chrome = JANGAN dipakai)
- [ ] Siapkan cara melihat Console bila diminta: tekan `F12` → tab **Console**

## A. Kasus utama: error database (laporan Rama)

### 1. Aplikasi terbuka tanpa error database
Langkah: buka http://localhost:5173 di satu tab fresh.

Harapan: muncul form "Buat Akun" (setup awal) atau form login — **tanpa** pesan "Gagal membuka database lokal". [ ]

### 2. Jika error database muncul — tangkap penyebab aslinya
Langkah: baca pesan error di layar sampai habis. Pesan kini memuat penyebab asli **di dalam kurung**, contoh: `Gagal membuka database lokal (NoModificationAllowedError: ...)`.

Harapan / yang dicatat:
- [ ] Salin **seluruh teks di dalam kurung** dan kirim ke Muse (ini kunci diagnosis).
- [ ] Buka Console (`F12` → tab Console), salin baris error berwarna merah bila ada.

### 3. Reload cepat tidak merusak database
Langkah: setelah aplikasi terbuka normal, tekan `F5` **dua kali berurutan dengan cepat**.

Harapan: aplikasi kembali normal tanpa error database (tidak ada race handle). [ ]
Catatan QA: reload yang terlalu cepat *bisa* memicu error lock sesaat — bila terjadi, catat teks errornya (lihat item 2), lalu reload sekali lagi perlahan.

## B. Akun & Login

### 4. Setup akun pertama
Langkah: isi nama pengguna `toko`, kata sandi `rahasia123`, konfirmasi sama → Buat Akun.

Harapan: akun dibuat, pindah ke halaman login + ada pesan sukses. [ ]

### 5. Validasi setup ditolak dengan jelas
Langkah: ulangi setup dengan nama `ab` (terlalu pendek) dan sandi `123` (terlalu pendek).

Harapan: DITOLAK dengan pesan validasi yang jelas; akun tidak dibuat. [ ]

### 6. Login berhasil
Langkah: login dengan `toko` / `rahasia123`.

Harapan: masuk ke halaman Daftar Barang. [ ]

### 7. Login gagal tidak membocorkan akun
Langkah: keluar (KELUAR di kanan atas), lalu login dengan kata sandi yang salah.

Harapan: DITOLAK dengan pesan generik ("Nama pengguna atau kata sandi salah"). [ ]

## C. Kategori — ⚠️ BLOKIR (bug diketahui, lihat atas)

### 8. Tambah kategori: catat perilaku bug
Langkah: buka **Kategori** → tambah nama `Elektronik`, prefix `ELK` → Tambah.

Harapan SEMENTARA (sampai bug diperbaiki):
- [ ] Muncul pesan *"Nama atau prefix sudah dipakai kategori lain"* (pesan ini **menyesatkan** — abaikan dulu).
- [ ] Tutup lalu buka lagi Kelola Kategori (atau reload halaman): kategori `Elektronik` / `ELK` **tetap muncul** di daftar — bukti datanya masuk walau pesan error.
- [ ] Catat hasil persisnya dan laporkan (jangan tambah dua kali — nanti duplikat).

### 9. Validasi prefix tetap jalan
Langkah: coba tambah kategori dengan prefix huruf kecil (`elk`) — input otomatis jadi kapital, jadi coba juga prefix berisi spasi (`EL K`).

Harapan: prefix spasi DITOLAK dengan pesan jelas; data tidak berubah. [ ]

## D. Barang

### 10. Tambah barang → kode otomatis
Langkah: **+ Tambah Barang** — nama `Kabel USB`, kategori `Umum`, harga beli `15000`, harga jual `20000`, stok awal `10`, stok minimum `2` → Simpan.

Harapan: tersimpan dengan kode `BRG-0000001`; toast "TERSIMPAN: BRG-0000001". [ ]
(Catatan: barcode visual **belum ada** di v0.1 — kode teks saja yang diverifikasi.)

### 11. Kode naik berurutan
Langkah: tambah satu barang lagi di kategori `Umum` (nama `Mouse Wireless`, stok awal `5`).

Harapan: kode `BRG-0000002` — berurutan, tidak lompat, tidak duplikat. [ ]

### 12. Validasi form barang
Langkah: coba simpan barang dengan nama kosong, lalu harga beli `-500` (ketik manual).

Harapan: keduanya DITOLAK dengan pesan jelas; tidak ada baris baru di tabel. [ ]

### 13. Pencarian instan
Langkah: ketik `kabel` lalu `BRG-0000002` di kolom pencarian.

Harapan: daftar tersaring seketika sesuai kata kunci (nama maupun kode). [ ]

### 14. Ubah & nonaktifkan barang
Langkah: ubah harga jual `Kabel USB` → simpan; lalu **Nonaktif** → konfirmasi.

Harapan: perubahan tersimpan (toast "PERUBAHAN TERSIMPAN"); barang hilang dari daftar setelah dinonaktifkan. [ ]

## E. Persistensi & Backup

### 15. Reload — data tidak hilang
Langkah: tekan `F5` / reload halaman, lalu login lagi bila diminta.

Harapan: SEMUA data barang & kategori masih ada (tersimpan persisten di browser/OPFS). [ ]

### 16. Unduh backup
Langkah: tekan tombol **Unduh Backup** di toolbar.

Harapan: file `ventra-backup-YYYYMMDD-HHMMSS.db` terunduh ke folder Download dan ukurannya > 0 KB. [ ]

## F. Lupa Password

### 17. Username tidak terdaftar — pesan generik
Langkah: halaman login → **Lupa password?** → masukkan username asal, mis. `ngawur123` → Lanjut.

Harapan: pesan GENERIK ("Periksa kembali nama pengguna Anda") — tidak membocorkan akun mana yang ada. [ ]

### 18. Reset berhasil
Langkah: masukkan username `toko` → atur kata sandi baru `baru1234` → konfirmasi → **Set Kata Sandi Baru** → login dengan kata sandi baru.

Harapan: kata sandi terganti; bisa login dengan yang baru; kata sandi lama (`rahasia123`) ditolak. [ ]

## G. Kasus error

### 19. Dua tab → pesan jelas, bukan stuck
Langkah: dengan tab pertama tetap terbuka, buka Ventra di **TAB KEDUA**.

Harapan: tab kedua MENAMPILKAN pesan error yang jelas (database sedang dibuka di tab lain) + tombol **Muat ulang** — TIDAK stuck di "Memuat…" selamanya. [ ]

### 20. Satu tab → kembali normal
Langkah: tutup SEMUA tab Ventra → buka SATU tab fresh ke http://localhost:5173.

Harapan: aplikasi berjalan normal kembali. [ ]

## H. Build produksi (XAMPP) — ⚠️ BLOKIR (bug diketahui, lihat atas)

### 21. Build + serve via XAMPP
Langkah (JALANKAN SETELAH bug blokir #2 diperbaiki):
1. `npm run build` (harus selesai tanpa error)
2. Copy SELURUH isi folder `dist/` ke `C:\xampp\htdocs\ventra`
3. Start Apache di XAMPP Control Panel
4. Buka http://localhost/ventra

Harapan: aplikasi berjalan penuh dari XAMPP — bisa setup/login, tambah data, reload tetap persist. [ ]
Catatan: database XAMPP (`localhost:80`) **terpisah** dari database dev (`localhost:5173`) — data tidak ikut pindah.

---

## I. Migrasi 003 — Fitur Kode Barang (assignment #26)

### 22. Kategori lama otomatis jadi kode barang (backfill)
Langkah: setelah `git pull`, buka aplikasi (migrasi 003 berjalan otomatis sekali).
Buka menu **Product Management** → tab **Kode Barang**.
Harapan: setiap kategori lama muncul sebagai 1 kode barang (kode = prefix lama, nama = "Kode <nama kategori>", counter = nilai lama). Tab **Mapping** menunjukkan relasi 1:1 awal. [ ]

### 23. Barang lama tetap valid + counter tidak reset
Langkah: di tab Kode Barang, catat "No. Urut Terakhir" sebuah kode. Tambah 1 barang baru memakai kode itu.
Harapan: kode baru = kelanjutan nomor lama (tidak mulai dari 1); barang lama tetap tampil dengan kolom **Kode Barang** terisi. [ ]

### 24. CRUD kode barang + validasi pola
Langkah: tambah kode `ELK-SRV-` (nama "Kode servis") → coba tambah lagi kode yang sama → coba kode `elk srv` (spasi/huruf kecil).
Harapan: tambah pertama lolos; duplikat DITOLAK ("Kode sudah dipakai"); pola salah DITOLAK dengan pesan jelas. [ ]

### 25. Mapping M:N fleksibel
Langkah: di tab Mapping, hubungkan kode `BRG-` ke 2 kategori berbeda.
Harapan: lolos (1 kode boleh dipakai banyak kategori). Coba lepas mapping aktif TERAKHIR milik suatu kategori.
Harapan: DITOLAK ("kategori wajib punya minimal 1 kode barang aktif"). [ ]

### 26. Form Tambah Barang baru
Langkah: pilih kategori yang hanya punya 1 kode barang → dropdown Kode Barang terisi otomatis + preview "Kode berikutnya" muncul. Pilih kategori tanpa kode barang.
Harapan: auto-fill + preview benar; kategori tanpa kode menampilkan peringatan kuning dan dropdown disabled. [ ]

### 27. Validasi nonaktifkan kategori berisi barang
Langkah: di tab Kategori, coba nonaktifkan kategori yang masih punya barang aktif.
Harapan: DITOLAK dengan pesan jelas. [ ]

### 28. Restore backup lama → migrasi otomatis
Langkah: restore file backup `.db` dari SEBELUM fitur ini (bila ada) → buka aplikasi.
Harapan: migrasi 003 berjalan otomatis, data utuh, menu Product Management tampil. [ ]

---

## Fitur yang BELUM ADA di v0.1 — jangan diuji dulu

- **Scan barcode via kamera** (pustaka `@zxing/browser` terdaftar tapi belum dipakai di kode) — direncanakan v0.2+
- **Tampilan barcode** di daftar barang (JsBarcode belum dipakai) — direncanakan menyusul
- **Laporan Excel/PDF** (SheetJS/jsPDF terdaftar tapi belum dipakai) — v0.3
- **Transaksi stok masuk/keluar, dashboard** — v0.2 (tombol "Transaksi" masih disabled)

## Cara melaporkan hasil

Kirim ke Muse dengan format:

```
QA v0.1-web — <tanggal>
LOLOS: 1, 3, 4, ...
GAGAL: 8 (pesan: "..."), 21 (belum bisa: ...)
CATATAN: ...
```

Sertakan **teks error persis** (copy-paste) untuk setiap item GAGAL — jangan parafrase.

---

**Catatan penting:** aplikasi web ini hanya boleh dibuka **SATU TAB** dalam satu waktu (keterbatasan teknis database browser/OPFS — tab kedua ditolak dengan pesan, bukan corrupt). Untuk pemakaian harian cukup satu tab.
