// Helpers for lists that mix expenses and income.

import { monthKey, toCents } from './format'

export const isIncome = (entry) => entry.type === 'income'

export const onlyExpenses = (entries) => entries.filter((e) => !isIncome(e))

export const onlyIncome = (entries) => entries.filter(isIncome)

export const inMonth = (entries, key) =>
  entries.filter((e) => monthKey(e.expense_date) === key)

// Income minus expenses, in cents.
export function netCents(entries) {
  return entries.reduce(
    (total, e) => total + (isIncome(e) ? 1 : -1) * toCents(e.amount),
    0,
  )
}

// { category: cents } for one month's expenses - what budgets measure.
export function spentByCategory(entries, key) {
  const totals = {}
  for (const e of onlyExpenses(inMonth(entries, key))) {
    totals[e.category] = (totals[e.category] ?? 0) + toCents(e.amount)
  }
  return totals
}
