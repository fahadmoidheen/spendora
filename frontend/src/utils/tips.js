// Short, specific tips for the Heads-up panel, worked out from the user's
// own history. Each compares this month with the user's "usual": the
// average of the previous three months that have any spending.
//
// Comparisons are made at the same point in the month (spending up to
// today's date vs. spending up to that date in earlier months), so a rent
// payment on the 1st doesn't make the 3rd look like a spending spree.

import { monthKey, parseDate, previousMonthKey, toCents, toIsoDate, todayIso } from './format'
import { isIncome, onlyExpenses } from './transactions'

const LOOKBACK_MONTHS = 3
const MIN_HISTORY_MONTHS = 2 // need at least this many to call anything "usual"
const MIN_DAY_FOR_COMPARISONS = 5 // too early in the month to judge before this
const UNUSUAL = 0.25 // 25% above or below usual is worth a mention

function daysIn(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// { total, byCategory } spent in a month, optionally only up to a day.
function spending(entries, key, upToDay = 31) {
  const byCategory = {}
  let total = 0
  for (const e of onlyExpenses(entries)) {
    if (monthKey(e.expense_date) !== key) continue
    if (Number(e.expense_date.slice(8, 10)) > upToDay) continue
    const cents = toCents(e.amount)
    byCategory[e.category] = (byCategory[e.category] ?? 0) + cents
    total += cents
  }
  return { total, byCategory }
}

// The previous months (up to three) that have any spending at all.
function historyMonths(entries, thisKey) {
  const keys = []
  let key = thisKey
  for (let i = 0; i < LOOKBACK_MONTHS; i++) {
    key = previousMonthKey(key)
    if (spending(entries, key).total > 0) keys.push(key)
  }
  return keys
}

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

// Categories noticeably above (or below) usual for this point in the month.
// At most two "above" tips and one "below" tip.
export function categoryChanges(entries, today = todayIso()) {
  const thisKey = monthKey(today)
  const day = Number(today.slice(8, 10))
  const history = historyMonths(entries, thisKey)
  if (day < MIN_DAY_FOR_COMPARISONS || history.length < MIN_HISTORY_MONTHS) return []

  const now = spending(entries, thisKey, day)
  const past = history.map((key) => spending(entries, key, day))
  const usualTotal = average(past.map((p) => p.total))
  // Ignore small swings: the change must be at least 5% of usual spending.
  const minChange = usualTotal * 0.05

  const categories = new Set([
    ...Object.keys(now.byCategory),
    ...past.flatMap((p) => Object.keys(p.byCategory)),
  ])
  const changes = []
  for (const category of categories) {
    const usual = average(past.map((p) => p.byCategory[category] ?? 0))
    const current = now.byCategory[category] ?? 0
    if (usual <= 0) continue
    const change = (current - usual) / usual
    if (Math.abs(current - usual) < minChange || Math.abs(change) < UNUSUAL) continue
    changes.push({ category, change, currentCents: current, usualCents: Math.round(usual) })
  }

  const above = changes.filter((c) => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 2)
  const below = changes.filter((c) => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 1)
  return [...above, ...below]
}

// Where this month is heading: spent so far plus what usually comes in the
// rest of the month, compared with a usual full month.
export function monthOutlook(entries, today = todayIso()) {
  const thisKey = monthKey(today)
  const day = Number(today.slice(8, 10))
  const history = historyMonths(entries, thisKey)
  if (day < MIN_DAY_FOR_COMPARISONS || history.length < MIN_HISTORY_MONTHS) return null

  const soFar = spending(entries, thisKey, day).total
  const usualFull = average(history.map((key) => spending(entries, key).total))
  const usualRest = average(
    history.map((key) => spending(entries, key).total - spending(entries, key, day).total),
  )
  const projected = Math.round(soFar + usualRest)
  const change = usualFull > 0 ? (projected - usualFull) / usualFull : 0
  if (Math.abs(change) < 0.1) return null
  return { projectedCents: projected, usualCents: Math.round(usualFull), change }
}

// Auto-generated names ("food1") don't identify a payment.
const AUTO_TITLE = /^[a-z]+\d+$/i

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Payments that repeat monthly - same title, similar amount, around the same
// day - and are due in the next `withinDays` days but not paid yet this month.
export function upcomingRepeats(entries, today = todayIso(), withinDays = 7) {
  const thisKey = monthKey(today)
  const todayDate = parseDate(today)
  const recent = new Set()
  let key = thisKey
  for (let i = 0; i < LOOKBACK_MONTHS; i++) {
    key = previousMonthKey(key)
    recent.add(key)
  }

  const groups = {}
  for (const e of entries) {
    if (isIncome(e) || AUTO_TITLE.test(e.title)) continue
    const name = e.title.trim().toLowerCase()
    ;(groups[name] ??= []).push(e)
  }

  const upcoming = []
  for (const list of Object.values(groups)) {
    if (list.some((e) => monthKey(e.expense_date) === thisKey)) continue // already paid
    const past = list.filter((e) => recent.has(monthKey(e.expense_date)))
    const months = new Set(past.map((e) => monthKey(e.expense_date)))
    if (months.size < 2) continue

    const amounts = past.map((e) => toCents(e.amount))
    const days = past.map((e) => Number(e.expense_date.slice(8, 10)))
    const typicalAmount = median(amounts)
    const typicalDay = median(days)
    const steadyAmount = amounts.every((a) => Math.abs(a - typicalAmount) <= typicalAmount * 0.15)
    const steadyDay = days.every((d) => Math.abs(d - typicalDay) <= 4)
    if (!steadyAmount || !steadyDay) continue

    const [y, m] = thisKey.split('-').map(Number)
    const due = new Date(y, m - 1, Math.min(typicalDay, daysIn(thisKey)))
    const daysUntil = Math.round((due - todayDate) / 86_400_000)
    if (daysUntil < 0 || daysUntil > withinDays) continue

    const latest = [...past].sort((a, b) => b.expense_date.localeCompare(a.expense_date))[0]
    upcoming.push({
      title: latest.title,
      amountCents: toCents(latest.amount),
      dueDate: toIsoDate(due),
      daysUntil,
    })
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3)
}
