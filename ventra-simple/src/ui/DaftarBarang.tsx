// Daftar barang: pencarian live + tabel + badge status + aksi Beli/Jual/Hapus.
//
// Komponen ini TIDAK menyentuh database langsung — semua aksi diteruskan ke
// App melalui props (App yang memanggil PenyimpananBarang lalu me-refresh).

import { useState } from 'react';
import type { Barang } from '../model';
import { statusStok, rupiah, formatPcs } from '../model';
import { ModalJumlah } from './ModalJumlah';
import { DialogHapus } from './DialogHapus';

interface Props {
  daftar: Barang[];
  onBeli: (id: number, jumlah: number) => Promise<void>;
  onJual: (id: number, jumlah: number) => Promise<void>;
  onHapus: (id: number) => Promise<void>;
}

type ModalAktif =
  | { macam: 'jumlah'; barang: Barang; jenis: 'beli' | 'jual' }
  | { macam: 'hapus'; barang: Barang }
  | null;

function Badge({ stok }: { stok: number }) {
  const s = statusStok(stok);
  if (s === 'habis') return <span className="badge habis">Habis</span>;
  if (s === 'menipis') return <span className="badge menipis">⚠ Menipis</span>;
  return <span className="badge aman">Aman</span>;
}

export function DaftarBarang({ daftar, onBeli, onJual, onHapus }: Props) {
  const [kataKunci, setKataKunci] = useState('');
  const [modal, setModal] = useState<ModalAktif>(null);

  const q = kataKunci.trim().toLowerCase();
  const tampil = q === '' ? daftar : daftar.filter((b) => b.nama.toLowerCase().includes(q));

  return (
    <section className="panel" aria-label="Daftar barang">
      <h2>
        <span className="accent">▤</span> Daftar Barang
      </h2>
      <div className="toolbar">
        <input
          type="text"
          placeholder="CARI: nama barang…"
          autoComplete="off"
          aria-label="Cari barang"
          value={kataKunci}
          onChange={(e) => setKataKunci(e.target.value)}
        />
      </div>
      <div className="tscroll">
        <table className="grid" aria-label="Tabel barang">
          <thead>
            <tr>
              <th scope="col">No</th>
              <th scope="col">Nama Barang</th>
              <th scope="col" className="num">Stok (pcs)</th>
              <th scope="col" className="num">Harga Beli</th>
              <th scope="col" className="num">Harga Jual</th>
              <th scope="col" className="num">Nilai Stok</th>
              <th scope="col">Status</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((b, i) => {
              const s = statusStok(b.stok);
              return (
                <tr key={b.id} className={s === 'aman' ? '' : 'low'}>
                  <td>{i + 1}</td>
                  <td className="nama">{b.nama}</td>
                  <td className="stokcell">{formatPcs(b.stok)}</td>
                  <td className="num">{rupiah(b.hargaBeli)}</td>
                  <td className="num">{rupiah(b.hargaJual)}</td>
                  <td className="num">{rupiah(b.stok * b.hargaBeli)}</td>
                  <td><Badge stok={b.stok} /></td>
                  <td>
                    <div className="aksi">
                      <button
                        type="button" className="btn green sm"
                        onClick={() => setModal({ macam: 'jumlah', barang: b, jenis: 'beli' })}
                      >
                        ⬆ Beli
                      </button>
                      <button
                        type="button" className="btn red sm"
                        disabled={b.stok === 0}
                        onClick={() => setModal({ macam: 'jumlah', barang: b, jenis: 'jual' })}
                      >
                        ⬇ Jual
                      </button>
                      <button
                        type="button" className="btn ghost sm"
                        onClick={() => setModal({ macam: 'hapus', barang: b })}
                      >
                        🗑 Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {daftar.length === 0 && (
          <div className="empty">Belum ada barang. Tambahkan lewat form di atas.</div>
        )}
        {daftar.length > 0 && tampil.length === 0 && (
          <div className="empty">Tidak ada barang yang cocok dengan pencarian.</div>
        )}
      </div>

      {modal?.macam === 'jumlah' && (
        <ModalJumlah
          barang={modal.barang}
          jenis={modal.jenis}
          onTutup={() => setModal(null)}
          onSimpan={(jumlah) =>
            modal.jenis === 'beli' ? onBeli(modal.barang.id, jumlah) : onJual(modal.barang.id, jumlah)
          }
        />
      )}
      {modal?.macam === 'hapus' && (
        <DialogHapus
          barang={modal.barang}
          onTutup={() => setModal(null)}
          onYa={() => onHapus(modal.barang.id)}
        />
      )}
    </section>
  );
}
