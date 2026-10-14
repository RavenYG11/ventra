// Layar daftar barang Ventra: daftar + cari + tambah/ubah/nonaktifkan.
// Kode barang auto-generate (kode kode_barang + 7 digit) — tidak diketik manual.
// Sejak migrasi 003: form tambah memilih KATEGORI lalu KODE BARANG (terfilter
// mapping); kolom tabel bertambah "Kode Barang". Kelola kategori pindah ke
// menu Product Management.
import { useEffect, useState } from 'react';
import type { Barang, KodeBarang } from '../types';
import { BadgeStok, Input, LabelForm, Modal, PesanGalat, Tombol } from '../components/ui';
import {
  daftarKategoriDenganRingkasan,
  type KategoriRingkasan,
} from '../features/kategori/service-kategori';
import {
  daftarKodeAktifUntukKategori,
  kodeBerikutnya,
} from '../features/kode-barang/service-kode-barang';
import {
  daftarSemuaBarang,
  formatRupiah,
  hapusBarang,
  suntingBarang,
  tambahBarangBaru,
} from '../features/barang/service-barang';
import { unduhBackup } from '../lib/backup';

interface FormBarang {
  nama: string;
  kategori_id: number;
  kode_barang_id: number;
  harga_beli: string;
  harga_jual: string;
  stok_awal: string;
  stok_minimum: string;
  keterangan: string;
}

const FORM_KOSONG: FormBarang = {
  nama: '',
  kategori_id: 0,
  kode_barang_id: 0,
  harga_beli: '0',
  harga_jual: '0',
  stok_awal: '0',
  stok_minimum: '0',
  keterangan: '',
};

