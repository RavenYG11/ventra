// Ventra Simple — root aplikasi: Login → Daftar Barang. Tanpa tab navigasi.
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import BarangPage from './pages/BarangPage';
import { keluar, sesiAktif } from './features/pengguna/service-login';

export default function App() {
  const [pengguna, setPengguna] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        <div style={{ marginLeft: 'auto' }}>
          <span className="akun">1 AKUN: {pengguna.toUpperCase()}</span>{' '}
          <span className="link-keluar" onClick={handleKeluar}>
            KELUAR
          </span>
        </div>
      </header>

      <BarangPage namaPengguna={pengguna} tampilToast={setToast} />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
