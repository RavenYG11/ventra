// Layar utama Ventra Simple: daftar barang + ringkasan + tambah/ubah/hapus
// + dialog BELI/JUAL. Satu-satunya halaman setelah login.
// ATURAN LAPISAN: UI hanya memanggil service-barang.ts — dilarang query DB langsung.
import { useEffect, useState } from 'react';
import type { Barang } from '../types';
import { Input, LabelForm, Modal, PesanGalat, Tombol } from '../components/ui';
import {
  ambilBarang,
  beliBarang,
  daftarBarang,
  formatRupiah,
  hapusBarang,
  hitungRingkasan,
  jualBarang,
  tambahBarang,
  ubahBarang,
  type Ringkasan,
} from '../features/barang/service-barang';
import { salinDetailTeknis } from '../lib/db';
import { unduhBackup } from '../lib/backup';

type Dialog =
  | { jenis: 'tutup' }
  | { jenis: 'form'; barang: Barang | null } // null = tambah baru
  | { jenis: 'beli'; barang: Barang }
  | { jenis: 'jual'; barang: Barang }
  | { jenis: 'hapus'; barang: Barang };

/** Ambang menipis global (spec §F5): stok ≤ 5. */
const AMBANG_MENIPIS = 5;

function statusStok(stok: number): 'habis' | 'menipis' | 'aman' {
  if (stok === 0) return 'habis';
  if (stok <= AMBANG_MENIPIS) return 'menipis';
  return 'aman';
}

