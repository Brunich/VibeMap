import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El proxy sólo hace falta para «Explicar con IA» (servidor opcional en el puerto 3000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
