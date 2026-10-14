// Modal Beli / Jual — stepper jumlah ala mockup Prapto #36.
//
// Props:
//   barang — barang yang ditransaksikan
//   jenis  — 'beli' (tambah stok) atau 'jual' (kurang stok)
//   onTutup — batal / klik backdrop / Escape
//   onSimpan(jumlah) — dipanggil saat Simpan; melempar Error bila ditolak
//     (mis. jual melebihi stok) → pesan ditampilkan di dalam modal.

import { useState } from 'react';
import type { Barang } from '../model';
import { rupiah, formatPcs } from '../model';

interface Props {
  barang: Barang;
  jenis: 'beli' | 'jual';
  onTutup: () => void;
  onSimpan: (jumlah: number) => Promise<void>;
}

export function ModalJumlah({ barang, jenis, onTutup, onSimpan }: Props) {
  const [jumlah, setJumlah] = useState('1');
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const adalahBeli = jenis === 'beli';
  const judul = (adalahBeli ? '⬆ Beli — ' : '⬇ Jual — ') + barang.nama.toUpperCase();

  function ubahJumlah(teks: string): void {
    setJumlah(teks);
    setGalat('');
  }

  async function simpan(): Promise<void> {
    const qty = Number(jumlah);
    if (!Number.isInteger(qty) || qty < 1) {
      setGalat('JUMLAH MINIMAL 1 PCS (BILANGAN BULAT).');
      return;
    }
    setMenyimpan(true);
    try {
      await onSimpan(qty);
      onTutup();
    } catch (err) {
      setGalat(String(err instanceof Error ? err.message : err).toUpperCase());
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div
      className="mback"
      onClick={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onTutup();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={judul}>
        <h3 className={jenis}>{judul}</h3>
        <p className="info">
          Stok saat ini: <b>{formatPcs(barang.stok)} pcs</b> · Harga{' '}
          {adalahBeli ? 'beli' : 'jual'}: <b>{rupiah(adalahBeli ? barang.hargaBeli : barang.hargaJual)}</b>/pcs
        </p>
        <label className="flabel" htmlFor="mQty">Jumlah (pcs)</label>
        <div className="stepper">
          <button
            type="button" aria-label="Kurangi"
            onClick={() => ubahJumlah(String(Math.max(1, (Number(jumlah) || 1) - 1)))}
          >
            −
          </button>
          <input
            type="number" id="mQty" min={1} step={1} value={jumlah}
            onChange={(e) => ubahJumlah(e.target.value)}
            // autoFocus: gantikan mQty.focus() imperatif dari mockup
            autoFocus
          />
          <button
            type="button" aria-label="Tambah"
            onClick={() => ubahJumlah(String((Number(jumlah) || 0) + 1))}
          >
            +
          </button>
        </div>
        <div className={`errorbox${galat ? ' on' : ''}`}>{galat}</div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onTutup}>
            Batal
          </button>
          <button
            type="button"
            className={`btn grow ${adalahBeli ? 'green' : 'red'}`}
            onClick={simpan}
            disabled={menyimpan}
          >
            {menyimpan ? 'Menyimpan…' : adalahBeli ? '⬆ Simpan Beli' : '⬇ Simpan Jual'}
          </button>
        </div>
      </div>
    </div>
  );
}
