# Checklist QA — Ventra v0.1-web (Acceptance Test)

**Untuk:** Rama — dijalankan di laptop sendiri (Windows + Chrome terbaru, **BUKAN** mode incognito/private).
**Tujuan:** memastikan fondasi v0.1-web (login, kategori, barang, database lokal, backup) berjalan benar sebelum lanjut ke v0.2.
**Cara pakai:** kerjakan berurutan. Centang `[x]` bila hasil sesuai harapan. Bila GAGAL, catat nomor item + pesan error persis yang muncul.

## Persiapan

- [ ] `git pull` (pastikan kode terbaru) → `npm install` → `npm run dev`
- [ ] Buka **SATU tab saja**: http://localhost:5173 — tutup semua tab Ventra/localhost lain!
- [ ] Pastikan bukan mode incognito/private

## A. Akun & Login

### 1. Setup akun pertama
Langkah:
1. Buka aplikasi — harus muncul form "Buat Akun" (setup awal).
2. Isi nama pengguna `toko`, kata sandi `rahasia123`, konfirmasi sama → Buat Akun.

Harapan: akun dibuat, pindah ke halaman login + ada pesan sukses. [ ]

### 2. Validasi setup ditolak dengan jelas
Langkah: ulangi setup dengan nama `ab` (terlalu pendek) dan sandi `123` (terlalu pendek).

Harapan: DITOLAK dengan pesan validasi yang jelas; akun tidak dibuat. [ ]

### 3. Login berhasil
Langkah: login dengan `toko` / `rahasia123`.

Harapan: masuk ke halaman Daftar Barang. [ ]

### 4. Login gagal tidak membocorkan akun
Langkah: keluar, lalu login dengan kata sandi yang salah.

Harapan: DITOLAK dengan pesan generik ("Nama pengguna atau kata sandi salah") — tidak ketahuan username mana yang terdaftar. [ ]

## B. Kategori

### 5. Tambah kategori valid
Langkah: buka Kelola Kategori → tambah nama `Elektronik`, prefix `ELK`.

Harapan: kategori tersimpan dan muncul di daftar. [ ]

### 6. Validasi prefix kategori
Langkah: coba tambah kategori dengan prefix huruf kecil (`elk`), prefix yang sudah dipakai (`BRG-`), dan prefix berisi spasi.

Harapan: semuanya DITOLAK dengan pesan jelas; data tidak berubah. [ ]

## C. Barang

### 7. Tambah barang → kode otomatis
Langkah: tambah barang — nama `Kabel USB`, kategori `Umum`, harga beli `15000`, harga jual `20000`, stok awal `10`, stok minimum `2`.

Harapan: tersimpan dengan kode `BRG-0000001`; barcode tampil di UI. [ ]

### 8. Kode naik berurutan
Langkah: tambah satu barang lagi di kategori `Umum`.

Harapan: kode `BRG-0000002` — berurutan, tidak lompat, tidak duplikat. [ ]

### 9. Pencarian instan
Langkah: ketik nama atau kode barang di kolom pencarian.

Harapan: daftar tersaring seketika sesuai kata kunci. [ ]

## D. Persistensi & Backup

### 10. Reload — data tidak hilang
Langkah: tekan F5 / reload halaman, lalu login lagi bila diminta.

Harapan: SEMUA data barang & kategori masih ada (tersimpan persisten di browser). [ ]

### 11. Unduh backup
Langkah: tekan tombol "Unduh Backup".

Harapan: file `ventra-backup-YYYYMMDD-HHMMSS.db` terunduh ke folder Download dan ukurannya > 0 KB. [ ]

## E. Scan & Lupa Password

### 12. Scan kamera meminta izin
Langkah: buka fitur scan barcode.

Harapan: browser meminta izin kamera; setelah diizinkan, kamera aktif dan siap memindai. [ ]

### 13. Lupa password — username tidak terdaftar
Langkah: halaman login → Lupa password → masukkan username asal, mis. `ngawur123`.

Harapan: pesan GENERIK ("Periksa kembali nama pengguna Anda") — tidak membocorkan akun mana yang ada. [ ]

### 14. Lupa password — reset berhasil
Langkah: masukkan username `toko` → atur kata sandi baru `baru1234` → konfirmasi → login dengan kata sandi baru.

Harapan: kata sandi terganti; bisa login dengan yang baru; kata sandi lama ditolak. [ ]

## F. Kasus error (penting!)

### 15. Dua tab → pesan jelas, bukan stuck
Langkah: dengan tab pertama tetap terbuka, buka Ventra di TAB KEDUA.

Harapan: tab kedua MENAMPILKAN pesan error yang jelas ("database sedang dibuka di tab lain") + tombol Muat Ulang — TIDAK stuck di "Memuat…" selamanya. [ ]

### 16. Satu tab → kembali normal
Langkah: tutup SEMUA tab Ventra → buka SATU tab fresh ke http://localhost:5173.

Harapan: aplikasi berjalan normal kembali. [ ]

## G. Build produksi (XAMPP)

### 17. Build + serve via XAMPP
Langkah:
1. `npm run build` (harus selesai tanpa error)
2. Copy SELURUH isi folder `dist/` ke `C:\xampp\htdocs\ventra`
3. Start Apache di XAMPP Control Panel
4. Buka http://localhost/ventra

Harapan: aplikasi berjalan penuh dari XAMPP — bisa setup/login, tambah data, reload tetap persist. [ ]

---

**Catatan penting:** aplikasi web ini hanya boleh dibuka **SATU TAB** dalam satu waktu (keterbatasan teknis database browser/OPFS — dua tab = tab kedua ditolak dengan pesan). Untuk pemakaian harian cukup satu tab.
