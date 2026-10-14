// Komponen kecil bersama untuk tab-tab Product Management.
import type { KodeBarang } from '../../types';

/** Badge status Aktif / Nonaktif (Template B). */
export function StatusAktif({ aktif }: { aktif: number }) {
  return aktif === 1 ? (
    <span className="status-aktif">Aktif</span>
  ) : (
    <span className="status-nonaktif">Nonaktif</span>
  );
}

/** Deretan chip pola kode (cth. ELK-, BRG-) — seperti mockup Prapto. */
export function ChipKode({ daftar }: { daftar: KodeBarang[] }) {
  if (daftar.length === 0) return <span className="status-nonaktif">—</span>;
  return (
    <>
      {daftar.map((k) => (
        <span key={k.id} className="chip" title={k.nama}>
          {k.kode}
        </span>
      ))}
    </>
  );
}
