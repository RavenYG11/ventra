import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Header COOP/COEP WAJIB untuk SQLite OPFS SAH pool (memakai SharedArrayBuffer).
//
// Pelajaran 2026-10-14 (insiden VDB-W01, assignment #21–#23): menghapus header
// ini membuat worker SQLite DITOLAK browser secara diam-diam — dokumen
// terisolasi (COEP) tetapi script worker diserve tanpa COEP → ErrorEvent
// bermessage kosong, console bersih. Jangan dihapus tanpa pengganti.
export default defineConfig({
  plugins: [react()],
  // base './' agar hasil build bisa diserve dari subfolder (XAMPP: /ventra-simple).
  base: './',
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
