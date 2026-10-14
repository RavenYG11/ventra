import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Konfigurasi Vite untuk Tauri 2 — lihat https://v2.tauri.app/start/frontend/vite-react/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
  },
});
