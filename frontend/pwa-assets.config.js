// Makes the installable-app icons from public/pwa-icon.svg:
//   npm run generate-pwa-assets
// Output goes next to the source in public/ (pwa-64x64.png, pwa-192x192.png,
// pwa-512x512.png, maskable-icon-512x512.png, apple-touch-icon-180x180.png,
// favicon.ico). Re-run it after changing the logo, and commit the PNGs.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Maskable (Android crops it to a circle or squircle) and Apple icons get a
// margin, so fill it with the logo's forest green instead of white. The
// source already has its own margin, so these use less than the preset's
// 0.3; 0.2 still keeps the whole mark inside Android's round safe zone.
const forest = { background: '#0b3d2e' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: forest },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: forest },
  },
  images: ['public/pwa-icon.svg'],
})
