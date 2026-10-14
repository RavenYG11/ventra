// Tab 3 — Mapping kategori <-> kode barang (M:N fleksibel penuh, Q2).
// Dikelola terpisah sesuai permintaan Rama ("integrasi kode barang dengan
// kategori itu juga beda sendiri"). Daftar "Tersedia" = semua kode AKTIF
// yang belum terhubung ke kategori ini — termasuk yang sudah dipakai
// kategori lain (ditandai "juga dipakai: ..."). Aturan Q4: mapping aktif
// TERAKHIR tidak boleh dilepas.
import { useEffect, useState } from 'react';
import { LabelForm, PesanGalat, Tombol } from '../../components/ui';
import {
  daftarKategoriDenganRingkasan,
  type KategoriRingkasan,
} from '../../features/kategori/service-kategori';
import {
  hubungkanKode,
  lepasKode,
  muatInfoMapping,
  type InfoMapping,
} from '../../features/kode-barang/service-kode-barang';
import { StatusAktif } from './komponen';

export default function TabMapping({ tampilToast }: { tampilToast: (p: string) => void }) {
  const [kategori, setKategori] = useState<KategoriRingkasan[]>([]);
  const [kategoriId, setKategoriId] = useState(0);
  const [info, setInfo] = useState<InfoMapping | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    daftarKategoriDenganRingkasan().then((d) => {
      const aktif = d.filter((k) => k.aktif === 1);
      setKategori(aktif);
      if (aktif.length > 0) setKategoriId(aktif[0].id);
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
  const terhubung = info?.terhubung ?? [];
  const tersedia = info?.tersedia ?? [];
  const tanpaKodeAktif = terhubung.filter((k) => k.aktif === 1).length === 0;

  return (
    <div>
      <PesanGalat pesan={galat} />
      <LabelForm>Pilih Kategori</LabelForm>
      <select
        className="select"
        value={kategoriId}
        onChange={(e) => setKategoriId(Number(e.target.value))}
      >
        {kategori.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
      <div className="infobox">
        Relasi <b>M:N fleksibel penuh</b>: 1 kategori boleh punya banyak kode barang, dan 1 kode
        barang boleh dipakai banyak kategori. Tidak bisa melepas mapping aktif <b>terakhir</b>.
      </div>
      {kategoriId > 0 && tanpaKodeAktif && (
        // QA #33-6: peringatan Q4 sebagai warnbox eksplisit (kuning), bukan
        // kotak merah galat — ini peringatan operasional, bukan error.
        <div className="warnbox">
          ⚠ KATEGORI "{namaKat.toUpperCase()}" BELUM PUNYA KODE BARANG AKTIF.
          <br />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Hubungkan minimal 1 dari daftar "Tersedia" — tanpa ini, barang baru tidak bisa dibuat
            untuk kategori ini.
          </span>
        </div>
      )}
      <div className="form-grid">
        <div>
          <LabelForm>
            Sudah terhubung — {namaKat} ({terhubung.length})
          </LabelForm>
          <div className="tabel-wrap">
            <table className="grid">
              <tbody>
                {terhubung.map((k) => (
                  <tr key={k.id} style={k.aktif === 0 ? { opacity: 0.55 } : undefined}>
                    <td>
                      <span className="kode-mono">{k.kode}</span>{' '}
                      <StatusAktif aktif={k.aktif} />
                      <div className="hint">{k.nama}</div>
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <Tombol varian="ghost" onClick={() => lepas(k.id, k.kode)}>
                        Lepas
                      </Tombol>
                    </td>
                  </tr>
                ))}
                {terhubung.length === 0 && (
                  <tr>
                    <td className="kosong">Belum ada kode terhubung.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <LabelForm>Tersedia — belum terhubung ({tersedia.length})</LabelForm>
          <div className="tabel-wrap">
            <table className="grid">
              <tbody>
                {tersedia.map((k) => (
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
                {tersedia.length === 0 && (
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
