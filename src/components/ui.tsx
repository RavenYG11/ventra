// Komponen UI bersama — gaya Template B (lihat styles.css).
import type { ReactNode } from 'react';
import type { StatusStok } from '../types';

type VarianTombol = 'utama' | 'masuk' | 'keluar' | 'outline' | 'ghost';

export function Tombol({
  varian = 'utama',
  blok = false,
  besar = false,
  children,
  ...rest
}: {
  varian?: VarianTombol;
  blok?: boolean;
  besar?: boolean;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const kelas = [
    'tombol',
    varian === 'utama' ? 'tombol-utama'
    : varian === 'masuk' ? 'tombol-masuk'
    : varian === 'keluar' ? 'tombol-keluar2'
    : varian === 'outline' ? 'tombol-outline'
    : 'tombol-ghost',
    blok ? 'tombol-blok' : '',
    besar ? 'tombol-besar' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={kelas} {...rest}>
      {children}
    </button>
  );
}

export function LabelForm({ children }: { children: ReactNode }) {
  return <label className="label-form">{children}</label>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function BadgeStok({ status }: { status: StatusStok }) {
  if (status === 'menipis') return <span className="badge badge-menipis">⚠ Menipis</span>;
  if (status === 'habis') return <span className="badge badge-habis">Habis</span>;
  return <span className="badge badge-aman">Aman</span>;
}

export function PesanGalat({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return <div className="pesan-galat">{pesan}</div>;
}

export function PesanSukses({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return <div className="pesan-sukses">{pesan}</div>;
}

export function Modal({
  judul,
  onTutup,
  children,
}: {
  judul: string;
  onTutup: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
    >
      <div className="modal">
        <h3>{judul}</h3>
        {children}
      </div>
    </div>
  );
}
