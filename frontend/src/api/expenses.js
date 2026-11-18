// Expense and income entries (backend/app/routes/expenses.py).
//
// Entries come back as JSON with `type` ("expense" or "income"), amount as
// a "12.50" string and dates as ISO strings.

import { INCOME_CATEGORY } from '../constants'
import { amountString, request } from './client'

const BASE = '/api/expenses'

function toPayload(values) {
  const income = values.type === 'income'
  return {
    type: values.type,
    // Blank -> null: the API then names it after the category ("food1").
    title: values.title.trim() || null,
    amount: amountString(values.amount),
    category: income ? INCOME_CATEGORY : values.category,
    expense_date: values.expense_date,
    description: values.description || null,
  }
}

export function listExpenses() {
  return request(BASE)
}

export function createExpense(values) {
  return request(BASE, { method: 'POST', body: toPayload(values) })
}

export function updateExpense(id, values) {
  return request(`${BASE}/${id}`, { method: 'PUT', body: toPayload(values) })
}

export function deleteExpense(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' })
}