function parseStok(teks: string): number | null {
  const t = teks.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function parseHarga(teks: string): number | null {
  const t = teks.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function BarangPage({
  namaPengguna,
  tampilToast,
}: {
  namaPengguna: string;
  tampilToast: (pesan: string) => void;
}) {
  const [daftar, setDaftar] = useState<Barang[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan>({
    total_jenis: 0,
    total_unit: 0,
    total_nilai: 0,
    potensi_laba: 0,
  });
  const [cari, setCari] = useState('');
  const [dialog, setDialog] = useState<Dialog>({ jenis: 'tutup' });
  const [galatDb, setGalatDb] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const [memuat, setMemuat] = useState(true);

  async function muatUlang() {
    try {
      const [items, ring] = await Promise.all([daftarBarang(), hitungRingkasan()]);
      setDaftar(items);
      setRingkasan(ring);
      setGalatDb(null);
    } catch (e) {
      setGalatDb('Gagal membaca data: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muatUlang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape menutup dialog (selain klik di luar modal).
  useEffect(() => {
    if (dialog.jenis === 'tutup') return;
    const tutup = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialog({ jenis: 'tutup' });
    };
    window.addEventListener('keydown', tutup);
    return () => window.removeEventListener('keydown', tutup);
  }, [dialog.jenis]);

  const hasilCari = cari.trim()
    ? daftar.filter((b) => b.nama.toLowerCase().includes(cari.trim().toLowerCase()))
    : daftar;

  const menipis = daftar.filter((b) => b.stok > 0 && b.stok <= AMBANG_MENIPIS);

  return (
    <div className="layar">
      <h2 className="judul-layar">Daftar Barang</h2>

      {galatDb && (
        <div>
          <PesanGalat pesan={galatDb} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Tombol varian="outline" onClick={() => muatUlang()}>
              Coba lagi
            </Tombol>
            <Tombol
              varian="ghost"
              onClick={async () => setTersalin(await salinDetailTeknis())}
            >
              {tersalin ? 'Tersalin!' : 'Salin detail teknis'}
            </Tombol>
          </div>
        </div>
      )}

      {/* Ringkasan — auto-calculate, refresh tiap operasi sukses */}
      <div className="grid-stat">
        <div className="stat">
          <div className="label">Jenis barang</div>
          <div className="nilai biru">{ringkasan.total_jenis}</div>
        </div>
        <div className="stat">
          <div className="label">Total unit (pcs)</div>
          <div className="nilai">{ringkasan.total_unit}</div>
        </div>
        <div className="stat">
          <div className="label">Nilai stok</div>
          <div className="nilai">{formatRupiah(ringkasan.total_nilai)}</div>
        </div>
        <div className={`stat${ringkasan.potensi_laba < 0 ? ' waspada' : ''}`}>
          <div className="label">Potensi laba</div>
          <div className={`nilai${ringkasan.potensi_laba < 0 ? ' bad' : ''}`}>
            {formatRupiah(ringkasan.potensi_laba)}
          </div>
        </div>
      </div>

      {menipis.length > 0 && (
        <div className="hint" style={{ margin: '8px 0' }}>
          ⚠ Menipis: {menipis.map((b) => `${b.nama} (${b.stok} pcs)`).join(', ')}
        </div>
      )}

      {/* Toolbar: tambah + backup + pencarian */}
      <div className="toolbar">
        <Tombol varian="utama" onClick={() => setDialog({ jenis: 'form', barang: null })}>
          + Tambah Barang
        </Tombol>
        <Tombol
          varian="outline"
          onClick={async () => {
            try {
              const nama = await unduhBackup();
              tampilToast('Backup tersimpan: ' + nama);
            } catch (e) {
              tampilToast('Gagal mengunduh backup: ' + (e instanceof Error ? e.message : String(e)));
            }
          }}
        >
          Unduh Backup
        </Tombol>
        <Input
          placeholder="Cari barang…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>

      {/* Tabel barang */}
      <div className="tabel-wrap">
        {memuat ? (
          <div className="kosong">Memuat…</div>
        ) : hasilCari.length === 0 ? (
          <div className="kosong">
            {daftar.length === 0
              ? 'Belum ada barang. Klik "Tambah Barang".'
              : `Tidak ada barang yang cocok dengan "${cari}".`}
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nama</th>
                <th className="angka">Stok (pcs)</th>
                <th className="angka">Harga beli</th>
                <th className="angka">Harga jual</th>
                <th className="angka">Nilai stok</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {hasilCari.map((b) => {
                const status = statusStok(b.stok);
                const rugi = b.harga_jual < b.harga_beli;
                return (
                  <tr key={b.id} className={status === 'menipis' ? 'menipis' : ''}>
                    <td className="tebal">
                      {b.nama}
                      {rugi && (
                        <span title="Harga jual di bawah harga beli (potensi laba negatif)" style={{ marginLeft: 6 }}>
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="angka">
                      {b.stok}{' '}
                      {status === 'habis' && <span className="badge badge-habis">Habis</span>}
                      {status === 'menipis' && <span className="badge badge-menipis">Menipis</span>}
                    </td>
                    <td className="angka">{formatRupiah(b.harga_beli)}</td>
                    <td className="angka">{formatRupiah(b.harga_jual)}</td>
                    <td className="angka">{formatRupiah(b.stok * b.harga_beli)}</td>
                    <td className="nowrap">
                      <Tombol
                        varian="masuk"
                        style={{ padding: '6px 12px', fontSize: 12, marginRight: 6 }}
                        onClick={() => setDialog({ jenis: 'beli', barang: b })}
                      >
                        Beli
                      </Tombol>
                      <Tombol
                        varian="utama"
                        style={{ padding: '6px 12px', fontSize: 12, marginRight: 6 }}
                        onClick={() => setDialog({ jenis: 'jual', barang: b })}
                      >
                        Jual
                      </Tombol>
                      <Tombol
                        varian="outline"
                        style={{ padding: '6px 12px', fontSize: 12, marginRight: 6 }}
                        onClick={() => setDialog({ jenis: 'form', barang: b })}
                      >
                        Ubah
                      </Tombol>
                      <Tombol
                        varian="keluar"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => setDialog({ jenis: 'hapus', barang: b })}
                      >
                        Hapus
                      </Tombol>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog form tambah/ubah */}
      {dialog.jenis === 'form' && (
        <FormBarang
          barang={dialog.barang}
          onTutup={() => setDialog({ jenis: 'tutup' })}
          onSukses={(pesan) => {
            setDialog({ jenis: 'tutup' });
            muatUlang();
            tampilToast(pesan);
          }}
        />
      )}

      {/* Dialog beli */}
      {dialog.jenis === 'beli' && (
        <DialogStok
          judul="Catat BELI"
          barang={dialog.barang}
          onTutup={() => setDialog({ jenis: 'tutup' })}
          onSukses={(pesan) => {
            setDialog({ jenis: 'tutup' });
            muatUlang();
            tampilToast(pesan);
          }}
          proses={beliBarang}
        />
      )}

      {/* Dialog jual */}
      {dialog.jenis === 'jual' && (
        <DialogStok
          judul="Catat JUAL"
          barang={dialog.barang}
          onTutup={() => setDialog({ jenis: 'tutup' })}
          onSukses={(pesan) => {
            setDialog({ jenis: 'tutup' });
            muatUlang();
            tampilToast(pesan);
          }}
          proses={jualBarang}
        />
      )}

      {/* Dialog hapus (konfirmasi — tidak bisa dilewati) */}
      {dialog.jenis === 'hapus' && (
        <Modal judul="Hapus barang" onTutup={() => setDialog({ jenis: 'tutup' })}>
          <p>
            Hapus <b>{dialog.barang.nama}</b>? Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="bar-bawah">
            <Tombol
              varian="keluar"
              onClick={async () => {
                const hasil = await hapusBarang(dialog.barang.id);
                if (!hasil.ok) {
                  tampilToast(hasil.galat ?? 'Gagal menghapus.');
                  return;
                }
                setDialog({ jenis: 'tutup' });
                muatUlang();
                tampilToast(`"${dialog.barang.nama}" dihapus.`);
              }}
            >
              Ya, hapus
            </Tombol>
            <Tombol varian="outline" onClick={() => setDialog({ jenis: 'tutup' })}>
              Batal
            </Tombol>
          </div>
        </Modal>
      )}

      <div className="hint-bawah">
        Masuk sebagai {namaPengguna} · satuan pcs · 100% offline
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form tambah / ubah barang (modal).
// ---------------------------------------------------------------------------

function FormBarang({
  barang,
  onTutup,
  onSukses,
}: {
  barang: Barang | null;
  onTutup: () => void;
  onSukses: (pesan: string) => void;
}) {
  const [nama, setNama] = useState(barang?.nama ?? '');
  const [stok, setStok] = useState(barang ? String(barang.stok) : '0');
  const [hargaBeli, setHargaBeli] = useState(barang ? String(barang.harga_beli) : '0');
  const [hargaJual, setHargaJual] = useState(barang ? String(barang.harga_jual) : '0');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setGalat(null);
    const sStok = parseStok(stok);
    const hBeli = parseHarga(hargaBeli);
    const hJual = parseHarga(hargaJual);
    if (sStok === null) {
      setGalat('Stok harus bilangan bulat ≥ 0.');
      return;
    }
    if (hBeli === null) {
      setGalat('Harga beli harus bilangan ≥ 0.');
      return;
    }
    if (hJual === null) {
      setGalat('Harga jual harus bilangan ≥ 0.');
      return;
    }
    setSibuk(true);
    const hasil = barang
      ? await ubahBarang(barang.id, { nama, stok: sStok, harga_beli: hBeli, harga_jual: hJual })
      : await tambahBarang({ nama, stok: sStok, harga_beli: hBeli, harga_jual: hJual });
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menyimpan.');
      return;
    }
    onSukses(barang ? `"${hasil.data?.nama}" diubah.` : `"${hasil.data?.nama}" ditambahkan.`);
  }

  return (
    <Modal judul={barang ? 'Ubah Barang' : 'Tambah Barang'} onTutup={onTutup}>
      <PesanGalat pesan={galat} />
      <LabelForm>Nama barang</LabelForm>
      <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Kabel HDMI" />
      <div className="form-grid">
        <div>
          <LabelForm>Stok awal (pcs)</LabelForm>
          <Input value={stok} onChange={(e) => setStok(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <LabelForm>Satuan</LabelForm>
          <div className="input" style={{ color: 'var(--muted)' }}>
            pcs (terkunci)
          </div>
        </div>
        <div>
          <LabelForm>Harga beli (Rp)</LabelForm>
          <Input value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <LabelForm>Harga jual (Rp)</LabelForm>
          <Input value={hargaJual} onChange={(e) => setHargaJual(e.target.value)} inputMode="decimal" />
        </div>
      </div>
      <div className="hint">
        Harga jual boleh di bawah harga beli (obral) — hanya peringatan, tidak diblokir.
      </div>
      <div className="bar-bawah">
        <Tombol varian="utama" disabled={sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </Tombol>
        <Tombol varian="outline" onClick={onTutup}>
          Batal
        </Tombol>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Dialog BELI / JUAL — satu komponen, beda judul & fungsi proses.
// ---------------------------------------------------------------------------

function DialogStok({
  judul,
  barang,
  onTutup,
  onSukses,
  proses,
}: {
  judul: string;
  barang: Barang;
  onTutup: () => void;
  onSukses: (pesan: string) => void;
  proses: (id: number, jumlah: number) => Promise<{ ok: boolean; galat?: string }>;
}) {
  const [jumlah, setJumlah] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [stokKini, setStokKini] = useState(barang.stok);

  async function simpan() {
    setGalat(null);
    const j = parseStok(jumlah);
    if (j === null || j <= 0) {
      setGalat('Jumlah harus bilangan bulat > 0.');
      return;
    }
    setSibuk(true);
    const hasil = await proses(barang.id, j);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal mencatat.');
      // Refresh stok terkini agar pesan "sisa: N pcs" akurat.
      const terkini = await ambilBarang(barang.id);
      if (terkini) setStokKini(terkini.stok);
      return;
    }
    onSukses(`${judul} ${j} pcs "${barang.nama}" — stok kini ${stokKini + (judul === 'Catat BELI' ? j : -j)} pcs.`);
  }

  return (
    <Modal judul={`${judul} — ${barang.nama}`} onTutup={onTutup}>
      <div className="box-info">
        Stok saat ini: <b>{stokKini} pcs</b> · Satuan: pcs
      </div>
      <PesanGalat pesan={galat} />
      <LabelForm>Jumlah (pcs)</LabelForm>
      <Input
        value={jumlah}
        onChange={(e) => setJumlah(e.target.value)}
        placeholder="cth: 3"
        inputMode="numeric"
        autoFocus
      />
      <div className="bar-bawah">
        <Tombol varian="utama" disabled={sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </Tombol>
        <Tombol varian="outline" onClick={onTutup}>
          Batal
        </Tombol>
      </div>
    </Modal>
  );
}
