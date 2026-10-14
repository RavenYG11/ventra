// Menu Product Management: CRUD kategori, kode barang, dan mapping keduanya.
// Keputusan final Rama (14 Okt 2026): Q1 nama menu; Q2 relasi M:N fleksibel;
// Q3 dropdown auto-fill bila 1; Q4 kategori wajib >=1 kode barang aktif.
// Acuan visual mengikat: docs/mockup-product-management.html (Prapto).
import { useEffect, useState } from 'react';
import type { KodeBarang } from '../types';
import { Input, LabelForm, PesanGalat, Tombol } from '../components/ui';
import {
  buatKategori,
  daftarKategoriDenganRingkasan,
  hapusKategori,
  suntingKategori,
  type KategoriRingkasan,
} from '../features/kategori/service-kategori';
import {
  buatKodeBarang,
  daftarKodeRingkasan,
  petaKodePerKategori,
  hapusKodeBarang,
  hubungkanKode,
  lepasKode,
  muatInfoMapping,
  suntingKodeBarang,
  type InfoMapping,
  type KodeBarangRingkasan,
} from '../features/kode-barang/service-kode-barang';

type SubTab = 'kategori' | 'kode' | 'mapping';

function StatusAktif({ aktif }: { aktif: number }) {
  return aktif === 1 ? (
    <span className="status-aktif">Aktif</span>
  ) : (
    <span className="status-nonaktif">Nonaktif</span>
  );
}

function ChipKode({ daftar }: { daftar: KodeBarang[] }) {
  if (daftar.length === 0) return <span className="status-nonaktif">—</span>;
  return (
    <>
      {daftar.map((k) => (
        <span key={k.id} className="chip" title={k.nama}>
          {k.kode}
        </span>
      ))}
    </>
  );
}

