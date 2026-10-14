// Deklarasi agar TypeScript menerima import file SQL mentah via Vite:
//   import skema from "../../migrasi/ventra-simple.sql?raw";
// Isi file SQL disisipkan sebagai string saat build (tetap offline).
declare module "*.sql?raw" {
  const isi: string;
  export default isi;
}
