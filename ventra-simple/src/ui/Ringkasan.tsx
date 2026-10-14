// Kartu ringkasan otomatis — selalu dihitung ulang dari daftar barang terbaru
// via hitungRingkasan() (src/ringkasan.ts). Tidak menyimpan state sendiri.

import type { Ringkasan as DataRingkasan } from '../ringkasan';
import { rupiah, formatPcs } from '../model';

export function Ringkasan({ data }: { data: DataRingkasan }) {
  return (
    <section className="cards" aria-label="Ringkasan">
      <div className="card">
        <div className="lbl">Total Jenis</div>
        <div className="val">{formatPcs(data.jenis)}</div>
        <div className="note">{formatPcs(data.totalPcs)} pcs keseluruhan</div>
      </div>
      <div className="card green">
        <div className="lbl">Nilai Stok</div>
        <div className="val rp">{rupiah(data.nilaiStok)}</div>
        <div className="note">Dihitung dari harga beli</div>
      </div>
      <div className="card amber">
        <div className="lbl">Potensi Laba</div>
        <div className="val rp">{rupiah(data.potensiLaba)}</div>
        <div className="note">Jika seluruh stok terjual</div>
      </div>
      <div className="card red">
        <div className="lbl">Stok Menipis</div>
        <div className="val">{formatPcs(data.menipis)}</div>
        <div className="note">
          {formatPcs(data.habis)} habis · ambang ≤ 5 pcs
        </div>
      </div>
    </section>
  );
}
