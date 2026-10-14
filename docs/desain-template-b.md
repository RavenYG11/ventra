# Handoff Desain — Ventra (Template B)
**Status:** RESMI dipilih Rama sebagai referensi desain (2026-10-14, ~16:38 WIB)
**Sumber mockup:** `specs/mockups/template-b.html` (karakter: "padat operasional, kontras tinggi — gelap")
**Ditulis oleh:** Prapto (UI/UX Designer) — untuk Gunet (implementasi React)
**Catatan:** File ini mengatur *visual & layout* supaya implementasi React tidak menebak-nebak.
Logika fungsional (aturan stok, lupa-password, kode barang, nilai stok) tetap mengikuti
`specs/stock-barang-mvp-v1.md` — jika ada bentrok, spec fungsional menang.

---

## 1. Token Desain (CSS variable → sesuaikan ke tema React)

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--bg` | `#0e1116` | Latar utama aplikasi |
| `--panel` | `#161b22` | Kartu/panel/kotak konten |
| `--panel2` | `#1c222b` | Permukaan sekunder (toggle non-aktif, stepper, dropdown) |
| `--ink` | `#f2f5f9` | Teks utama (terang, kontras tinggi) |
| `--muted` | `#9aa4b2` | Teks sekunder / hint |
| `--line` | `#2a323d` | Border elemen, garis tabel |
| `--amber` | `#ffb020` | **Aksen utama:** border atas topbar, tab aktif, judul label form, tombol utama, toast |
| `--green` | `#22c55e` / `--green-d:#15803d` | Aksi **Masuk** (tombol Catat Masuk, tombol Simpan Masuk) |
| `--red` | `#ef4444` / `--red-d:#b91c1c` | Aksi **Keluar** (tombol Catat Keluar, tombol Simpan Keluar) |
| `--blue` | `#38bdf8` | Info sekunder (kode barang mono, nilai stok total, border statistik) |

### Warna status stok (badge)
| Status | Warna | Gaya |
|---|---|---|
| `AMAN` (stok > min) | bg `#052e16`, teks `--green`, border 1px `--green-d` | statis |
| `⚠ MENIPIS` (stok ≤ min) | bg `--red`, teks putih | **berkedip** (blink 1.2s, opacity .55 di 50%) |
| Baris tabel menipis | bg `#2a1215` + border kiri 5px `--red` di sel pertama | non-badged |

### Badge lain
- Padding `5px 14px`, radius 4px, font 12px / weight 900 / letter-spacing .5px, uppercase, nowrap.

### Tipografi
- Font: `Segoe UI, system-ui, -apple-system, sans-serif` (font bawaan OS — tanpa web font, offline).
- Kode barang & barcode: **monospace** (`Consolas, monospace`, 13px, warna `--blue`).
- Judul layar: 20px, uppercase, letter-spacing .5px.
- Label form: 12px, weight 800, letter-spacing .6px, **uppercase, warna `--amber`**.
- Input: 16px, teks `--ink`, latar `#0b0e13` (lebih gelap dari bg), border 2px `--line`, radius 6px, padding 13px; saat fokus border → `--amber`.
- Angka tabel: rata kanan, `tabular-nums`, nama stok tebal 17px.

### Radius, shadow, gerakan
- Radius: 6px (tombol/input), 8px (panel).
- Shadow: **tidak ada** — kedalaman dibentuk dari border 1px `--line` + perbedaan warna panel (gaya flat-operasional).
- Gerakan: tombol `:active` scale .98; toast muncul dengan transisi .25s (slide + fade); badge menipis berkedip 1.2s.
- Semua teks tombol aksi uppercase, letter-spacing .5px.

---

## 2. Layout 3 Layar

### Layar 1 — Login
- Card terpusat `max-width: 460px`, panel bg `--panel` border `--line` radius 8px, padding 22px, margin atas ~44px.
- Urutan: logo teks **VENTRA** (34px, weight 900, letter-spacing 1px) → box karakter (bg `#231a05`, border 2px `--amber`, teks `#ffd98a`) berisi deskripsi singkat gaya B → form Nama pengguna + Kata sandi → tombol **MASUK** (amber, full width).
- Link **"Lupa password?"** di bawah tombol, gaya link kuning bergaris bawah.
- Hint bawah (12px, muted, center): info mode demo / catatan satu akun, satuan pcs, offline.

