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
  // Catatan: header COOP/COEP SENGAJA tidak dipasang. VFS opfs-sahpool
  // yang dipakai Ventra tidak mewajibkannya
  // (sqlite.org/wasm/doc/trunk/persistence.md), dan COEP require-corp
  // berisiko memblokir pemuatan sqlite3.wasm di dev server.
});
