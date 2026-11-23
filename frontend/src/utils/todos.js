// To-do helpers: grouping by date, "due" labels, and today's spending
// against the monthly budgets (the Today card).

import { daysLeftInMonth } from './budgetAlerts'
import { formatDate, monthKey, parseDate, sumCents, toCents, toIsoDate, todayIso } from './format'
import { onlyExpenses } from './transactions'

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export const REPEAT_LABELS = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
}

export function addDays(iso, days) {
  const date = parseDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

const daysFrom = (fromIso, toIso) => Math.round((parseDate(toIso) - parseDate(fromIso)) / 86_400_000)

// Open to-dos by date (undated last), ties by id - the API's order, kept
// after local changes.
export function byDueDate(a, b) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  }
  return a.id - b.id
}

// Sections of the To-dos tab.
export function groupTodos(todos, today = todayIso()) {
  const groups = { overdue: [], today: [], upcoming: [], someday: [], done: [] }
  for (const t of todos) {
    if (t.done) groups.done.push(t)
    else if (!t.due_date) groups.someday.push(t)
    else if (t.due_date < today) groups.overdue.push(t)
    else if (t.due_date === today) groups.today.push(t)
    else groups.upcoming.push(t)
  }
  for (const key of ['overdue', 'today', 'upcoming', 'someday']) groups[key].sort(byDueDate)
  groups.done.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '') || b.id - a.id)
  return groups
}

// Open to-dos due today or earlier - what the Today card, the tab badge
// and the app icon count.
export function dueNow(todos, today = todayIso()) {
  return todos.filter((t) => !t.done && t.due_date && t.due_date <= today).sort(byDueDate)
}

// "Today", "Tomorrow", "Friday", "Dec 12", or "3 days overdue".
export function dueLabel(todo, today = todayIso()) {
  if (!todo.due_date) return null
  const days = daysFrom(today, todo.due_date)
  if (days < 0) {
    return { text: days === -1 ? 'Yesterday' : `${-days} days overdue`, overdue: true }
  }
  if (days === 0) return { text: 'Today' }
  if (days === 1) return { text: 'Tomorrow' }
  if (days < 7) {
    return { text: parseDate(todo.due_date).toLocaleDateString(undefined, { weekday: 'long' }) }
  }
  return { text: formatDate(todo.due_date) }
}

// Today's spending, and - when there are budgets - how much of today's
// share is left. The daily pace is what the budgets have left at the start
// of today, spread over the days left in the month (today included); only
// spending in budgeted categories counts against it.
export function todaySpending(entries, budgets, today = todayIso()) {
  const expenses = onlyExpenses(entries)
  const todays = expenses.filter((e) => e.expense_date === today)
  const result = { spentCents: sumCents(todays), count: todays.length, paceCents: null, leftCents: null }
  if (budgets.length === 0) return result

  const month = monthKey(today)
  const budgeted = new Set(budgets.map((b) => b.category))
  const limit = budgets.reduce((sum, b) => sum + toCents(b.monthly_limit), 0)
  let before = 0
  let todayBudgeted = 0
  for (const e of expenses) {
    if (!budgeted.has(e.category) || monthKey(e.expense_date) !== month) continue
    if (e.expense_date < today) before += toCents(e.amount)
    else if (e.expense_date === today) todayBudgeted += toCents(e.amount)
  }
  const pace = Math.max(0, Math.floor((limit - before) / (daysLeftInMonth(today) + 1)))
  return { ...result, paceCents: pace, leftCents: pace - todayBudgeted }
}

// Form values for an existing to-do (also used to re-save it as is).
export function todoValues(todo) {
  return {
    title: todo.title,
    due_date: todo.due_date ?? '',
    amount: todo.amount ?? '',
    category: todo.category ?? '',
    repeat: todo.repeat,
    done: todo.done,
  }
}
