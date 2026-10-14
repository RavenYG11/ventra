// Layar login Ventra (Template B).
// Alur: setup awal (buat akun) → login → lupa password (username-check → reset unrestricted).
import { useEffect, useState } from 'react';
import { Input, LabelForm, PesanGalat, PesanSukses, Tombol } from '../components/ui';
import {
  apakahButuhSetupAwal,
  cekUsernameUntukReset,
  daftarAkunPertama,
  masuk,
  setelUlangKataSandi,
} from '../features/pengguna/service-login';
import { salinDetailTeknis } from '../lib/db';

type Mode = 'memuat' | 'setup' | 'login' | 'lupa' | 'reset';

export default function LoginPage({ onMasuk }: { onMasuk: (nama: string) => void }) {
  const [mode, setMode] = useState<Mode>('memuat');
  const [nama, setNama] = useState('');
  const [sandi, setSandi] = useState('');
  const [sandi2, setSandi2] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  useEffect(() => {
    apakahButuhSetupAwal()
      .then((butuh) => setMode(butuh ? 'setup' : 'login'))
      .catch((e) => {
        // PENTING: jangan diam di mode 'memuat' — tampilkan galat + tombol muat ulang.
        setGalat(
          'Gagal membuka database: ' + (e instanceof Error ? e.message : String(e))
        );
      });
  }, []);

  function resetForm() {
    setNama('');
    setSandi('');
    setSandi2('');
    setGalat(null);
    setSukses(null);
  }

  async function handleSetup() {
    setGalat(null);
    if (sandi !== sandi2) {
      setGalat('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setSibuk(true);
    const hasil = await daftarAkunPertama(nama, sandi);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal membuat akun.');
      return;
    }
    resetForm();
    setMode('login');
    setSukses('Akun berhasil dibuat. Silakan masuk.');
  }

  async function handleMasuk() {
    setGalat(null);
    setSibuk(true);
    const hasil = await masuk(nama, sandi);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal masuk.');
      return;
    }
    onMasuk(nama.trim().toLowerCase());
  }

  async function handleCekUsername() {
    setGalat(null);
    setSibuk(true);
    const ada = await cekUsernameUntukReset(nama);
    setSibuk(false);
    if (!ada) {
      // Pesan generik — tidak membocorkan username mana yang terdaftar.
      setGalat('Periksa kembali nama pengguna Anda.');
      return;
    }
    setSandi('');
    setSandi2('');
    setMode('reset');
  }

  async function handleReset() {
    setGalat(null);
    if (sandi !== sandi2) {
      setGalat('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setSibuk(true);
    const hasil = await setelUlangKataSandi(nama, sandi);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.galat ?? 'Gagal mereset kata sandi.');
      return;
    }
    resetForm();
    setMode('login');
    setSukses('Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.');
  }

  if (mode === 'memuat') {
    return (
      <div className="login-wrap">
        <div className="panel kosong">
          {galat ? (
            <>
              <PesanGalat pesan={galat} />
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Tombol onClick={() => window.location.reload()}>Muat ulang</Tombol>
                <Tombol
                  onClick={async () => {
                    const ok = await salinDetailTeknis();
                    setTersalin(ok);
                  }}
                >
                  {tersalin ? 'Tersalin!' : 'Salin detail teknis'}
                </Tombol>
              </div>
            </>
          ) : (
            'Memuat…'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">VENTRA</div>
        <div className="box-info">
          Aplikasi stock barang — offline, satu akun, satuan pcs. Data tersimpan lokal di laptop ini.
        </div>

        <PesanGalat pesan={galat} />
        <PesanSukses pesan={sukses} />

        {mode === 'setup' && (
          <>
            <LabelForm>Nama Pengguna (Akun Baru)</LabelForm>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: rama" />
            <LabelForm>Kata Sandi</LabelForm>
            <Input
              type="password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
            <LabelForm>Konfirmasi Kata Sandi</LabelForm>
            <Input
              type="password"
              value={sandi2}
              onChange={(e) => setSandi2(e.target.value)}
              placeholder="Ulangi kata sandi"
            />
            <div style={{ marginTop: 18 }}>
              <Tombol varian="utama" blok disabled={sibuk} onClick={handleSetup}>
                {sibuk ? 'Menyimpan…' : 'Buat Akun'}
              </Tombol>
            </div>
          </>
        )}

        {mode === 'login' && (
          <>
            <LabelForm>Nama Pengguna</LabelForm>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama pengguna" />
            <LabelForm>Kata Sandi</LabelForm>
            <Input
              type="password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="Kata sandi"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMasuk();
              }}
            />
            <div style={{ marginTop: 18 }}>
              <Tombol varian="utama" blok disabled={sibuk} onClick={handleMasuk}>
                {sibuk ? 'Memeriksa…' : 'Masuk'}
              </Tombol>
            </div>
            <span
              className="link-lupa"
              onClick={() => {
                resetForm();
                setMode('lupa');
              }}
            >
              Lupa password?
            </span>
          </>
        )}

        {mode === 'lupa' && (
          <>
            <LabelForm>Nama Pengguna Akun</LabelForm>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama pengguna"
            />
            <div className="hint">Sistem akan memeriksa apakah akun terdaftar.</div>
            <div style={{ marginTop: 18 }}>
              <Tombol varian="utama" blok disabled={sibuk} onClick={handleCekUsername}>
                {sibuk ? 'Memeriksa…' : 'Lanjut'}
              </Tombol>
            </div>
            <span
              className="link-lupa"
              onClick={() => {
                resetForm();
                setMode('login');
              }}
            >
              Kembali ke login
            </span>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="box-info">
              Akun <b>{nama.trim().toLowerCase()}</b> terdaftar. Silakan buat kata sandi baru.
            </div>
            <LabelForm>Kata Sandi Baru</LabelForm>
            <Input
              type="password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
            <LabelForm>Konfirmasi Kata Sandi Baru</LabelForm>
            <Input
              type="password"
              value={sandi2}
              onChange={(e) => setSandi2(e.target.value)}
              placeholder="Ulangi kata sandi baru"
            />
            <div style={{ marginTop: 18 }}>
              <Tombol varian="utama" blok disabled={sibuk} onClick={handleReset}>
                {sibuk ? 'Menyimpan…' : 'Set Kata Sandi Baru'}
              </Tombol>
            </div>
          </>
        )}

        <div className="hint-bawah">Satu akun · satuan pcs · 100% offline</div>
      </div>
    </div>
  );
}
