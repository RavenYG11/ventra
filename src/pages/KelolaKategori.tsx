// Kelola kategori barang: daftar, tambah, ubah, nonaktifkan.
// Aturan: prefix unik [A-Z0-9-] 1–10 char; prefix boleh diubah (kode lama tidak berubah).
import { useEffect, useState } from 'react';
import type { Kategori } from '../types';
import { Input, LabelForm, Modal, PesanGalat, Tombol } from '../components/ui';
import {
  buatKategori,
  daftarKategoriAktif,
  hapusKategori,
  suntingKategori,
} from '../features/kategori/service-kategori';

export default function KelolaKategori({ onTutup }: { onTutup: () => void }) {
  const [daftar, setDaftar] = useState<Kategori[]>([]);
  const [nama, setNama] = useState('');
  const [prefix, setPrefix] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    setDaftar(await daftarKategoriAktif());
  }

  useEffect(() => {
    muat();
  }, []);

  function mulaiUbah(k: Kategori) {
    setEditId(k.id);
    setNama(k.nama);
    setPrefix(k.prefix_kode);
    setGalat(null);
  }

  function batalForm() {
    setEditId(null);
    setNama('');
    setPrefix('');
    setGalat(null);
  }

  async function simpan() {
    setGalat(null);
    setSibuk(true);
    const hasil =
      editId === null ? await buatKategori(nama, prefix) : await suntingKategori(editId, nama, prefix);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menyimpan kategori.');
      return;
    }
    batalForm();
    await muat();
  }

  async function nonaktifkan(id: number, namaKat: string) {
    if (!window.confirm(`Nonaktifkan kategori "${namaKat}"?`)) return;
    setGalat(null);
    const hasil = await hapusKategori(id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menonaktifkan kategori.');
      return;
    }
    await muat();
  }

  return (
    <Modal judul="Kelola Kategori" onTutup={onTutup}>
      <PesanGalat pesan={galat} />
      <table className="grid">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Prefix</th>
            <th className="angka">Terbit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((k) => (
            <tr key={k.id}>
              <td>{k.nama}</td>
              <td>
                <span className="kode-mono">{k.prefix_kode}</span>
              </td>
              <td className="angka">{k.nomor_urut_terakhir}</td>
              <td className="nowrap">
                <Tombol varian="outline" onClick={() => mulaiUbah(k)}>
                  Ubah
                </Tombol>{' '}
                <Tombol varian="ghost" onClick={() => nonaktifkan(k.id, k.nama)}>
                  Nonaktif
                </Tombol>
              </td>
            </tr>
          ))}
          {daftar.length === 0 && (
            <tr>
              <td colSpan={4} className="kosong">
                Belum ada kategori.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <LabelForm>{editId === null ? 'Kategori Baru' : 'Ubah Kategori'}</LabelForm>
      <div className="form-grid">
        <div>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama kategori" />
        </div>
        <div>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="Prefix (cth: BRG-)"
            maxLength={10}
          />
        </div>
      </div>
      <div className="hint">
        Prefix 1–10 karakter (huruf kapital/angka/strip). Kode barang = prefix + nomor urut 7 digit
        (cth: BRG-0000001). Prefix boleh diubah — kode lama tidak berubah, hanya barang baru yang
        memakai prefix baru.
      </div>
      <div className="bar-bawah">
        {editId !== null && (
          <Tombol varian="ghost" onClick={batalForm}>
            Batal
          </Tombol>
        )}
        <Tombol varian="utama" disabled={sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : editId === null ? 'Tambah' : 'Simpan'}
        </Tombol>
      </div>
    </Modal>
  );
}
