import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Set VITE_DEV_PROXY to a backend origin (e.g. http://3.110.160.88) to have the
// dev server forward /api same-origin — used with VITE_API_URL="" so the app
// makes relative requests. Unset → plain config, production builds unaffected.
export default defineConfig({
  plugins: [react()],
  server: process.env.VITE_DEV_PROXY
    ? { proxy: { '/api': { target: process.env.VITE_DEV_PROXY, changeOrigin: true } } }
    : undefined,
})
