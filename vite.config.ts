import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  // Tauri : la console du CLI reste lisible pendant `tauri dev`.
  clearScreen: false,
  server: {
    // 0.0.0.0 pour l'aperçu Arena / accès réseau ; jamais de allowlist d'hôte stricte.
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      // Le moteur Rust est reconstruit par son propre outil de compilation.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    // Cible WebView2 (Chromium) embarquée dans Tauri 2.
    target: 'chrome105',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
})
