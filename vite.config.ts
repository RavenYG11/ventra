import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Konfigurasi Vite untuk Ventra edisi WEB (lihat README.md).
// Hasil `npm run build` berupa file statis di dist/ yang bisa diserve
// dari path mana pun — termasuk subpath XAMPP (http://localhost/ventra).
export default defineConfig({
  plugins: [react()],
  // base './' → semua URL aset (JS/CSS/WASM) relatif terhadap index.html,
  // jadi aplikasi tetap jalan walau diserve dari subpath, bukan root domain.
  base: './',
  build: {
    target: 'es2021',
  },
  server: {
    // Header COOP/COEP — WAJIB ADA, jangan dihapus (pelajaran 2026-10-14).
    // Alasan: (1) VFS opfs-sahpool memakai SharedArrayBuffer + Atomics untuk
    // koordinasi sinkron → butuh cross-origin isolation; (2) Chrome MENOLAK
    // memuat Web Worker bila dokumen terisolasi tetapi script worker tidak
    // membawa header COEP yang cocok — penolakannya berupa ErrorEvent KOSONG
    // (pesan "", file unknown) sehingga mustahil didiagnosis tanpa ini.
    // Vite menerapkan server.headers ke SEMUA respons dev termasuk worker.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    // Format ES module untuk Web Worker database (src/lib/db-worker.ts) —
    // pola resmi Vite untuk `new Worker(new URL('./x.ts', import.meta.url))`.
    format: 'es',
  },
});