export default function ProductManagementPage({
  tampilToast,
}: {
  tampilToast: (pesan: string) => void;
}) {
  const [sub, setSub] = useState<SubTab>('kategori');

  return (
    <div className="layar">
      <h2 className="judul-layar">Product Management</h2>
      <div className="hint" style={{ marginBottom: 12 }}>
        Kelola komponen barang: kategori, kode barang, dan relasi keduanya (M:N fleksibel).
      </div>
      <div className="subtabs">
        <button className={sub === 'kategori' ? 'subtab aktif' : 'subtab'} onClick={() => setSub('kategori')}>
          Kategori
        </button>
        <button className={sub === 'kode' ? 'subtab aktif' : 'subtab'} onClick={() => setSub('kode')}>
          Kode Barang
        </button>
        <button className={sub === 'mapping' ? 'subtab aktif' : 'subtab'} onClick={() => setSub('mapping')}>
          Mapping
        </button>
      </div>
      {sub === 'kategori' && <TabKategori tampilToast={tampilToast} />}
      {sub === 'kode' && <TabKode tampilToast={tampilToast} />}
      {sub === 'mapping' && <TabMapping tampilToast={tampilToast} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Kategori (form hanya nama; prefix pindah ke tab Kode Barang).
// ---------------------------------------------------------------------------

function TabKategori({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [daftar, setDaftar] = useState<KategoriRingkasan[]>([]);
  const [petaKode, setPetaKode] = useState<Record<number, KodeBarang[]>>({});
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

  return (
    <div>
      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <Tombol varian="utama" onClick={() => { batal(); window.scrollTo(0, document.body.scrollHeight); }}>
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
            {daftar.map((k) => (
              <tr key={k.id}>
                <td>
                  <b>{k.nama}</b>
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
                  {k.aktif === 1 && (
                    <Tombol varian="ghost" onClick={() => nonaktifkan(k.id, k.nama)}>
                      Nonaktif
                    </Tombol>
                  )}
                </td>
              </tr>
            ))}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={5} className="kosong">
                  Belum ada kategori. Klik "+ Tambah Kategori" untuk mulai.
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
      <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Elektronik" maxLength={50} />
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

// ---------------------------------------------------------------------------
// Tab 2 — Kode Barang (CRUD pola kode; counter read-only).
// ---------------------------------------------------------------------------

function TabKode({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [daftar, setDaftar] = useState<KodeBarangRingkasan[]>([]);
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editPernahDipakai, setEditPernahDipakai] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
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
  }

  function mulaiUbah(k: KodeBarangRingkasan) {
    setEditId(k.id);
    setKode(k.kode);
    setNama(k.nama);
    setKeterangan(k.keterangan ?? '');
    setEditPernahDipakai(k.jml_barang > 0);
    setGalat(null);
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

  return (
    <div>
      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <Tombol varian="utama" onClick={() => { batal(); }}>
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
            {daftar.map((k) => (
              <tr key={k.id}>
                <td>
                  <span className="kode-mono">{k.kode}</span>
                </td>
                <td>{k.nama}</td>
                <td className="angka">{k.nomor_urut_terakhir}</td>
                <td className="angka">{k.jml_barang}</td>
                <td>
                  <StatusAktif aktif={k.aktif} />
                </td>
                <td className="nowrap">
                  <Tombol varian="outline" onClick={() => mulaiUbah(k)}>
                    Ubah
                  </Tombol>{' '}
                  {k.aktif === 1 && (
                    <Tombol varian="ghost" onClick={() => nonaktifkan(k.id, k.kode)}>
                      Nonaktif
                    </Tombol>
                  )}
                </td>
              </tr>
            ))}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={6} className="kosong">
                  Belum ada kode barang. Klik "+ Tambah Kode Barang" untuk mulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="infobox">
        Satu baris = satu pola kode (prefix + counter-nya sendiri). <span className="kode-mono">kode</span> unik
        global, pola <span className="kode-mono">[A-Z0-9-]</span>, 1–10 karakter. Counter hanya naik lewat
        pembuatan barang (atomik) — tidak bisa diedit manual. Kode nonaktif hilang dari dropdown form
        barang, tetapi barang lama tetap utuh.
      </div>
      <LabelForm>{editId === null ? 'Kode Barang Baru' : 'Ubah Kode Barang'}</LabelForm>
      <div className="form-grid">
        <div>
          <LabelForm>Kode (prefix)</LabelForm>
          <Input
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder="cth: ELK-"
            maxLength={10}
            disabled={editId !== null && editPernahDipakai}
          />
          {editId !== null && editPernahDipakai && (
            <div className="hint">Kode tidak bisa diubah — sudah dipakai barang (historis).</div>
          )}
        </div>
        <div>
          <LabelForm>Nama Tampilan</LabelForm>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Kode umum" maxLength={50} />
        </div>
      </div>
      <LabelForm>Keterangan (opsional)</LabelForm>
      <textarea className="textarea" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
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

// ---------------------------------------------------------------------------
// Tab 3 — Mapping kategori <-> kode barang (M:N fleksibel).
// ---------------------------------------------------------------------------

function TabMapping({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [kategori, setKategori] = useState<KategoriRingkasan[]>([]);
  const [kategoriId, setKategoriId] = useState(0);
  const [info, setInfo] = useState<InfoMapping | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    daftarKategoriDenganRingkasan().then((d) => {
      setKategori(d);
      if (d.length > 0) setKategoriId(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (kategoriId) muatInfoMapping(kategoriId).then(setInfo).catch(() => {});
  }, [kategoriId]);

  async function hubungkan(kodeBarangId: number, kode: string) {
    setGalat(null);
    await hubungkanKode(kategoriId, kodeBarangId);
    tampilToast(`TERHUBUNG: ${kode}`);
    setInfo(await muatInfoMapping(kategoriId));
  }

  async function lepas(kodeBarangId: number, kode: string) {
    setGalat(null);
    const hasil = await lepasKode(kategoriId, kodeBarangId);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal melepas mapping.');
      return;
    }
    tampilToast(`DILEPAS: ${kode}`);
    setInfo(await muatInfoMapping(kategoriId));
  }

  const namaKat = kategori.find((k) => k.id === kategoriId)?.nama ?? '';

  return (
    <div>
      <PesanGalat pesan={galat} />
      <LabelForm>Pilih Kategori</LabelForm>
      <select className="select" value={kategoriId} onChange={(e) => setKategoriId(Number(e.target.value))}>
        {kategori.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
      <div className="infobox">
        Relasi <b>M:N fleksibel penuh</b>: 1 kategori boleh punya banyak kode barang, dan 1 kode barang boleh dipakai banyak kategori. Tidak bisa melepas mapping aktif <b>terakhir</b>.
      </div>
      <div className="form-grid">
        <div>
          <LabelForm>Sudah terhubung — {namaKat}</LabelForm>
          <div className="tabel-wrap">
            <table className="grid">
              <tbody>
                {(info?.terhubung ?? []).map((k) => (
                  <tr key={k.id}>
                    <td>
                      <span className="kode-mono">{k.kode}</span>
                      <div className="hint">{k.nama}</div>
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <Tombol varian="ghost" onClick={() => lepas(k.id, k.kode)}>
                        Lepas
                      </Tombol>
                    </td>
                  </tr>
                ))}
                {(info?.terhubung.length ?? 0) === 0 && (
                  <tr>
                    <td className="kosong">Belum ada kode terhubung.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <LabelForm>Tersedia (belum terhubung)</LabelForm>
          <div className="tabel-wrap">
            <table className="grid">
              <tbody>
                {(info?.tersedia ?? []).map((k) => (
                  <tr key={k.id}>
                    <td>
                      <span className="kode-mono">{k.kode}</span>
                      <div className="hint">{k.nama}</div>
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <Tombol varian="outline" onClick={() => hubungkan(k.id, k.kode)}>
                        Hubungkan
                      </Tombol>
                    </td>
                  </tr>
                ))}
                {(info?.tersedia.length ?? 0) === 0 && (
                  <tr>
                    <td className="kosong">Tidak ada kode tersedia.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
