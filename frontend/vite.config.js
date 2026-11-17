import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Flask API (backend/). It runs on 5001 because 5000 is taken by the
// formsflow web API container. Override with API_URL=... if needed.
// 127.0.0.1, not localhost: `flask run` listens on IPv4 only, and Node
// can resolve localhost to IPv6 (::1).
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:5001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser calls /api/... on the Vite dev server, which forwards it
    // to Flask - same origin, so no CORS setup is needed.
    proxy: {
      '/api': API_URL,
    },
  },
})