### Layar 2 — Dashboard (tab utama)
- **Topbar** (sticky, hanya tampil setelah login): bg `#000`, border bawah **3px solid `--amber`**,
  padding 10px 20px. Kiri: brand VENTRA (22px, weight 900) + sub-label kecil muted.
  Tengah: tab **Dashboard / Transaksi** (padding 12px 26px, border 2px `--line`, radius 6px,
  font 15px weight 800; tab aktif = bg `--amber`, teks hitam).
  Kanan: info akun ("1 AKUN: NAMA") + link **KELUAR** (amber, bold).
- **Kartu statistik** (grid 4 kolom, gap 12px):
  `Jenis Barang` · `Nilai Stok` · `Transaksi Hari Ini` · `⚠ Stok Menipis`
  — kartu bg `--panel`, border-left **6px** (biru untuk biasa, `--red` untuk alert), label 11px uppercase muted, nilai 28px weight 900.
  Nilai stok merah (`.bad`) bila ada item menipis.
- **Aksi utama** (grid 2 kolom, gap 12px, margin 16px):
  `⬆ CATAT MASUK` (bg `--green`, teks `#04140a`) · `⬇ CATAT KELUAR` (bg `--red`, teks putih).
  Font 19px, padding 20px — **tombol terbesar di layar** (target utama operator).
- **Toolbar**: input pencarian (max 380px, placeholder "CARI: nama / kode / barcode…") + spacer +
  tombol outline `⬇ Excel` / `🖨 PDF` (bg transparan, border 2px `--line`, teks `--ink`).
- **Tabel barang** (`table.grid`, rapat, tanpa ruang terbuang):
  Header bg `#000`, teks `--amber`, 11.5px, uppercase, border bawah 2px `--amber`.
  Kolom: **Kode** (mono biru) · **Nama Barang** (bold) · **Barcode** (mono) · **Stok** (rata kanan, bold 17px) · **Min** · **Beli** · **Jual** · **Margin** · **Nilai Stok** · **Status** (badge).
  Sel padding 9–10px, border bawah 1px `--line`. Angka Rp: `tabular-nums`, rata kanan.

### Layar 3 — Transaksi
- Judul + sub-langkah: `PILIH JENIS → SCAN/PILIH BARANG → JUMLAH → SIMPAN`.
- **Toggle jenis** (grid 2 kolom, gap 12px): tombol besar padding 20px, font 19px weight 900,
  `⬆ MASUK` / `⬇ KELUAR`. Keadaan aktif: MASUK → bg `#052e16`, border 3px `--green`, teks hijau;
  KELUAR → bg `#2a1215`, border 3px `--red`, teks merah. Non-aktif → bg `--panel2`, teks muted.
- Form 2 kolom: **Tanggal** · **Scan barcode** (input mono + tombol **Scan** amber + **Cari** outline;
  Enter di input = cari); box hasil pencarian (border 2px `--blue`) menampilkan nama, stok pcs, barcode mono.
  Lalu: **Filter barang** (input teks) · **Pilih barang** (dropdown, format option: `KODE | Nama | STOK n`).
  Lalu: **Jumlah (pcs)** — stepper (− [input angka tebal 20px] +, tombol 56×52px bg `--panel2`) ·
  **Sumber / Tujuan** (placeholder berubah mengikuti jenis: "cth: Pemasok…" / "cth: Kasir…").
- **Keterangan**: textarea opsional (min-height 60px).
- **Error box**: bg `--red`, teks putih, radius 6px, padding 16px, font 15px weight 800 —
  dipakai untuk pesan penolakan (mis. stok tidak cukup: "DITOLAK: stok … tinggal N pcs, diminta M pcs…").
- Baris aksi bawah: **Batal** (outline) + **Simpan** (flex 1).
  Tombol Simpan mengikuti jenis: hijau `⬆ Simpan Masuk` / merah `⬇ Simpan Keluar`.
