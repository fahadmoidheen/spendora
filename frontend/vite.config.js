import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The Flask API (backend/). It runs on 5001 because 5000 is taken by the
// formsflow web API container. Override with API_URL=... if needed.
// 127.0.0.1, not localhost: `flask run` listens on IPv4 only, and Node
// can resolve localhost to IPv6 (::1).
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:5001'

// The browser calls /api/... on the Vite server, which forwards it to Flask
// - same origin, so no CORS setup is needed. Used by `npm run dev` and
// `npm run preview` alike.
const proxy = { '/api': API_URL }

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365

// Installable web app (PWA): the manifest makes phones offer "Install app" /
// "Add to Home Screen", and the service worker keeps the app's files on the
// device so it opens fast and shows a proper screen when offline. Expenses
// themselves always come live from the API - /api is never cached.
const pwa = VitePWA({
  // A new version waits until the user taps "Reload" in the update toast
  // (src/components/UpdatePrompt.jsx), so nothing reloads mid-edit.
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
  manifest: {
    id: '/',
    name: 'Spendora',
    short_name: 'Spendora',
    description: 'Track where your money flows',
    lang: 'en',
    categories: ['finance'],
    theme_color: '#0b3d2e',
    background_color: '#f3f5ef',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    // Made from public/pwa-icon.svg by `npm run generate-pwa-assets`.
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    cleanupOutdatedCaches: true,
    // Any page address (including Auth0's /?code=... return) opens the app;
    // API calls are never answered from the cache.
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 10, maxAgeSeconds: YEAR_IN_SECONDS },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          expiration: { maxEntries: 30, maxAgeSeconds: YEAR_IN_SECONDS },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Everything else cross-origin (Auth0 login, profile photos) is left
      // alone: no route matches, so the browser handles it as usual.
    ],
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    pwa,
    // `npm run dev:phone` (mode "phone") serves over HTTPS with a
    // self-signed certificate, so a phone on the same Wi-Fi can log in:
    // Auth0's login library only runs on https:// or localhost. The phone
    // shows a one-time "not secure" warning for the certificate.
    ...(mode === 'phone' ? [basicSsl({ name: 'spendora-dev' })] : []),
  ],
  server: { proxy },
  preview: { proxy },
}))
