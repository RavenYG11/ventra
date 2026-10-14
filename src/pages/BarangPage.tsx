// Layar daftar barang Ventra (v0.1): daftar + cari + tambah/ubah/nonaktifkan + kelola kategori.
// Kode barang auto-generate (prefix kategori + 7 digit) — tidak diketik manual.
import { useEffect, useState } from 'react';
import type { Barang, Kategori } from '../types';
import { BadgeStok, Input, LabelForm, Modal, PesanGalat, Tombol } from '../components/ui';
import { daftarKategoriAktif } from '../features/kategori/service-kategori';
import {
  daftarSemuaBarang,
  formatRupiah,
  hapusBarang,
  suntingBarang,
  tambahBarangBaru,
} from '../features/barang/service-barang';
import KelolaKategori from './KelolaKategori';

interface FormBarang {
  nama: string;
  kategori_id: number;
  harga_beli: string;
  harga_jual: string;
  stok_awal: string;
  stok_minimum: string;
  keterangan: string;
}

const FORM_KOSONG: FormBarang = {
  nama: '',
  kategori_id: 0,
  harga_beli: '0',
  harga_jual: '0',
  stok_awal: '0',
  stok_minimum: '0',
  keterangan: '',
};

export default function BarangPage({
  namaPengguna,
  tampilToast,
}: {
  namaPengguna: string;
  tampilToast: (pesan: string) => void;
}) {
  const [daftar, setDaftar] = useState<Barang[]>([]);
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [cari, setCari] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showKategori, setShowKategori] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormBarang>(FORM_KOSONG);
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    try {
      const [b, k] = await Promise.all([daftarSemuaBarang(cari), daftarKategoriAktif()]);
      setDaftar(b);
      setKategori(k);
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

  function bukaTambah() {
    setEditId(null);
    setForm({ ...FORM_KOSONG, kategori_id: kategori[0]?.id ?? 0 });
    setGalat(null);
    setShowForm(true);
  }

  function bukaUbah(b: Barang) {
    setEditId(b.id);
    setForm({
      nama: b.nama,
      kategori_id: b.kategori_id,
      harga_beli: String(b.harga_beli),
      harga_jual: String(b.harga_jual),
      stok_awal: String(b.stok_awal),
      stok_minimum: String(b.stok_minimum),
      keterangan: b.keterangan ?? '',
    });
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
        <Tombol varian="outline" onClick={() => setShowKategori(true)}>
          Kategori
        </Tombol>
        <Tombol varian="utama" onClick={bukaTambah}>
          + Tambah Barang
        </Tombol>
      </div>

      <div className="tabel-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Kode</th>
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
                <td colSpan={9} className="kosong">
                  {cari ? 'Tidak ada barang yang cocok.' : 'Belum ada barang. Klik "+ Tambah Barang".'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showKategori && (
        <KelolaKategori
          onTutup={() => {
            setShowKategori(false);
            muat();
          }}
        />
      )}

      {showForm && (
        <Modal judul={editId === null ? 'Tambah Barang' : 'Ubah Barang'} onTutup={() => setShowForm(false)}>
          <PesanGalat pesan={galat} />
          <LabelForm>Nama Barang</LabelForm>
          <Input value={form.nama} onChange={(e) => setNilai('nama', e.target.value)} placeholder="cth: Kopi Tubruk 250g" />
          <div className="form-grid">
            <div>
              <LabelForm>Kategori</LabelForm>
              <select
                className="select"
                value={form.kategori_id}
                disabled={editId !== null}
                onChange={(e) => setNilai('kategori_id', Number(e.target.value))}
              >
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama} ({k.prefix_kode}0000001…)
                  </option>
                ))}
              </select>
              {editId === null && (
                <div className="hint">Kode otomatis: prefix kategori + nomor urut 7 digit.</div>
              )}
            </div>
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
            <Tombol varian="utama" disabled={sibuk} onClick={simpan}>
              {sibuk ? 'Menyimpan…' : 'Simpan'}
            </Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}
