import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Flask API (backend/). It runs on 5001 because 5000 is taken by the
// formsflow web API container. Override with API_URL=... if needed.
// 127.0.0.1, not localhost: `flask run` listens on IPv4 only, and Node
// can resolve localhost to IPv6 (::1).
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:5001'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // `npm run dev:phone` (mode "phone") serves over HTTPS with a
    // self-signed certificate, so a phone on the same Wi-Fi can log in:
    // Auth0's login library only runs on https:// or localhost. The phone
    // shows a one-time "not secure" warning for the certificate.
    ...(mode === 'phone' ? [basicSsl({ name: 'spendora-dev' })] : []),
  ],
  server: {
    // The browser calls /api/... on the Vite dev server, which forwards it
    // to Flask - same origin, so no CORS setup is needed.
    proxy: {
      '/api': API_URL,
    },
  },
}))
