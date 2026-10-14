// Dialog konfirmasi hapus barang.
//
// Hapus bersifat permanen (hard delete) — konfirmasi SELALU muncul dulu
// (acceptance spec v2 F2). "Batal" / klik backdrop / Escape = tidak jadi.

import type { Barang } from '../model';

interface Props {
  barang: Barang;
  onTutup: () => void;
  onYa: () => Promise<void>;
}

export function DialogHapus({ barang, onTutup, onYa }: Props) {
  async function ya(): Promise<void> {
    await onYa();
    onTutup();
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
      <div className="modal" role="dialog" aria-modal="true" aria-label="Konfirmasi hapus">
        <h3 className="hapus">🗑 Hapus Barang</h3>
        <p className="info">
          Hapus <b>{barang.nama}</b> (stok <b>{barang.stok} pcs</b>)?
          <br />
          Tindakan ini tidak bisa dibatalkan.
        </p>
        <div className="actions">
          <button type="button" className="btn ghost grow" onClick={onTutup} autoFocus>
            Batal
          </button>
          <button type="button" className="btn red grow" onClick={ya}>
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
