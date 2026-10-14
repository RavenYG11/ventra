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
    // Header COOP/COEP untuk `npm run dev` — mengikuti pola demo resmi
    // sqlite-wasm (github.com/sqlite/sqlite-wasm, demos/sahpool-demo).
    // Catatan: VFS opfs-sahpool yang dipakai Ventra TIDAK mewajibkan
    // header ini (sqlite.org/wasm/doc/trunk/persistence.md), jadi deploy
    // XAMPP tanpa header tambahan tetap jalan.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
