import { useEffect, useState } from 'react'

// Chart colours come from CSS variables in index.css (section "Charts"),
// so light and dark mode are defined in one place. Recharts draws with
// plain colour values, so read the resolved values here - and again
// whenever the theme switches.
const NAMES = [
  'series-1', 'series-2', 'series-3', 'series-4',
  'series-5', 'series-6', 'series-7', 'series-8',
  'series-muted', 'chart-in', 'chart-out', 'chart-last',
  'chart-grid', 'chart-axis', 'chart-text', 'surface', 'ink',
]

function readColors() {
  const style = getComputedStyle(document.documentElement)
  const colors = {}
  for (const name of NAMES) colors[name] = style.getPropertyValue(`--${name}`).trim()
  return colors
}

export function useChartColors() {
  const [colors, setColors] = useState(readColors)

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return colors
}

// Shared axis styling: hairline, recessive, small muted text.
export function axisProps(colors) {
  return {
    tickLine: false,
    tick: { fill: colors['chart-text'], fontSize: 12 },
    stroke: colors['chart-axis'],
  }
}

// Category colour: its fixed palette slot, or grey for "Other".
export function slotColor(colors, slot) {
  return slot ? colors[`series-${slot}`] : colors['series-muted']
}

// Charts skip their grow-in animation for people who asked for less motion.
export const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
