// Tab 1 — Kategori (Product Management).
// Form kategori hanya berisi NAMA (prefix & counter pindah ke Kode Barang,
// migrasi 003). Kategori aktif WAJIB punya >=1 kode barang aktif (Q4):
// baris yang melanggar diberi badge "⚠ TANPA KODE" + banner peringatan
// di atas tabel (QA Q4-01, mockup Prapto layar 1 & 5B).
import { useEffect, useState } from 'react';
import type { KodeBarang } from '../../types';
import { Input, LabelForm, PesanGalat, Tombol } from '../../components/ui';
import {
  aktifkanKategori,
  buatKategori,
  daftarKategoriDenganRingkasan,
  hapusKategori,
  suntingKategori,
  type KategoriRingkasan,
} from '../../features/kategori/service-kategori';
import { petaKodePerKategori } from '../../features/kode-barang/service-kode-barang';
import { ChipKode, StatusAktif } from './komponen';

export default function TabKategori({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [daftar, setDaftar] = useState<KategoriRingkasan[]>([]);
  const [petaKode, setPetaKode] = useState<Record<number, KodeBarang[]>>({});
  const [cari, setCari] = useState('');
  const [nama, setNama] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    const [d, p] = await Promise.all([daftarKategoriDenganRingkasan(), petaKodePerKategori()]);
    setDaftar(d);
    setPetaKode(p);
  }
  useEffect(() => {
    muat();
  }, []);

  function batal() {
    setEditId(null);
    setNama('');
    setGalat(null);
  }

  function mulaiUbah(k: KategoriRingkasan) {
    setEditId(k.id);
    setNama(k.nama);
    setGalat(null);
  }

  async function simpan() {
    setGalat(null);
    setSibuk(true);
    const hasil =
      editId === null ? await buatKategori(nama) : await suntingKategori(editId, nama);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menyimpan kategori.');
      return;
    }
    batal();
    tampilToast(editId === null ? 'KATEGORI DITAMBAH' : 'KATEGORI DIPERBARUI');
    await muat();
  }

  async function nonaktifkan(id: number, namaKat: string) {
    if (!window.confirm(`Nonaktifkan kategori "${namaKat}"?`)) return;
    const hasil = await hapusKategori(id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menonaktifkan kategori.');
      return;
    }
    tampilToast('KATEGORI DINONAKTIFKAN');
    await muat();
  }

  async function aktifkanKembali(id: number, namaKat: string) {
    const hasil = await aktifkanKategori(id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal mengaktifkan kategori.');
      return;
    }
    tampilToast(`KATEGORI "${namaKat.toUpperCase()}" DIAKTIFKAN`);
    await muat();
  }

  const q = cari.trim().toLowerCase();
  const tampil = daftar.filter((k) => k.nama.toLowerCase().includes(q));
  // Q4: kategori AKTIF yang belum punya kode barang AKTIF -> flag.
  const tanpaKode = daftar.filter((k) => k.aktif === 1 && k.jml_kode === 0);

  return (
    <div>
      {tanpaKode.length > 0 && (
        <div className="warnbox">
          ⚠ <b>{tanpaKode.length} kategori belum punya kode barang aktif: {tanpaKode.map((k) => k.nama).join(', ')}.</b>
          <br />
          Barang baru tidak bisa dibuat untuk kategori ini. Hubungkan minimal 1 kode barang di tab{' '}
          <b>Mapping</b>.
        </div>
      )}
      <div className="toolbar">
        <Input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="CARI KATEGORI…"
          style={{ maxWidth: 340 }}
        />
        <span style={{ flex: 1 }} />
        <Tombol varian="utama" onClick={() => batal()}>
          + Tambah Kategori
        </Tombol>
      </div>
      <PesanGalat pesan={galat} />
      <div className="tabel-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Nama Kategori</th>
              <th>Kode Barang Terhubung</th>
              <th className="angka">Jml Barang</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((k) => {
              const flagTanpaKode = k.aktif === 1 && k.jml_kode === 0;
              return (
                <tr key={k.id} style={k.aktif === 0 ? { opacity: 0.55 } : undefined}>
                  <td>
                    <b>{k.nama}</b>{' '}
                    {flagTanpaKode && <span className="badge-tanpa-kode">⚠ Tanpa kode</span>}
                  </td>
                  <td>
                    <ChipKode daftar={petaKode[k.id] ?? []} />
                  </td>
                  <td className="angka">{k.jml_barang}</td>
                  <td>
                    <StatusAktif aktif={k.aktif} />
                  </td>
                  <td className="nowrap">
                    <Tombol varian="outline" onClick={() => mulaiUbah(k)}>
                      Ubah
                    </Tombol>{' '}
                    {k.aktif === 1 ? (
                      <Tombol varian="ghost" onClick={() => nonaktifkan(k.id, k.nama)}>
                        Nonaktif
                      </Tombol>
                    ) : (
                      <Tombol varian="outline" onClick={() => aktifkanKembali(k.id, k.nama)}>
                        Aktifkan
                      </Tombol>
                    )}
                  </td>
                </tr>
              );
            })}
            {tampil.length === 0 && (
              <tr>
                <td colSpan={5} className="kosong">
                  {cari ? 'Tidak ada kategori yang cocok.' : 'Belum ada kategori. Klik "+ Tambah Kategori" untuk mulai.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="infobox">
        Form kategori kini <b>hanya berisi nama</b> — prefix pindah ke tab Kode Barang. Kategori
        wajib punya <b>minimal 1 kode barang aktif</b> (hubungkan di tab Mapping) sebelum bisa
        dipakai di form Tambah Barang.
      </div>
      <LabelForm>{editId === null ? 'Kategori Baru' : 'Ubah Kategori'}</LabelForm>
      <Input
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        placeholder="cth: Elektronik"
        maxLength={50}
      />
      <div className="bar-bawah">
        {editId !== null && (
          <Tombol varian="ghost" onClick={batal}>
            Batal
          </Tombol>
        )}
        <Tombol varian="utama" disabled={sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : editId === null ? 'Tambah' : 'Simpan'}
        </Tombol>
      </div>
    </div>
  );
}
