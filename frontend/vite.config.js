import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Gioco-delle-Coppie/',
  server: {
    port: 5173,
    proxy: {
      // In sviluppo locale, proxy /api → backend Express su porta 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
