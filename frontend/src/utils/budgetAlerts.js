// Budget alerts: how much of each monthly budget is used, and whether it
// has reached the warning (80%) or over-budget (100%) level.

import { currentMonthKey, todayIso } from './format'
import { spentByCategory } from './transactions'

export const WARNING_AT = 0.8
export const OVER_AT = 1

export function levelOf(ratio) {
  if (ratio >= OVER_AT) return 'over'
  if (ratio >= WARNING_AT) return 'warning'
  return null
}

const rank = (level) => (level === 'over' ? 2 : level === 'warning' ? 1 : 0)

export function daysLeftInMonth(today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(y, m, 0).getDate() - d
}

// Every budget with this month's spending against it.
export function budgetStatuses(budgets, entries, key = currentMonthKey()) {
  const spent = spentByCategory(entries, key)
  return budgets.map((b) => {
    const limitCents = Math.round(Number(b.monthly_limit) * 100)
    const spentCents = spent[b.category] ?? 0
    const ratio = limitCents ? spentCents / limitCents : 0
    return { id: b.id, category: b.category, limitCents, spentCents, ratio, level: levelOf(ratio) }
  })
}

// Budgets at 80% or more, over-budget first, then the fullest.
export function budgetAlerts(budgets, entries) {
  return budgetStatuses(budgets, entries)
    .filter((s) => s.level)
    .sort((a, b) => rank(b.level) - rank(a.level) || b.ratio - a.ratio)
}

// After a change to the entries, the budget (if any) that moved up a level
// - e.g. from under 80% to over it. The most severe one wins.
export function newlyCrossed(budgets, before, after) {
  const was = Object.fromEntries(budgetStatuses(budgets, before).map((s) => [s.id, s.level]))
  return (
    budgetStatuses(budgets, after)
      .filter((s) => rank(s.level) > rank(was[s.id]))
      .sort((a, b) => rank(b.level) - rank(a.level) || b.ratio - a.ratio)[0] ?? null
  )
}
