import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VIDEOSEC frontend - proxies /api calls to the Flask backend on :5000
// so the browser never needs CORS trickery in dev mode.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
