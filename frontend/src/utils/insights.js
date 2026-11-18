// Numbers behind the Insights charts. Pure functions of the entries, so
// they're easy to reason about; amounts are in cents throughout.

import { CATEGORIES, INCOME_CATEGORY } from '../constants'
import { currentMonthKey, monthKey, parseDate, previousMonthKey, toCents, todayIso } from './format'
import { isIncome, onlyExpenses } from './transactions'

export const PERIODS = [
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'This year' },
]

// Month keys ("YYYY-MM") covered by a period, oldest first, ending with
// the current month.
export function periodMonths(period) {
  const current = currentMonthKey()
  const count =
    period === 'ytd' ? Number(current.slice(5, 7)) : Number(period.replace('m', ''))
  const keys = [current]
  while (keys.length < count) keys.unshift(previousMonthKey(keys[0]))
  return keys
}

export function inMonths(entries, keys) {
  const wanted = new Set(keys)
  return entries.filter((e) => wanted.has(monthKey(e.expense_date)))
}

// Money in and out per month, including months with nothing (as zero).
export function monthlyFlow(entries, keys) {
  const rows = Object.fromEntries(keys.map((key) => [key, { key, inCents: 0, outCents: 0 }]))
  for (const e of entries) {
    const row = rows[monthKey(e.expense_date)]
    if (!row) continue
    if (isIncome(e)) row.inCents += toCents(e.amount)
    else row.outCents += toCents(e.amount)
  }
  return keys.map((key) => ({ ...rows[key], netCents: rows[key].inCents - rows[key].outCents }))
}

// Fixed colour slot per category: colour follows the category, never its
// rank, so "Food" is the same colour in every period. "Other" (and any
// category beyond the eight palette slots) is the neutral grey.
const SLOT_BY_CATEGORY = Object.fromEntries(
  CATEGORIES.filter((c) => c.name !== 'Other').map((c, i) => [c.name, i + 1]),
)

export function categorySlot(name) {
  const slot = SLOT_BY_CATEGORY[name]
  return slot && slot <= 8 ? slot : null
}

// Spending split by category for the period: the biggest five by name,
// everything else folded into "Other". Largest first; "Other" last.
export function categorySplit(entries, maxParts = 5) {
  const totals = {}
  for (const e of onlyExpenses(entries)) {
    totals[e.category] = (totals[e.category] ?? 0) + toCents(e.amount)
  }
  const total = Object.values(totals).reduce((sum, cents) => sum + cents, 0)
  const ranked = Object.entries(totals)
    .filter(([name]) => name !== 'Other' && name !== INCOME_CATEGORY)
    .sort((a, b) => b[1] - a[1])

  const parts = ranked.slice(0, maxParts).map(([name, cents]) => ({ name, cents, slot: categorySlot(name) }))
  const restCents = total - parts.reduce((sum, p) => sum + p.cents, 0)
  if (restCents > 0) parts.push({ name: 'Other', cents: restCents, slot: null })

  return {
    total,
    parts: parts.map((p) => ({ ...p, share: total ? p.cents / total : 0 })),
  }
}

function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Running total of spending through a month, one point per day.
function cumulativeByDay(entries, key, lastDay) {
  const perDay = new Array(lastDay + 1).fill(0)
  for (const e of onlyExpenses(entries)) {
    if (monthKey(e.expense_date) !== key) continue
    const day = Number(e.expense_date.slice(8, 10))
    if (day <= lastDay) perDay[day] += toCents(e.amount)
  }
  let running = 0
  return perDay.slice(1).map((cents) => (running += cents))
}

// This month's running spend (up to today) against last month's (whole
// month), day by day, for the pace chart.
export function monthPace(entries) {
  const thisKey = currentMonthKey()
  const lastKey = previousMonthKey(thisKey)
  const today = Number(todayIso().slice(8, 10))
  const days = Math.max(daysInMonth(thisKey), daysInMonth(lastKey))

  const thisRun = cumulativeByDay(entries, thisKey, today)
  const lastRun = cumulativeByDay(entries, lastKey, daysInMonth(lastKey))

  return {
    thisKey,
    lastKey,
    today,
    points: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      thisMonth: i < thisRun.length ? thisRun[i] : null,
      lastMonth: i < lastRun.length ? lastRun[i] : null,
    })),
    spentSoFar: thisRun.at(-1) ?? 0,
    lastAtSameDay: lastRun[Math.min(today, lastRun.length) - 1] ?? 0,
  }
}

// First day of the week for this browser's locale (0 = Sunday).
function weekStartDay() {
  try {
    const locale = new Intl.Locale(navigator.language)
    const info = locale.getWeekInfo?.() ?? locale.weekInfo
    if (info?.firstDay) return info.firstDay % 7
  } catch {
    // Older browsers: Sunday.
  }
  return 0
}

// Spending per day of the week over the period, in the locale's week order.
export function weekdaySpending(entries) {
  const totals = new Array(7).fill(0)
  for (const e of onlyExpenses(entries)) {
    totals[parseDate(e.expense_date).getDay()] += toCents(e.amount)
  }
  const start = weekStartDay()
  return Array.from({ length: 7 }, (_, i) => {
    const day = (start + i) % 7
    // 4 Jan 2026 was a Sunday.
    const date = new Date(2026, 0, 4 + day)
    return {
      day,
      short: date.toLocaleDateString(undefined, { weekday: 'short' }),
      long: date.toLocaleDateString(undefined, { weekday: 'long' }),
      cents: totals[day],
    }
  })
}

export function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' })
}
