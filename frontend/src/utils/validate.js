import { LIMITS } from '../constants'

// Message for a bad amount, or null. `decimals` comes from the currency
// (2 for most, 0 for yen).
export function amountError(raw, decimals = 2, label = 'Amount') {
  const text = String(raw).replace(/[,\s]/g, '')
  const amount = Number(text)
  if (text === '' || Number.isNaN(amount)) {
    return label === 'Amount' ? 'Enter an amount.' : `Enter a ${label.toLowerCase()}.`
  }
  if (amount <= 0) return `${label} must be more than 0.`
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  if (!pattern.test(text)) {
    return decimals > 0
      ? `Use at most ${decimals} decimal places.`
      : 'Use a whole number for this currency.'
  }
  if (amount > LIMITS.maxAmount) return `${label} is too large.`
  return null
}

// Returns { field: message } for every invalid field; empty when valid.
export function validateExpense(values, decimals = 2) {
  const errors = {}

  // Title is optional: the API names untitled entries "food1", "food2", ...
  if (values.title.trim().length > LIMITS.title) {
    errors.title = `Keep it under ${LIMITS.title} characters.`
  }

  const amount = amountError(values.amount, decimals)
  if (amount) errors.amount = amount

  // Income is always filed under "Income", so only expenses pick one.
  if (values.type !== 'income' && !values.category) {
    errors.category = 'Pick a category.'
  }
  if (!values.expense_date) errors.expense_date = 'Pick a date.'

  return errors
}
