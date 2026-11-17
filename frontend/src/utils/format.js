// Money formatting lives in ../currency.js (it depends on the chosen
// currency). This file has the plain number and date helpers.

// Sums are done in whole cents so 0.1 + 0.2 never shows up as 0.30000004.
export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

export function sumCents(expenses) {
  return expenses.reduce((total, e) => total + toCents(e.amount), 0)
}

// Dates are "YYYY-MM-DD" strings. Parse them as local dates - new Date(iso)
// would read them as UTC midnight and can land on the previous day.
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayIso() {
  return toIsoDate(new Date())
}

// "Nov 14, 2026" - the date field's label.
export function formatFullDate(iso) {
  return parseDate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "Saturday, November 14, 2026" - read out by screen readers.
export function formatLongDate(iso) {
  return parseDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDate(iso) {
  const date = parseDate(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
}

// Month keys are "YYYY-MM".
export function monthKey(iso) {
  return iso.slice(0, 7)
}

export function currentMonthKey() {
  return monthKey(todayIso())
}

export function previousMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(toIsoDate(new Date(y, m - 2, 1)))
}

export function formatMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}
