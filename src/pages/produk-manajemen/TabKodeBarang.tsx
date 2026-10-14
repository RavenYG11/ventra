// Tab 2 — Kode Barang (Product Management).
// Satu baris = satu pola kode (prefix + counter-nya sendiri). Counter
// read-only (hanya naik lewat pembuatan barang). Field "kode" STRICT:
// huruf kecil DITOLAK (bukan di-uppercase diam-diam) — QA KB-02, mockup
// layar 5D: pesan "Kode harus huruf kapital, pola [A-Z0-9-], 1–10 karakter,
// tanpa spasi." Kode yang sudah dipakai barang tidak bisa diubah (historis).
import { useEffect, useState } from 'react';
import { Input, LabelForm, PesanGalat, Tombol } from '../../components/ui';
import {
  aktifkanKodeBarang,
  buatKodeBarang,
  daftarKodeRingkasan,
  hapusKodeBarang,
  suntingKodeBarang,
  type KodeBarangRingkasan,
} from '../../features/kode-barang/service-kode-barang';
import { StatusAktif } from './komponen';

export default function TabKodeBarang({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [daftar, setDaftar] = useState<KodeBarangRingkasan[]>([]);
  const [cari, setCari] = useState('');
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editPernahDipakai, setEditPernahDipakai] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatKode, setGalatKode] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    setDaftar(await daftarKodeRingkasan());
  }
  useEffect(() => {
    muat();
  }, []);

  function batal() {
    setEditId(null);
    setKode('');
    setNama('');
    setKeterangan('');
    setEditPernahDipakai(false);
    setGalat(null);
    setGalatKode(null);
  }

  function mulaiUbah(k: KodeBarangRingkasan) {
    setEditId(k.id);
    setKode(k.kode);
    setNama(k.nama);
    setKeterangan(k.keterangan ?? '');
    // Kunci field "kode" bila dipakai barang APAPUN (aktif maupun nonaktif) —
    // selaras dengan service suntingKodeBarang (QA BUG-5). Pakai
    // jml_barang_semua, BUKAN jml_barang (yang hanya hitung yang aktif).
    setEditPernahDipakai(k.jml_barang_semua > 0);
    setGalat(null);
    setGalatKode(null);
  }

  // Validasi live saat mengetik (tanpa auto-uppercase — mockup menolak huruf kecil).
  function ubahKodeInput(nilai: string) {
    setKode(nilai);
    if (nilai && !/^[A-Z0-9-]{1,10}$/.test(nilai)) {
      setGalatKode('Kode harus huruf kapital, pola [A-Z0-9-], 1–10 karakter, tanpa spasi.');
    } else {
      setGalatKode(null);
    }
  }

  async function simpan() {
    setGalat(null);
    setSibuk(true);
    const hasil =
      editId === null
        ? await buatKodeBarang(kode, nama, keterangan)
        : await suntingKodeBarang(editId, {
            kode: editPernahDipakai ? undefined : kode,
            nama,
            keterangan,
          });
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menyimpan kode barang.');
      return;
    }
    batal();
    tampilToast(editId === null ? 'KODE BARANG DITAMBAH' : 'KODE BARANG DIPERBARUI');
    await muat();
  }

  async function nonaktifkan(id: number, kodeNama: string) {
    if (!window.confirm(`Nonaktifkan kode barang "${kodeNama}"? Barang lama tetap utuh.`)) return;
    const hasil = await hapusKodeBarang(id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal menonaktifkan kode barang.');
      return;
    }
    tampilToast('KODE BARANG DINONAKTIFKAN');
    await muat();
  }

  async function aktifkanKembali(id: number, kodeNama: string) {
    const hasil = await aktifkanKodeBarang(id);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal mengaktifkan kode barang.');
      return;
    }
    tampilToast(`KODE "${kodeNama}" DIAKTIFKAN`);
    await muat();
  }

  const q = cari.trim().toLowerCase();
  const tampil = daftar.filter((k) => (k.kode + k.nama).toLowerCase().includes(q));

  return (
    <div>
      <div className="toolbar">
        <Input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="CARI KODE / NAMA…"
          style={{ maxWidth: 340 }}
        />
        <span style={{ flex: 1 }} />
        <Tombol varian="utama" onClick={() => batal()}>
          + Tambah Kode Barang
        </Tombol>
      </div>
      <PesanGalat pesan={galat} />
      <div className="tabel-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th className="angka">No. Urut Terakhir</th>
              <th className="angka">Jml Barang</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((k) => (
              <tr key={k.id} style={k.aktif === 0 ? { opacity: 0.55 } : undefined}>
                <td>
                  <span className="kode-mono">{k.kode}</span>
                </td>
                <td>
                  <b>{k.nama}</b>
                  {k.keterangan && <div className="hint">{k.keterangan}</div>}
                </td>
                <td className="angka">{k.nomor_urut_terakhir}</td>
                <td className="angka">{k.jml_barang}</td>
                <td>
                  <StatusAktif aktif={k.aktif} />
                </td>
                <td className="nowrap">
                  <Tombol varian="outline" onClick={() => mulaiUbah(k)}>
                    Ubah
                  </Tombol>{' '}
                  {k.aktif === 1 ? (
                    <Tombol varian="ghost" onClick={() => nonaktifkan(k.id, k.kode)}>
                      Nonaktif
                    </Tombol>
                  ) : (
                    <Tombol varian="outline" onClick={() => aktifkanKembali(k.id, k.kode)}>
                      Aktifkan
                    </Tombol>
                  )}
                </td>
              </tr>
            ))}
            {tampil.length === 0 && (
              <tr>
                <td colSpan={6} className="kosong">
                  {cari
                    ? 'Tidak ada kode barang yang cocok.'
                    : 'Belum ada kode barang. Klik "+ Tambah Kode Barang" untuk mulai.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="infobox">
        Satu baris = satu pola kode (prefix + counter-nya sendiri). <span className="kode-mono">kode</span>{' '}
        unik global, pola <span className="kode-mono">[A-Z0-9-]</span>, 1–10 karakter. Counter hanya
        naik lewat pembuatan barang (atomik) — tidak bisa diedit manual. Kode nonaktif hilang dari
        dropdown form barang, tetapi barang lama tetap utuh.
      </div>
      <LabelForm>{editId === null ? 'Kode Barang Baru' : 'Ubah Kode Barang'}</LabelForm>
      <div className="form-grid">
        <div>
          <LabelForm>Kode (prefix)</LabelForm>
          <Input
            value={kode}
            onChange={(e) => ubahKodeInput(e.target.value)}
            placeholder="cth: BRG-"
            maxLength={10}
            disabled={editId !== null && editPernahDipakai}
          />
          {galatKode && <div className="teks-galat">{galatKode}</div>}
          {editId !== null && editPernahDipakai && (
            <div className="hint">Kode tidak bisa diubah — sudah dipakai barang (historis).</div>
          )}
          {!(editId !== null && editPernahDipakai) && !galatKode && (
            <div className="hint">Huruf kapital, angka, strip — tanpa spasi. Unik global.</div>
          )}
        </div>
        <div>
          <LabelForm>Nama Tampilan</LabelForm>
          <Input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth: Kode umum"
            maxLength={50}
          />
        </div>
      </div>
      <LabelForm>Keterangan (opsional)</LabelForm>
      <textarea
        className="textarea"
        value={keterangan}
        onChange={(e) => setKeterangan(e.target.value)}
        maxLength={200}
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
