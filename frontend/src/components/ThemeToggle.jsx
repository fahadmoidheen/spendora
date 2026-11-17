import { useEffect, useState } from 'react'
import { currentTheme, onSystemThemeChange, setTheme } from '../theme'
import { MoonIcon, SunIcon } from './Icons'

// Header button that flips between light and dark. It shows the mode you
// would switch to: a moon in light mode, a sun in dark mode.
export default function ThemeToggle() {
  const [theme, setThemeState] = useState(currentTheme)

  // Until a choice is saved, the page follows the OS - keep the icon in step.
  useEffect(() => onSystemThemeChange(() => setThemeState(currentTheme())), [])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="btn btn-icon header-icon-btn"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        setTheme(next)
        setThemeState(next)
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
