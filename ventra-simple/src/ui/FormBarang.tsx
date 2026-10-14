// Form "Tambah Barang" — dengan pratinjau hitungan otomatis (mockup #36).
//
// Validasi: validasiBarangBaru() untuk aturan umum; keunikan nama dicek di
// lapisan penyimpanan (pesan galatnya ditampilkan di sini bila dilempar).

import { useState } from 'react';
import type { BarangBaru } from '../model';
import { validasiBarangBaru, rupiah } from '../model';

interface Props {
  onTambah: (input: BarangBaru) => Promise<void>;
}

function keAngka(teks: string): number {
  const n = Number(teks);
  return Number.isFinite(n) ? n : NaN;
}

export function FormBarang({ onTambah }: Props) {
  const [nama, setNama] = useState('');
  const [stok, setStok] = useState('0');
  const [hargaBeli, setHargaBeli] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [galatNama, setGalatNama] = useState('');
  const [galatStok, setGalatStok] = useState('');
  const [galatBeli, setGalatBeli] = useState('');
  const [galatJual, setGalatJual] = useState('');
  const [galatUmum, setGalatUmum] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const beli = keAngka(hargaBeli);
  const jual = keAngka(hargaJual);
  const stokAwal = keAngka(stok);
  const pratinjauSiap = hargaBeli.trim() !== '' && hargaJual.trim() !== '';

  async function simpan(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setGalatUmum('');
    const input: BarangBaru = { nama: nama.trim(), stokAwal, hargaBeli: beli, hargaJual: jual };
    const daftarGalat = validasiBarangBaru(input);

    // Petakan pesan ke field-nya masing-masing (berdasarkan kata kunci).
    setGalatNama(daftarGalat.find((g) => g.startsWith('Nama')) ?? '');
    setGalatStok(daftarGalat.find((g) => g.startsWith('Stok')) ?? '');
    setGalatBeli(daftarGalat.find((g) => g.startsWith('Harga beli')) ?? '');
    setGalatJual(daftarGalat.find((g) => g.startsWith('Harga jual')) ?? '');
    if (daftarGalat.length > 0) return;

    setMenyimpan(true);
    try {
      await onTambah(input);
      setNama('');
      setStok('0');
      setHargaBeli('');
      setHargaJual('');
    } catch (err) {
      // Mis. nama duplikat dari lapisan penyimpanan.
      setGalatUmum(err instanceof Error ? err.message : String(err));
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <section className="panel" aria-label="Tambah barang">
      <h2>
        <span className="accent">＋</span> Tambah Barang
      </h2>
      <form onSubmit={simpan} noValidate>
        <div className="fgrid4">
          <div>
            <label className="flabel" htmlFor="fNama">Nama Barang</label>
            <input
              type="text" id="fNama" placeholder="cth: Kopi Sachet 20g"
              autoComplete="off" value={nama}
              onChange={(e) => setNama(e.target.value)}
              className={galatNama ? 'bad' : ''}
            />
            <div className="fielderr">{galatNama}</div>
          </div>
          <div>
            <label className="flabel" htmlFor="fStok">Stok (pcs)</label>
            <input
              type="number" id="fStok" min={0} step={1} value={stok}
              onChange={(e) => setStok(e.target.value)}
              className={galatStok ? 'bad' : ''}
            />
            <div className="fielderr">{galatStok}</div>
          </div>
          <div>
            <label className="flabel" htmlFor="fBeli">Harga Beli (Rp)</label>
            <input
              type="number" id="fBeli" min={0} step={1} placeholder="0" value={hargaBeli}
              onChange={(e) => setHargaBeli(e.target.value)}
              className={galatBeli ? 'bad' : ''}
            />
            <div className="hint">{hargaBeli.trim() === '' ? '' : rupiah(beli || 0)}</div>
            <div className="fielderr">{galatBeli}</div>
          </div>
          <div>
            <label className="flabel" htmlFor="fJual">Harga Jual (Rp)</label>
            <input
              type="number" id="fJual" min={0} step={1} placeholder="0" value={hargaJual}
              onChange={(e) => setHargaJual(e.target.value)}
              className={galatJual ? 'bad' : ''}
            />
            <div className="hint">{hargaJual.trim() === '' ? '' : rupiah(jual || 0)}</div>
            <div className="fielderr">{galatJual}</div>
          </div>
        </div>

        <div className="preview" aria-live="polite">
          {!pratinjauSiap ? (
            'Isi harga beli & jual untuk melihat hitungan otomatis.'
          ) : (
            <>
              Modal per pcs: <b>{rupiah(beli || 0)}</b> &nbsp;·&nbsp;{' '}
              <span className="laba">
                Laba per pcs: <b>{rupiah((jual || 0) - (beli || 0))}</b>
              </span>{' '}
              &nbsp;·&nbsp; Nilai stok item ini: <b>{rupiah((stokAwal || 0) * (beli || 0))}</b>
            </>
          )}
        </div>

        {galatUmum && <div className="errorbox on">{galatUmum}</div>}

        <div className="actions">
          <button type="submit" className="btn amber grow" disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : '💾 Simpan Barang'}
          </button>
        </div>
      </form>
    </section>
  );
}