- **Toast**: fixed bawah-tengah, bg `--amber`, teks hitam, weight 900, uppercase, max 92% lebar —
  konfirmasi sukses (mis. "TERSIMPAN: … × 5 PCS (MASUK)").

---

## 3. Komponen Kunci (spesifikasi implementasi)

1. **Tombol Catat Masuk / Catat Keluar** (dashboard)
   - Ukuran: font 19px, padding 20px, full kolom grid 2×1.
   - Warna tegas tanpa menebak: masuk = `--green` (`#22c55e`, teks `#04140a`), keluar = `--red` (`#ef4444`, teks putih).
   - Klik → pindah ke layar Transaksi dengan toggle jenis sudah sesuai.

2. **Tabel barang**
   - Rapat: padding sel 9–10px, font isi 14px.
   - Kode & barcode selalu monospace biru (`--blue`).
   - Nilai Rp selalu rata kanan + `tabular-nums`.
   - Baris menipis (`stok ≤ min`): bg `#2a1215`, border kiri 5px `--red` di sel pertama, badge `⚠ MENIPIS` berkedip.
   - Pencarian live (onInput) mencocokkan nama / kode / barcode sekaligus.

3. **Form transaksi**
   - Alur 4 langkah sesuai sub-heading: jenis → barang → jumlah → simpan.
   - Barcode: input mono; Enter atau tombol Cari = lookup by barcode/kode; tombol Scan (mockup: simulasi — implementasi nyata via kamera `@zxing/browser` sesuai `tech-stack.md`).
   - Dropdown barang selalu menampilkan sisa stok (`STOK n`) di tiap option.
   - Stepper jumlah: minimal 1, tombol ± 56×52px.
   - Validasi sebelum simpan: tanggal wajib, barang wajib dipilih, jumlah ≥ 1, dan **keluar tidak boleh melebihi stok** (aturan non-negatif) — gagal = error box merah, tanpa simpan.
   - Setelah simpan: reset qty ke 1, kosongkan input lain, refresh dropdown, toast sukses amber.

4. **Statistik dashboard** — 4 kartu sesuai layout §2; nilai stok = Σ(stok × harga beli) di mockup
   (lihat Catatan A di bawah).

5. **Laporan** — tombol Excel (CSV UTF-8 BOM, separator `;`, nama file `laporan-stok-YYYY-MM-DD.csv`)
   dan PDF (cetak via media print hitam-putih: sembunyikan body, tampilkan `#printArea`).

---

## 4. Catatan untuk Gunet (divergensi mockup vs keputusan final)

Mockup adalah referensi **visual**; keputusan fungsional final tetap mengikuti spec. Yang perlu
diselaraskan saat implementasi:

- **A. Nilai stok — MENUNGGU PILIHAN RAMA** (Q3). Mockup menghitung `stok × harga beli`.
  Rama belum memilih antara harga beli (disarankan) atau harga jual. Token desain tidak berubah —
  angka `Nilai Stok` tetap memakai gaya kartu/statistik §2. Saat Rama memilih, tinggal ganti sumber harga.
- **B. Lupa password.** Mockup memakai alur "tautan reset (simulasi)". Keputusan final Rama:
  user memasukkan username → sistem cek keberadaan akun → jika ada, field reset password menjadi
  **unrestricted** (langsung set password baru tanpa password lama). Ikuti keputusan ini, bukan mockup.
- **C. Kode barang.** Mockup memakai contoh `BRG-001`… Keputusan final: pola kode **bisa dikonfigurasi
  per kategori** + auto-generate sekuensial per barang baru + entitas **kategori** (CRUD).
  Di tabel/dashboard, kolom Kode tetap monospace biru; panjang kode bisa lebih panjang (mis. `BRG-0000001`)
  — pastikan kolom tidak wrap (nowrap) dan tabel scroll horizontal di layar sempit.
- **D. Satuan pcs.** Seluruh label & hint menyebut "PCS" / "semua angka dalam pcs" — tetap dipertahankan.

---

**Definisi selesai:** token §1–§3 terpetakan 1:1 ke komponen React; Gunet bisa membangun UI tanpa
menebak warna, ukuran, atau urutan layar. Pertanyaan visual yang tersisa (bila ada) dibahas di meeting
desain ↔ implementasi.
