# Checklist Keamanan Ventra Simple

**Penulis:** Cipher (Cyber Security, Virtual Office) — 14 Okt 2026, ~21:30 WIB
**Scope:** Ventra Simple v2 — `docs/spec-ventra-simple.md` + `docs/arsitektur-ventra-simple.md`
**Kode yang diaudit:** `RavenYG11/ventra` @ `a7563b8` (komponen yang dipakai ulang tanpa diubah:
`src/lib/db.ts`, `src/lib/db-worker.ts`, `src/lib/backup.ts`, `src/features/pengguna/`,
`src/pages/LoginPage.tsx`, `vite.config.ts`, `public/.htaccess`)

> Catatan jujur: implementasi ulang `service-barang` / `BarangPage` Ventra Simple
> **belum mendarat** saat review ini ditulis — bagian B & C berisi temuan desain
> dan checklist verifikasi yang wajib dijalankan saat kode baru tiba. Tidak ada
> hasil yang dikarang: semua baris bagian A diverifikasi langsung di source.

---

## A. Terverifikasi AMAN (kode dipakai ulang, sudah dibuktikan di source)

| # | Cek | Hasil | Bukti |
|---|---|---|---|
| A1 | XSS via input nama barang | ✅ AMAN | Tidak ada `dangerouslySetInnerHTML` / `innerHTML` / `document.write` di seluruh `src/`. Nama barang dirender sebagai teks JSX (`{b.nama}`, `{k.nama}`, `{k.kode}`) → React melakukan escaping otomatis. Berlaku juga untuk toast, pesan galat, judul modal, dan atribut `title={...}`. |
| A2 | `eval` / code injection | ✅ AMAN | Tidak ada `eval(`, `new Function(`, atau `setTimeout`/`setInterval` string di `src/`. |
| A3 | SQL injection | ✅ AMAN | Semua query memakai parameter `$1, $2…` yang di-bind posisional (`?1, ?2`) di worker (`db-worker.ts` → `normalisasiParam` + `bind: params`). Dua query template-literal hanya menyisipkan string internal tetap (`WHERE aktif = 1` / `''`), bukan input user. |
| A4 | Kebocoran data / exfiltrasi | ✅ AMAN — semua lokal | Tidak ada `fetch`, `XHR`, `WebSocket`, `EventSource`, atau `sendBeacon` di kode aplikasi. `index.html` tanpa script CDN. Satu-satunya URL eksternal di kode adalah komentar dokumentasi. DB di OPFS browser (per-origin, lokal); backup hanya unduh file `.db` lokal (`backup.ts`). |
| A5 | Penyimpanan password | ✅ AMAN | Password hanya tersimpan sebagai hash **bcrypt cost 10** (`service-login.ts`). Tidak ada password plaintext di DB, localStorage, atau kode. Tidak ada seed akun default; tidak ada secret hardcoded; tidak ada `console.*` yang membocorkan data. |
| A6 | Sesi login | ✅ AMAN | `localStorage` hanya menyimpan **username** (`ventra_sesi`), bukan password/hash. Pesan login gagal generik (anti-enumerasi akun). |
| A7 | Header isolasi | ✅ ADA | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` di `vite.config.ts` (dev) dan `public/.htaccess` (XAMPP) — wajib untuk worker SQLite, sekaligus mengeraskan isolasi origin. |
| A8 | Dependensi berbahaya | ✅ SELESAI via desain | `xlsx@0.18.5` (2 advisory HIGH: GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS — tidak ada patch di npm) **dihapus** dari `package.json` oleh arsitektur §1.1, bersama `jspdf`, `jsbarcode`, `@zxing/browser`. Saat ini belum diimpor di mana pun. |

---

## B. Temuan (butuh aksi sebelum/saat implementasi)

| # | Temuan | Dampak | Aksi |
|---|---|---|---|
| B1 | **Tabel `audit_keamanan` belum diputuskan di DB baru.** `service-login.ts:56,96` memanggil `catatAuditKeamanan(...)` **tanpa try/catch** — bila skema `/ventra-simple.db` tidak menyertakan tabel `audit_keamanan`, **setiap login & reset password melempar error → login rusak total** (availability). Arsitektur §3 menunda keputusan 001/002 ("kemungkinan tidak dipakai"). | SEDANG — potensi login down | Pilih salah satu, eksplisit di commit: (a) sertakan `CREATE TABLE audit_keamanan` di skema baru, ATAU (b) bungkus pemanggilan audit dengan try/catch agar kegagalan audit tidak memblokir login. |
| B2 | **Inkonsistensi UNIQUE nama (case-insensitive).** Spec §2 & QA plan (NF-05/NF-07) mewajibkan `UNIQUE COLLATE NOCASE`, tetapi skema di arsitektur §3 hanya `UNIQUE`. Tanpa NOCASE, "Kabel" dan "kabel" jadi dua baris → identitas barang (nama = satu-satunya identitas, spec §2 keputusan #1) bisa salah sasaran. | RENDAH | Samakan ke `nama TEXT NOT NULL UNIQUE COLLATE NOCASE` + tetap cek duplikat di service untuk pesan ramah (R6). |

---

## C. Checklist verifikasi kode BARU (Gunet → Testarossa, saat implementasi mendarat)

- [ ] `BarangPage` baru: nama barang & hasil search dirender sebagai **teks JSX** (tidak ada `dangerouslySetInnerHTML`/`innerHTML` baru) — uji dengan nama `<img src=x onerror=alert(1)>`, harus tampil sebagai teks polos.
- [ ] Tidak ada `eval` / `new Function` / `fetch` / XHR baru di kode Ventra Simple — `grep` harus kosong (kecuali pola worker yang sudah ada).
- [ ] Validasi angka di **service** (bukan cuma UI): stok/harga integer ≥ 0; qty BELI/JUAL integer > 0; harga pecahan ditolak konsisten dengan kolom `INTEGER`.
- [ ] Pola anti-stok-negatif R5 dipakai: `UPDATE barang SET stok = stok - ? WHERE id = ? AND stok >= ?` + verifikasi ulang via `SELECT` (bukan mengandalkan return `execute`).
- [ ] `CHECK (stok >= 0)` & `CHECK (harga >= 0)` aktif di skema DB baru (lapis kedua).
- [ ] Dialog hapus selalu konfirmasi dulu; hard delete sesuai spec.
- [ ] B1 & B2 di atas sudah diputuskan & terverifikasi (login tetap jalan di DB fresh; duplikat case-insensitive ditolak di level DB).
- [ ] `npm run build` hijau; tidak ada import sisa ke modul yang dihapus (`produk-manajemen`, `kategori`, `kode-barang`, `xlsx`, `jspdf`, `jsbarcode`, `zxing`).

---

## D. Risiko yang diterima (keputusan Rama, dicatat)

1. **Reset password tanpa verifikasi identitas** (username-check → set password baru langsung). Risiko diterima Rama 14 Okt 2026; didokumentasikan di kode. Tinjau ulang bila aplikasi kelak multi-user.
2. **Tanpa Content-Security-Policy header.** Prioritas rendah untuk aplikasi offline single-user karena rendering sudah ter-escaping (A1); opsional sebagai hardening nanti.
3. **Field `keterangan` textarea tanpa batas panjang** (versi lama; Ventra Simple bahkan menghapus kolom ini) — negligible untuk pemakaian lokal.

---

*File ini ditulis lokal dan **BELUM di-push** (sesuai instruksi assignment). Siap digabung push bersama implementasi Ventra Simple.*
