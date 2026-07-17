import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Proxy target: the Django dev server. Inside Docker Compose this is the
// "django" service (set via VITE_PROXY_TARGET); locally it's localhost:8000.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'
// Running inside a container — file watching needs polling for HMR to work.
const inDocker = Boolean(process.env.VITE_PROXY_TARGET)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: inDocker ? { usePolling: true } : undefined,
    proxy: {
      // Same-origin "/api/..." paths -> Django (no CORS needed in dev).
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})
