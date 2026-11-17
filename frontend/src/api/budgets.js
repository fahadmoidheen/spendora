// Monthly budgets, one per category (backend/app/routes/budgets.py).
// Each comes back as { id, category, monthly_limit: "450.00", ... }.

import { amountString, request } from './client'

const BASE = '/api/budgets'

function toPayload({ category, monthly_limit }) {
  return { category, monthly_limit: amountString(monthly_limit) }
}

export function listBudgets() {
  return request(BASE)
}

export function createBudget(values) {
  return request(BASE, { method: 'POST', body: toPayload(values) })
}

export function updateBudget(id, values) {
  return request(`${BASE}/${id}`, { method: 'PUT', body: toPayload(values) })
}

export function deleteBudget(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' })
}
