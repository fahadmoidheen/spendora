// Light / dark mode. The page starts in the right theme thanks to the
// inline script in index.html; this file reads and changes it afterwards.
// Must use the same storage key as that script.

const STORAGE_KEY = 'spendora:theme'

export function currentTheme() {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark'
    ? 'dark'
    : 'light'
}

// Apply and remember a choice; from then on the OS setting is ignored.
export function setTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not saved (private window etc.); it still applies until reload.
  }
}

// Call `listener` when the OS theme changes. index.html re-applies the
// theme first (its listener was added earlier), so currentTheme() is
// already up to date. Returns an unsubscribe function.
export function onSystemThemeChange(listener) {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
