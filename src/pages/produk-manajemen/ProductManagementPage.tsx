// Menu Product Management: CRUD kategori, kode barang, dan mapping keduanya.
// Keputusan final Rama (14 Okt 2026): Q1 nama menu; Q2 relasi M:N fleksibel;
// Q3 dropdown auto-fill bila 1; Q4 kategori wajib >=1 kode barang aktif.
// Acuan visual mengikat: docs/mockup-product-management.html (Prapto).
import { useState } from 'react';
import TabKategori from './TabKategori';
import TabKodeBarang from './TabKodeBarang';
import TabMapping from './TabMapping';

type SubTab = 'kategori' | 'kode' | 'mapping';

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
        <button
          className={sub === 'kategori' ? 'subtab aktif' : 'subtab'}
          onClick={() => setSub('kategori')}
        >
          Kategori
        </button>
        <button className={sub === 'kode' ? 'subtab aktif' : 'subtab'} onClick={() => setSub('kode')}>
          Kode Barang
        </button>
        <button
          className={sub === 'mapping' ? 'subtab aktif' : 'subtab'}
          onClick={() => setSub('mapping')}
        >
          Mapping
        </button>
      </div>
      {sub === 'kategori' && <TabKategori tampilToast={tampilToast} />}
      {sub === 'kode' && <TabKodeBarang tampilToast={tampilToast} />}
      {sub === 'mapping' && <TabMapping tampilToast={tampilToast} />}
    </div>
  );
}
