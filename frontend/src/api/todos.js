// To-dos (backend/app/routes/todos.py). Each comes back as
// { id, title, due_date: "2026-12-01" | null, amount: "15000.00" | null,
//   category, repeat: "none" | "daily" | "weekly" | "monthly", done, ... }.

import { amountString, request } from './client'

const BASE = '/api/todos'

function toPayload(values) {
  const amount = values.amount ? amountString(values.amount) : null
  return {
    title: values.title.trim(),
    due_date: values.due_date || null,
    amount,
    // Only kept with an amount; blank -> the API files it under "Other".
    category: amount ? values.category || null : null,
    repeat: values.repeat ?? 'none',
    done: Boolean(values.done),
  }
}

export function listTodos() {
  return request(BASE)
}

export function createTodo(values) {
  return request(BASE, { method: 'POST', body: toPayload(values) })
}

export function updateTodo(id, values) {
  return request(`${BASE}/${id}`, { method: 'PUT', body: toPayload(values) })
}

export function deleteTodo(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' })
}

// Mark done. `date` is the user's today (the expense date when
// `addExpense` saves the amount as an expense). Resolves to
// { todo, expense } - expense is null unless one was added.
export function completeTodo(id, { date, addExpense = false }) {
  return request(`${BASE}/${id}/complete`, {
    method: 'POST',
    body: { date, add_expense: addExpense },
  })
}