export default function BarangPage({
  namaPengguna,
  tampilToast,
  onKeProductManagement,
}: {
  namaPengguna: string;
  tampilToast: (pesan: string) => void;
  onKeProductManagement: () => void;
}) {
  const [daftar, setDaftar] = useState<Barang[]>([]);
  const [kategori, setKategori] = useState<KategoriRingkasan[]>([]);
  const [cari, setCari] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormBarang>(FORM_KOSONG);
  const [kodeTersedia, setKodeTersedia] = useState<KodeBarang[]>([]);
  const [previewKode, setPreviewKode] = useState<string | null>(null);
  const [catatanKode, setCatatanKode] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    try {
      const [b, k] = await Promise.all([daftarSemuaBarang(cari), daftarKategoriDenganRingkasan()]);
      setDaftar(b);
      setKategori(k.filter((x) => x.aktif === 1));
      setGalat(null);
    } catch {
      setGalat('Gagal memuat data barang.');
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      daftarSemuaBarang(cari).then(setDaftar).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari]);

  /** Pilih kategori di form tambah: muat kode ter-mapping, auto-fill bila hanya 1 (Q3). */
  async function pilihKategori(id: number) {
    setNilai('kategori_id', id);
    setNilai('kode_barang_id', 0);
    setPreviewKode(null);
    setCatatanKode(null);
    const daftarKode = await daftarKodeAktifUntukKategori(id);
    setKodeTersedia(daftarKode);
    if (daftarKode.length === 1) {
      // Q3: tepat 1 kode aktif -> terisi otomatis + catatan (QA FORM-02).
      setNilai('kode_barang_id', daftarKode[0].id);
      setPreviewKode(await kodeBerikutnya(daftarKode[0].id));
      setCatatanKode('✔ Terisi otomatis — kategori ini hanya punya 1 kode barang aktif.');
    } else if (daftarKode.length > 1) {
      // QA FORM-03: >1 kode -> pilih manual, tidak ada yang terpilih diam-diam.
      setCatatanKode(`Pilih manual — kategori ini punya ${daftarKode.length} kode barang aktif.`);
    }
  }

  async function pilihKodeBarang(id: number) {
    setNilai('kode_barang_id', id);
    setPreviewKode(id ? await kodeBerikutnya(id) : null);
  }

  function bukaTambah() {
    setEditId(null);
    const pertama = kategori[0];
    setForm({ ...FORM_KOSONG, kategori_id: pertama?.id ?? 0 });
    setKodeTersedia([]);
    setPreviewKode(null);
    setCatatanKode(null);
    setGalat(null);
    setShowForm(true);
    if (pertama) void pilihKategori(pertama.id);
  }

  function bukaUbah(b: Barang) {
    setEditId(b.id);
    setForm({
      nama: b.nama,
      kategori_id: b.kategori_id,
      kode_barang_id: b.kode_barang_id,
      harga_beli: String(b.harga_beli),
      harga_jual: String(b.harga_jual),
      stok_awal: String(b.stok_awal),
      stok_minimum: String(b.stok_minimum),
      keterangan: b.keterangan ?? '',
    });
    setKodeTersedia([]);
    setPreviewKode(null);
    setGalat(null);
    setShowForm(true);
  }

  function setNilai<K extends keyof FormBarang>(kunci: K, nilai: FormBarang[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  function angka(teks: string): number {
    const n = parseInt(teks.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  async function simpan() {
    setGalat(null);
    setSibuk(true);
    if (editId === null) {
      const hasil = await tambahBarangBaru(
        {
          nama: form.nama,
          kategori_id: form.kategori_id,
          kode_barang_id: form.kode_barang_id,
          harga_beli: angka(form.harga_beli),
          harga_jual: angka(form.harga_jual),
          stok_awal: angka(form.stok_awal),
          stok_minimum: angka(form.stok_minimum),
          keterangan: form.keterangan,
        },
        namaPengguna // audit: siapa yang mencatat ("Stok awal")
      );
      setSibuk(false);
      if (!hasil.ok) {
        setGalat(hasil.galat ?? 'Gagal menambah barang.');
        return;
      }
      setShowForm(false);
      tampilToast(`TERSIMPAN: ${hasil.data}`);
    } else {
      const hasil = await suntingBarang(editId, {
        nama: form.nama,
        harga_beli: angka(form.harga_beli),
        harga_jual: angka(form.harga_jual),
        stok_minimum: angka(form.stok_minimum),
        keterangan: form.keterangan,
      });
      setSibuk(false);
      if (!hasil.ok) {
        setGalat(hasil.galat ?? 'Gagal mengubah barang.');
        return;
      }
      setShowForm(false);
      tampilToast('PERUBAHAN TERSIMPAN');
    }
    await muat();
  }

  async function nonaktifkan(b: Barang) {
    if (!window.confirm(`Nonaktifkan "${b.nama}" (${b.kode})? Riwayat tetap tersimpan.`)) return;
    const hasil = await hapusBarang(b.id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menonaktifkan barang.');
      return;
    }
    tampilToast('BARANG DINONAKTIFKAN');
    await muat();
  }

  // Unduh salinan penuh database (.db) — pengganti backup otomatis
  // saat aplikasi ditutup (tidak mungkin di browser). File tersimpan di
  // folder Download; pindahkan ke flashdisk/tempat aman bila perlu.
  async function backupSekarang() {
    try {
      const namaFile = await unduhBackup();
      tampilToast(`BACKUP TERUNDUH: ${namaFile}`);
    } catch {
      setGalat('Gagal mengunduh backup. Coba tutup tab Ventra lain lalu ulangi.');
    }
  }

  const kategoriDipilih = kategori.find((k) => k.id === form.kategori_id);
  const kategoriTanpaKode = editId === null && kategoriDipilih && kategoriDipilih.jml_kode === 0;

  return (
    <div className="layar">
      <h2 className="judul-layar">Daftar Barang</h2>
      <PesanGalat pesan={galat} />

      <div className="toolbar">
        <Input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="CARI: nama / kode / barcode…"
        />
        <span style={{ flex: 1 }} />
        <Tombol varian="outline" onClick={backupSekarang} title="Unduh salinan database (.db)">
          Unduh Backup
        </Tombol>
        <Tombol varian="utama" onClick={bukaTambah}>
          + Tambah Barang
        </Tombol>
      </div>
      <div style={{ margin: '-8px 0 16px', textAlign: 'right' }}>
        <span className="link-kecil" onClick={onKeProductManagement}>
          Kelola di Product Management →
        </span>
      </div>

      <div className="tabel-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Kode Barang</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th className="angka">Stok</th>
              <th className="angka">Min</th>
              <th className="angka">Beli</th>
              <th className="angka">Jual</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((b) => (
              <tr key={b.id} className={b.status_stok === 'menipis' ? 'menipis' : ''}>
                <td className="nowrap">
                  <span className="kode-mono">{b.kode}</span>
                </td>
                <td className="nowrap">
                  <span className="kode-mono">{b.kode_barang_kode ?? '—'}</span>
                </td>
                <td>
                  <b>{b.nama}</b>
                </td>
                <td>{b.kategori_nama}</td>
                <td className="angka tebal">{b.stok}</td>
                <td className="angka">{b.stok_minimum}</td>
                <td className="angka">{formatRupiah(b.harga_beli)}</td>
                <td className="angka">{formatRupiah(b.harga_jual)}</td>
                <td>
                  <BadgeStok status={b.status_stok ?? 'aman'} />
                </td>
                <td className="nowrap">
                  <Tombol varian="outline" onClick={() => bukaUbah(b)}>
                    Ubah
                  </Tombol>{' '}
                  <Tombol varian="ghost" onClick={() => nonaktifkan(b)}>
                    Nonaktif
                  </Tombol>
                </td>
              </tr>
            ))}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={10} className="kosong">
                  {cari ? 'Tidak ada barang yang cocok.' : 'Belum ada barang. Klik "+ Tambah Barang".'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal judul={editId === null ? 'Tambah Barang' : 'Ubah Barang'} onTutup={() => setShowForm(false)}>
          <PesanGalat pesan={galat} />
          <LabelForm>Nama Barang</LabelForm>
          <Input value={form.nama} onChange={(e) => setNilai('nama', e.target.value)} placeholder="cth: Kopi Tubruk 250g" />
          {editId === null && (
            <>
              <div className="form-grid">
                <div>
                  <LabelForm>Kategori</LabelForm>
                  <select
                    className="select"
                    value={form.kategori_id}
                    onChange={(e) => void pilihKategori(Number(e.target.value))}
                  >
                    {kategori.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                        {k.jml_kode === 0 ? ' — ⚠ belum ada kode barang' : ''}
                      </option>
                    ))}
                  </select>
                  {catatanKode && <div className="teks-baik">{catatanKode}</div>}
                </div>
                <div>
                  <LabelForm>Kode Barang</LabelForm>
                  <select
                    className="select"
                    value={form.kode_barang_id}
                    disabled={kodeTersedia.length === 0}
                    onChange={(e) => void pilihKodeBarang(Number(e.target.value))}
                  >
                    <option value={0}>— pilih —</option>
                    {kodeTersedia.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.kode} — {kb.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {kategoriTanpaKode ? (
                // QA FORM-05: kategori tanpa kode -> pesan MERAH + Simpan nonaktif.
                <div className="pesan-galat">
                  DITOLAK: kategori "{kategoriDipilih?.nama}" belum punya kode barang aktif.
                  <br />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Hubungkan dulu di Product Management → Mapping.
                  </span>
                </div>
              ) : (
                previewKode && (
                  <div className="previewbox">
                    <div className="plabel">Kode berikutnya (auto-generate, final)</div>
                    <div className="pcode">{previewKode}</div>
                  </div>
                )
              )}
            </>
          )}
          <div className="form-grid">
            <div>
              <LabelForm>Satuan</LabelForm>
              <Input value="pcs" disabled />
            </div>
            <div>
              <LabelForm>Harga Beli (Rp)</LabelForm>
              <Input
                value={form.harga_beli}
                inputMode="numeric"
                onChange={(e) => setNilai('harga_beli', e.target.value)}
              />
            </div>
            <div>
              <LabelForm>Harga Jual (Rp)</LabelForm>
              <Input
                value={form.harga_jual}
                inputMode="numeric"
                onChange={(e) => setNilai('harga_jual', e.target.value)}
              />
            </div>
            <div>
              <LabelForm>Stok Awal (pcs)</LabelForm>
              <Input
                value={form.stok_awal}
                inputMode="numeric"
                disabled={editId !== null}
                onChange={(e) => setNilai('stok_awal', e.target.value)}
              />
            </div>
            <div>
              <LabelForm>Stok Minimum (pcs)</LabelForm>
              <Input
                value={form.stok_minimum}
                inputMode="numeric"
                onChange={(e) => setNilai('stok_minimum', e.target.value)}
              />
            </div>
          </div>
          <LabelForm>Keterangan (opsional)</LabelForm>
          <textarea
            className="textarea"
            value={form.keterangan}
            onChange={(e) => setNilai('keterangan', e.target.value)}
          />
          <div className="bar-bawah">
            <Tombol varian="ghost" onClick={() => setShowForm(false)}>
              Batal
            </Tombol>
            <Tombol varian="utama" disabled={sibuk || !!kategoriTanpaKode} onClick={simpan}>
              {sibuk ? 'Menyimpan…' : 'Simpan'}
            </Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}
