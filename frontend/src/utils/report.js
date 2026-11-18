// Numbers for the PDF report (components/MoneyReport.jsx): a period, its
// totals against the period before, spending by category, budgets, month
// by month, and every transaction.

import { budgetStatuses } from './budgetAlerts'
import { formatMonth, monthKey, parseDate, sumCents, toCents, toIsoDate, todayIso } from './format'
import { onlyExpenses, onlyIncome } from './transactions'

export const PERIODS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom dates' },
]

const iso = (y, m, d) => toIsoDate(new Date(y, m, d)) // m from 0; day 0 = last of previous month

function addDays(isoDate, days) {
  const date = parseDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

// { from, to } (inclusive "YYYY-MM-DD") for a period, plus the period
// before it to compare with (null for "All time").
export function periodRanges(period, { entries = [], custom, today = todayIso() } = {}) {
  const t = parseDate(today)
  const y = t.getFullYear()
  const m = t.getMonth()
  switch (period) {
    case 'this-month':
      return { range: { from: iso(y, m, 1), to: iso(y, m + 1, 0) }, previous: { from: iso(y, m - 1, 1), to: iso(y, m, 0) } }
    case 'last-month':
      return { range: { from: iso(y, m - 1, 1), to: iso(y, m, 0) }, previous: { from: iso(y, m - 2, 1), to: iso(y, m - 1, 0) } }
    case 'last-3-months':
      return { range: { from: iso(y, m - 2, 1), to: iso(y, m + 1, 0) }, previous: { from: iso(y, m - 5, 1), to: iso(y, m - 2, 0) } }
    case 'this-year':
      return { range: { from: iso(y, 0, 1), to: iso(y, 11, 31) }, previous: { from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) } }
    case 'last-year':
      return { range: { from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) }, previous: { from: iso(y - 2, 0, 1), to: iso(y - 2, 11, 31) } }
    case 'all': {
      const dates = entries.map((e) => e.expense_date).sort()
      return { range: { from: dates[0] ?? today, to: dates.at(-1) ?? today }, previous: null }
    }
    default: {
      // Custom dates: no comparison. "The 18 days before" rarely lines up
      // with paydays and bills, so the change would mostly be noise.
      const [from, to] = [custom?.from ?? today, custom?.to ?? today].sort()
      return { range: { from, to }, previous: null }
    }
  }
}

// One whole calendar month? Then budgets (monthly limits) apply.
function wholeMonth({ from, to }) {
  const start = parseDate(from)
  return (
    start.getDate() === 1 &&
    monthKey(from) === monthKey(to) &&
    to === iso(start.getFullYear(), start.getMonth() + 1, 0)
  )
}

// "November 2026", "2026", "Sep – Nov 2026", or "3 Aug – 2 Nov 2026".
export function rangeLabel({ from, to }) {
  if (wholeMonth({ from, to })) return formatMonth(monthKey(from))
  if (from.endsWith('-01-01') && to.endsWith('-12-31') && from.slice(0, 4) === to.slice(0, 4)) {
    return from.slice(0, 4)
  }
  const a = parseDate(from)
  const b = parseDate(to)
  const sameYear = a.getFullYear() === b.getFullYear()
  const endsOnMonthEnd = to === iso(b.getFullYear(), b.getMonth() + 1, 0)
  if (a.getDate() === 1 && endsOnMonthEnd) {
    const month = (date, withYear) =>
      date.toLocaleDateString(undefined, { month: 'short', year: withYear ? 'numeric' : undefined })
    return `${month(a, !sameYear)} – ${month(b, true)}`
  }
  const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })
  const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${left} – ${right}`
}

const within = (entries, { from, to }) =>
  entries.filter((e) => e.expense_date >= from && e.expense_date <= to)

export function buildReport(entries, budgets, { range, previous }) {
  const list = within(entries, range).sort(
    (a, b) => a.expense_date.localeCompare(b.expense_date) || a.id - b.id,
  )
  const spending = onlyExpenses(list)
  const income = sumCents(onlyIncome(list))
  const spent = sumCents(spending)

  // Compare only when the user's history covers the earlier period (give
  // or take its first week) - otherwise "↑ 196%" just means "you started
  // using Spendora".
  const firstDate = entries.reduce((min, e) => (e.expense_date < min ? e.expense_date : min), '9999')
  let before = null
  if (previous && firstDate <= addDays(previous.from, 6)) {
    const earlier = within(entries, previous)
    before = {
      label: rangeLabel(previous),
      income: sumCents(onlyIncome(earlier)),
      spent: sumCents(onlyExpenses(earlier)),
    }
  }

  const byCategory = {}
  for (const e of spending) {
    const row = (byCategory[e.category] ??= { name: e.category, cents: 0, count: 0 })
    row.cents += toCents(e.amount)
    row.count += 1
  }
  const categories = Object.values(byCategory)
    .sort((a, b) => b.cents - a.cents)
    .map((row) => ({ ...row, share: spent ? row.cents / spent : 0 }))

  const monthMap = {}
  for (const e of list) {
    const key = monthKey(e.expense_date)
    const month = (monthMap[key] ??= { key, label: formatMonth(key), entries: [], income: 0, spent: 0 })
    month.entries.push(e)
    if (e.type === 'income') month.income += toCents(e.amount)
    else month.spent += toCents(e.amount)
  }
  const months = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key))

  const budgetRows = wholeMonth(range) && budgets.length
    ? budgetStatuses(budgets, entries, monthKey(range.from)).sort((a, b) => b.ratio - a.ratio)
    : []

  return {
    label: rangeLabel(range),
    range,
    entries: list,
    income,
    spent,
    net: income - spent,
    before,
    categories,
    months,
    budgets: budgetRows,
  }
}
