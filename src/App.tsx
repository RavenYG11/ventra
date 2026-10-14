// Ventra — root aplikasi.
// v0.1: login → daftar barang. Dashboard & transaksi menyusul di v0.2.
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import BarangPage from './pages/BarangPage';
import { keluar, sesiAktif } from './features/pengguna/service-login';

export default function App() {
  const [pengguna, setPengguna] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<'barang'>('barang');

  useEffect(() => {
    setPengguna(sesiAktif());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function handleKeluar() {
    keluar();
    setPengguna(null);
  }

  if (!pengguna) {
    return <LoginPage onMasuk={(nama) => setPengguna(nama)} />;
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          VENTRA<small>STOCK BARANG</small>
        </div>
        <nav className="tabs">
          <button className={'tab aktif'} onClick={() => setTab('barang')}>
            Barang
          </button>
          <button className="tab" disabled title="Segera hadir di v0.2">
            Transaksi
          </button>
        </nav>
        <div>
          <span className="akun">1 AKUN: {pengguna.toUpperCase()}</span>{' '}
          <span className="link-keluar" onClick={handleKeluar}>
            KELUAR
          </span>
        </div>
      </header>

      {tab === 'barang' && <BarangPage tampilToast={setToast} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
