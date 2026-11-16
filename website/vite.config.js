import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Mode AR (WebXR) butuh HTTPS di HP. Lewat tunnel (cloudflared/ngrok) host-nya
  // berubah-ubah, jadi izinkan semua host pada dev server. Lihat docs/ar.md.
  server: {
    host: true,
    allowedHosts: true,
  },
});
