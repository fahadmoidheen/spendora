import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR_IN_MS = 60 * 60 * 1000

// Registers the service worker (vite-plugin-pwa) and, when a newer version
// of Spendora has been downloaded, offers to switch to it. Nothing reloads
// on its own, so a half-filled form is never lost.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app can stay open for days - look for updates hourly.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), HOUR_IN_MS)
    },
    onRegisterError(error) {
      console.warn('Spendora: service worker registration failed', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="toast-bar" role="status" aria-live="polite">
      <p>A new version of Spendora is ready.</p>
      <div className="toast-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    </div>
  )
}
