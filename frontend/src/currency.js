// Display currency: picked in the header, saved in this browser.
//
// Amounts are stored as plain numbers, so switching currency changes how
// they are shown (symbol, separators, decimals) - it does not convert them.

import { createContext, useContext } from 'react'

export const CURRENCIES = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'CHF', name: 'Swiss franc' },
]

const DEFAULT_CURRENCY = 'USD'
const STORAGE_KEY = 'spendora:currency'

export function loadCurrency() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (CURRENCIES.some((c) => c.code === saved)) return saved
  } catch {
    // Storage blocked (private window etc.) - use the default.
  }
  return DEFAULT_CURRENCY
}

export function saveCurrency(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
}

const MINUS = '−' // a real minus sign, not a hyphen

// Everything the UI needs to show money in one currency.
export function makeMoney(code) {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: code })
  const symbol =
    formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? code
  const format = (cents) => formatter.format(Math.abs(cents) / 100)

  return {
    code,
    symbol,
    // 2 for most currencies, 0 for yen.
    decimals: formatter.resolvedOptions().maximumFractionDigits,
    // "$1,234.50" (always positive)
    format,
    // "+$5,200.00" for money in, "−$64.20" for money out
    formatSigned: (cents, direction) => `${direction < 0 ? MINUS : '+'}${format(cents)}`,
    // "$12.00" or "−$12.00" - for a net figure that can go negative
    formatNet: (cents) => (cents < 0 ? MINUS : '') + format(cents),
  }
}

export const MoneyContext = createContext(makeMoney(DEFAULT_CURRENCY))

export function useMoney() {
  return useContext(MoneyContext)
}

// Keeps an amount box to digits and one decimal point: at most `decimals`
// places and 8 whole digits (the API's Numeric(10, 2) limit). Pasted
// "1,234.50" becomes "1234.50"; a trailing comma with up to 2 digits
// ("12,5") is read as a decimal comma.
export function sanitizeAmount(raw, decimals = 2) {
  let text = String(raw).replace(/[^\d.,]/g, '')
  if (!text.includes('.')) {
    const decimalComma = text.match(/,(\d{0,2})$/)
    if (decimalComma) {
      text = `${text.slice(0, decimalComma.index)}.${decimalComma[1]}`
    }
  }
  text = text.replace(/,/g, '')

  const point = text.indexOf('.')
  const whole = (point === -1 ? text : text.slice(0, point)).slice(0, 8)
  if (point === -1 || decimals === 0) return whole

  const fraction = text.slice(point + 1).replace(/\./g, '').slice(0, decimals)
  return `${whole || '0'}.${fraction}`
}
