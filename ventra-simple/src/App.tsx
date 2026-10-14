// Ventra Simple — komponen utama.
//
// Alur:
//   1. Boot: bukaPenyimpanan() → SQLite-OPFS, atau otomatis localStorage bila gagal.
//   2. Setiap aksi (tambah/beli/jual/hapus) → tulis ke penyimpanan → muat ulang
//      daftar → ringkasan terhitung ulang otomatis.
//   3. Galat operasi → toast merah (pesan ramah, tanpa kode teknis).
//   4. Galat boot total → layar galat + tombol muat ulang (tidak pernah blank).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Barang, BarangBaru } from './model';
import { hitungRingkasan } from './ringkasan';
import type { PenyimpananBarang } from './db/kontrak';
import { GALAT_STOK_KURANG } from './db/kontrak';
import { bukaPenyimpanan } from './db/buka';
import { hapusSemuaDataLokal } from './db/lokal';
import { Ringkasan } from './ui/Ringkasan';
import { FormBarang } from './ui/FormBarang';
import { DaftarBarang } from './ui/DaftarBarang';
import './styles.css';

type Fase = 'memuat' | 'siap' | 'galat';

/** Ubah pesan teknis menjadi pesan ramah untuk pengguna. */
function ramahkanPesan(pesan: string): string {
  return pesan.replace(new RegExp('^' + GALAT_STOK_KURANG + ':\\s*'), '');
}

export function App() {
  const [fase, setFase] = useState<Fase>('memuat');
  const [db, setDb] = useState<PenyimpananBarang | null>(null);
  const [daftar, setDaftar] = useState<Barang[]>([]);
  const [galatBoot, setGalatBoot] = useState('');
  const [toast, setToast] = useState<{ teks: string; gagal: boolean } | null>(null);
  const timerToast = useRef<number | null>(null);

  const tampilToast = useCallback((teks: string, gagal = false) => {
    if (timerToast.current) window.clearTimeout(timerToast.current);
    setToast({ teks, gagal });
    timerToast.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const muatUlang = useCallback(async (penyimpanan: PenyimpananBarang) => {
    setDaftar(await penyimpanan.daftar());
  }, []);

  // Boot sekali saat aplikasi dibuka.
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const penyimpanan = await bukaPenyimpanan();
        if (batal) return;
        setDb(penyimpanan);
        await muatUlang(penyimpanan);
        if (!batal) setFase('siap');
      } catch (e) {
        if (!batal) {
          setGalatBoot(e instanceof Error ? e.message : String(e));
          setFase('galat');
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, [muatUlang]);

  /** Bungkus aksi tulis: eksekusi → refresh → toast sukses/gagal. */
  async function jalankan(aksi: (p: PenyimpananBarang) => Promise<string>): Promise<void> {
    if (!db) return;
    try {
      const pesan = await aksi(db);
      await muatUlang(db);
      tampilToast(pesan);
    } catch (e) {
      tampilToast('GAGAL: ' + ramahkanPesan(e instanceof Error ? e.message : String(e)), true);
    }
  }

  if (fase === 'memuat') {
    return (
      <div className="layar-tengah">
        <div className="kotak-status">
          <div className="spinner" aria-hidden="true" />
          <h2>Memuat Ventra Simple…</h2>
          <p>Membuka database lokal. Bila macet lebih dari 15 detik, aplikasi otomatis memakai penyimpanan cadangan.</p>
        </div>
      </div>
    );
  }

  if (fase === 'galat' || !db) {
    return (
      <div className="layar-tengah">
        <div className="kotak-status">
          <h2>⚠ Database tidak bisa dibuka</h2>
          <p>
            Baik SQLite-OPFS maupun penyimpanan cadangan gagal. Coba muat ulang halaman.
            Bila terus gagal, periksa apakah browser memblokir penyimpanan situs (mode private).
          </p>
          <div className="detail">{galatBoot || '(tidak ada detail)'}</div>
          <div className="actions">
            <button type="button" className="btn amber grow" onClick={() => window.location.reload()}>
              ⟲ Muat Ulang
            </button>
          </div>
          {galatBoot.includes('DATA_RUSAK') && (
            <div className="actions" style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn red grow"
                onClick={() => {
                  if (window.confirm('Hapus seluruh data lokal yang rusak dan mulai dari kosong?')) {
                    hapusSemuaDataLokal();
                    window.location.reload();
                  }
                }}
              >
                🗑 Hapus Data Rusak &amp; Mulai Kosong
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ringkasan = hitungRingkasan(daftar);
  const modeDarurat = db.namaBackend === 'localstorage';

  return (
    <>
      <header className="topbar">
        <div className="brand">
          VENTRA<small>MODE SEDERHANA</small>
        </div>
        <span className={`backendbadge ${modeDarurat ? 'lokal' : 'sqlite'}`}>
          {modeDarurat ? 'DB: LocalStorage' : 'DB: SQLite (OPFS)'}
        </span>
      </header>

      {modeDarurat && (
        <div className="banner-darurat" role="status">
          <b>Mode darurat:</b> database utama (SQLite-OPFS) tidak tersedia di browser ini,
          aplikasi memakai <b>localStorage</b>. Data tetap tersimpan, tetapi disarankan memakai
          Chrome/Edge mode normal agar database utama aktif.
        </div>
      )}

      <main>
        <h1 className="screen">Stok Barang</h1>
        <p className="sub">Tambah barang, catat beli / jual, dan pantau ringkasan — semua dalam satu layar.</p>

        <Ringkasan data={ringkasan} />

        <FormBarang
          onTambah={async (input: BarangBaru) => {
            await jalankan(async (p) => {
              const b = await p.tambah(input);
              return `TERSIMPAN: ${b.nama.toUpperCase()} × ${b.stok} PCS`;
            });
          }}
        />

        <DaftarBarang
          daftar={daftar}
          onBeli={(id, jumlah) =>
            jalankan(async (p) => {
              const b = await p.beli(id, jumlah);
              return `TERCATAT: BELI ${b.nama.toUpperCase()} × ${jumlah} PCS`;
            })
          }
          onJual={(id, jumlah) =>
            jalankan(async (p) => {
              const b = await p.jual(id, jumlah);
              return `TERCATAT: JUAL ${b.nama.toUpperCase()} × ${jumlah} PCS`;
            })
          }
          onHapus={(id) =>
            jalankan(async (p) => {
              await p.hapus(id);
              return 'BARANG DIHAPUS';
            })
          }
        />

        <div className="foot">
          Ventra Simple v0.1.0 — 1 tabel barang · stok tidak boleh negatif ·
          nilai stok = Σ(stok × harga beli) · potensi laba = Σ(stok × (harga jual − harga beli))
        </div>
      </main>

      {toast && <div className={`toast on${toast.gagal ? ' gagal' : ''}`} role="status">{toast.teks}</div>}
    </>
  );
}
