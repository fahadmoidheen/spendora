// CSV import: turns a bank statement (or Spendora's own export) into
// entries ready to save. No AI - every bank lays its file out differently,
// so we guess the columns from the headers, let the user correct the
// guess, and file each row under a category with keyword rules plus what
// the user's own history teaches us.

import { CATEGORIES, INCOME_CATEGORY, LIMITS } from '../constants'
import { parseCsv } from './csv'
import { toCents, toIsoDate } from './format'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5000 // matches the API (IMPORT_MAX_ROWS)

// --- Columns ----------------------------------------------------------------

// Header names banks use for each field, best match first.
const HEADER_NAMES = {
  date: [
    'date', 'transaction date', 'posting date', 'posted date', 'post date', 'booking date',
    'value date', 'trans date', 'txn date', 'completed date', 'started date', 'date posted',
  ],
  amount: ['amount', 'transaction amount', 'value', 'net amount', 'sum'],
  debit: ['debit', 'debits', 'withdrawal', 'withdrawals', 'money out', 'paid out', 'debit amount', 'out', 'spent'],
  credit: ['credit', 'credits', 'deposit', 'deposits', 'money in', 'paid in', 'credit amount', 'in', 'received'],
  type: ['type', 'transaction type', 'kind', 'dr cr', 'debit credit'],
  category: ['category', 'categories'],
  title: [
    'title', 'description', 'payee', 'merchant', 'name', 'details', 'transaction description',
    'transaction details', 'narrative', 'particulars', 'counterparty', 'reference', 'memo',
  ],
  note: ['note', 'notes', 'memo', 'comment', 'comments'],
}

// The order fields pick their column in: specific ones before "memo"-ish ones.
export const FIELDS = ['date', 'amount', 'debit', 'credit', 'type', 'category', 'title', 'note']

const normalizeHeader = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// { field: column index, or -1 }. Exact header matches beat "starts with"
// matches ("Amount (USD)"), and each column is used once.
export function guessColumns(headers) {
  const names = headers.map(normalizeHeader)
  const used = new Set()
  const mapping = {}
  for (const field of FIELDS) {
    let best = { score: Infinity, index: -1 }
    names.forEach((name, index) => {
      if (used.has(index)) return
      HEADER_NAMES[field].forEach((wanted, rank) => {
        const score = name === wanted ? rank : name.startsWith(`${wanted} `) ? 100 + rank : Infinity
        if (score < best.score) best = { score, index }
      })
    })
    mapping[field] = best.index
    if (best.index !== -1) used.add(best.index)
  }
  // A single amount column wins over debit/credit, and vice versa.
  if (mapping.amount !== -1 && mapping.debit !== -1 && mapping.credit !== -1) mapping.amount = -1
  return mapping
}

// Banks often put account details above the table. The header is the first
// row (of the first 20) that names a date and an amount column; failing
// that, the first row as wide as most rows in the file.
function findHeaderRow(rows) {
  const named = rows.slice(0, 20).findIndex((row) => {
    const m = guessColumns(row)
    return m.date !== -1 && (m.amount !== -1 || m.debit !== -1 || m.credit !== -1)
  })
  if (named !== -1) return named
  const widths = {}
  for (const row of rows) widths[row.length] = (widths[row.length] ?? 0) + 1
  const usual = Number(Object.entries(widths).sort((a, b) => b[1] - a[1])[0][0])
  return Math.max(0, rows.findIndex((row) => row.length === usual))
}

// --- Dates ------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const monthNumber = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1

function fullYear(text) {
  const year = Number(text)
  if (text.length > 2) return year
  const thisYear = new Date().getFullYear() % 100
  return year <= thisYear + 1 ? 2000 + year : 1900 + year
}

// Pieces of a date before we know the day/month order.
function dateParts(value) {
  const text = value.trim()
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return { kind: 'ymd', y: +m[1], m: +m[2], d: +m[3] }
  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (m) return { kind: 'numeric', a: +m[1], b: +m[2], y: fullYear(m[3]) }
  m = text.match(/^(\d{1,2})[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{2,4})\b/i)
  if (m && monthNumber(m[2])) return { kind: 'named', y: fullYear(m[3]), m: monthNumber(m[2]), d: +m[1] }
  m = text.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i)
  if (m && monthNumber(m[1])) return { kind: 'named', y: +m[3], m: monthNumber(m[1]), d: +m[2] }
  return null
}

function isoFrom(y, m, d) {
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return toIsoDate(date)
}

// "dmy" or "mdy" for numeric dates like 03/04/2026. `numeric` says whether
// the file has such dates at all (2026-04-03 or "3 Apr 2026" need no
// order); `sure` is false when every day is 12 or under, so either works.
export function detectDateOrder(values) {
  let numeric = false
  let dmy = false
  let mdy = false
  for (const value of values) {
    const p = dateParts(value)
    if (p?.kind !== 'numeric') continue
    numeric = true
    if (p.a > 12) dmy = true
    if (p.b > 12) mdy = true
  }
  if (dmy !== mdy) return { order: dmy ? 'dmy' : 'mdy', numeric, sure: true }
  if (!numeric) return { order: 'dmy', numeric, sure: true }

  // Either order works. A statement covers a short stretch of time, so pick
  // the order that keeps the dates closest together: 03/11, 04/11, 05/11 is
  // 3-5 November, not 11 March to 11 May. Ties go to the browser's locale.
  const span = (order) => {
    const times = values
      .map((v) => parseDateValue(v, order))
      .filter(Boolean)
      .map((iso) => Date.parse(iso))
    return times.length ? Math.max(...times) - Math.min(...times) : Infinity
  }
  const usStyle = /^en-(US|PH)$/i.test(navigator.language ?? '')
  const [d, m] = [span('dmy'), span('mdy')]
  const order = d === m ? (usStyle ? 'mdy' : 'dmy') : d < m ? 'dmy' : 'mdy'
  return { order, numeric, sure: false }
}

export function parseDateValue(value, order) {
  const p = dateParts(value ?? '')
  if (!p) return null
  if (p.kind !== 'numeric') return isoFrom(p.y, p.m, p.d)
  return order === 'mdy' ? isoFrom(p.y, p.a, p.b) : isoFrom(p.y, p.b, p.a)
}

// --- Amounts ----------------------------------------------------------------

// Signed cents from text like "1,234.56", "1.234,56", "-12.00", "(12.00)",
// "12.00-", "£12", "12.00 DR". null when there's no number.
export function parseAmount(raw) {
  let text = String(raw ?? '').trim()
  if (!text) return null
  let negative = false
  const suffix = text.match(/\s*(cr|dr)\.?$/i)
  if (suffix) {
    negative = suffix[1].toLowerCase() === 'dr'
    text = text.slice(0, suffix.index)
  }
  // A minus anywhere ("-12", "£-12", "12-") or accounting brackets.
  if (/^\(.*\)$/.test(text) || /[-−–]/.test(text)) negative = true

  let number = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(number)) return null
  const lastComma = number.lastIndexOf(',')
  const lastDot = number.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // Both: whichever comes last is the decimal point.
    number = lastComma > lastDot
      ? number.replace(/\./g, '').replace(',', '.')
      : number.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // "12,34" is a decimal comma; "1,234" is thousands.
    const decimal = /^\d+,\d{1,2}$/.test(number)
    number = decimal ? number.replace(',', '.') : number.replace(/,/g, '')
  } else if ((number.match(/\./g) ?? []).length > 1) {
    number = number.replace(/\./g, '') // "1.234.567"
  }
  const value = Number(number)
  if (!Number.isFinite(value)) return null
  return (negative ? -1 : 1) * Math.round(value * 100)
}

// --- Type -------------------------------------------------------------------

const INCOME_WORDS = new Set(['income', 'credit', 'cr', 'deposit', 'money in', 'paid in', 'in', 'refund', 'return', 'salary', 'received'])
const EXPENSE_WORDS = new Set(['expense', 'debit', 'dr', 'withdrawal', 'money out', 'paid out', 'out', 'sale', 'purchase', 'card payment', 'spend', 'spent'])

// "income", "expense", or null when the Type column says something else
// (e.g. "TRANSFER") - then the amount's sign decides.
function readType(value) {
  const word = normalizeHeader(value ?? '')
  if (INCOME_WORDS.has(word)) return 'income'
  if (EXPENSE_WORDS.has(word)) return 'expense'
  return null
}

// --- Categories -------------------------------------------------------------

// Words that point to a category, checked in this order (so "uber eats"
// is Food before "uber" is Transport, and "british gas" a bill before
// "gas" is fuel). Matched as whole words on lower-cased text.
const RULES = [
  ['Food', [
    'food', 'groceries', 'grocery', 'grocer', 'supermarket', 'restaurant', 'restaurants', 'dining',
    'cafe', 'coffee', 'bakery', 'deli', 'pizza', 'burger', 'sushi', 'takeaway', 'uber eats',
    'ubereats', 'doordash', 'deliveroo', 'just eat', 'grubhub', 'swiggy', 'zomato', 'starbucks',
    'costa', 'mcdonald', 'mcdonalds', 'kfc', 'subway', 'domino', 'dominos', 'chipotle', 'tesco',
    'sainsbury', 'sainsburys', 'asda', 'aldi', 'lidl', 'waitrose', 'morrisons', 'walmart',
    'kroger', 'safeway', 'whole foods', 'trader joe', 'trader joes', 'carrefour', 'spar',
    'instacart', 'blinkit', 'zepto', 'bigbasket',
  ]],
  ['Utilities', [
    'utilities', 'utility', 'bills', 'bill', 'electric', 'electricity', 'energy', 'power',
    'water', 'internet', 'broadband', 'wifi', 'phone', 'mobile', 'british gas', 'gas bill',
    'octopus energy', 'edf', 'verizon', 'comcast', 'xfinity', 'spectrum', 'att', 't mobile',
    'tmobile', 'vodafone', 'airtel', 'jio', 'bsnl',
  ]],
  ['Transport', [
    'transport', 'transportation', 'uber', 'lyft', 'bolt', 'taxi', 'cab', 'ola', 'grab', 'train',
    'trains', 'rail', 'railway', 'metro', 'bus', 'transit', 'tfl', 'mta', 'parking', 'fuel',
    'petrol', 'gas', 'gas station', 'shell', 'bp', 'chevron', 'exxon', 'esso', 'texaco', 'toll',
    'tolls', 'auto', 'automotive',
  ]],
  ['Housing', ['housing', 'rent', 'mortgage', 'landlord', 'hoa', 'property', 'lettings', 'home', 'home depot', 'lowes']],
  ['Health', [
    'health', 'wellness', 'pharmacy', 'chemist', 'cvs', 'walgreens', 'boots', 'doctor', 'dentist',
    'dental', 'hospital', 'clinic', 'medical', 'gym', 'fitness', 'optician', 'physio', 'apollo',
    'medplus',
  ]],
  ['Entertainment', [
    'entertainment', 'netflix', 'spotify', 'disney', 'hulu', 'hbo', 'prime video', 'youtube',
    'apple music', 'cinema', 'cinemas', 'movie', 'movies', 'theatre', 'theater', 'concert',
    'tickets', 'ticketmaster', 'bookmyshow', 'steam', 'playstation', 'xbox', 'nintendo', 'games',
    'pub', 'bar',
  ]],
  ['Travel', [
    'travel', 'trip', 'airline', 'airlines', 'airways', 'flight', 'flights', 'hotel', 'hotels',
    'airbnb', 'booking com', 'expedia', 'agoda', 'hostel', 'ryanair', 'easyjet', 'emirates',
    'lufthansa', 'indigo', 'makemytrip',
  ]],
  ['Shopping', [
    'shopping', 'shop', 'store', 'mall', 'clothing', 'amazon', 'amzn', 'ebay', 'target', 'ikea',
    'zara', 'uniqlo', 'primark', 'argos', 'best buy', 'apple', 'etsy', 'flipkart', 'myntra',
    'aliexpress',
  ]],
]

// Card-terminal noise that says nothing about the merchant.
const NOISE = new Set(['pos', 'card', 'purchase', 'debit', 'visa', 'mastercard', 'contactless', 'sq', 'tst', 'ach', 'payment', 'ref'])

// "POS 4411 SQ *BLUE BOTTLE SF" -> "blue bottle sf"
function merchantKey(text) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter((word) => word && !NOISE.has(word))
    .join(' ')
}

const hasPhrase = (haystack, phrase) => ` ${haystack} `.includes(` ${phrase} `)

function ruleCategory(text) {
  const key = (text ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  if (!key) return null
  return RULES.find(([, words]) => words.some((w) => hasPhrase(key, w)))?.[0] ?? null
}

const AUTO_TITLE = /^[a-z]+\d+$/i // "food1" says nothing about the merchant

// What the user's history teaches: merchant -> the category they used most.
// Imported titles are kept as is, so once "Tesco Stores" is filed under
// Food, the next statement's "TESCO STORES 4411" goes there too.
export function learnCategories(entries) {
  const counts = {}
  for (const e of entries) {
    if (e.type === 'income' || AUTO_TITLE.test(e.title)) continue
    const key = merchantKey(e.title)
    if (key.length < 3) continue
    counts[key] ??= {}
    counts[key][e.category] = (counts[key][e.category] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([key, byCategory]) => [key, Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0][0]])
    .sort((a, b) => b[0].length - a[0].length) // longest (most specific) first
}

const KNOWN = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c.name]))

export function guessCategory(title, categoryCell, learned) {
  const fromCell = (categoryCell ?? '').trim()
  if (KNOWN.has(fromCell.toLowerCase())) return KNOWN.get(fromCell.toLowerCase())
  const key = merchantKey(title)
  const match = key && learned.find(([known]) => hasPhrase(key, known))
  return match?.[1] ?? ruleCategory(fromCell) ?? ruleCategory(title) ?? 'Other'
}

// --- Rows -------------------------------------------------------------------

// ALL-CAPS bank text reads better as "Tesco Stores 3297".
function tidyTitle(text) {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  const shouting = /[A-Z]{2}/.test(clean) && !/[a-z]/.test(clean)
  const title = shouting
    ? clean.toLowerCase().replace(/(^|[\s(/&*-])([a-z])/g, (_, gap, ch) => gap + ch.toUpperCase())
    : clean
  return title.slice(0, LIMITS.title)
}

// Everything the review screen needs from a file's text.
export function analyzeCsv(text) {
  const all = parseCsv(text)
  if (all.length < 2) throw new Error('This file has no rows to import.')
  const headerIndex = findHeaderRow(all)
  const headers = all[headerIndex].map((h, i) => h.trim() || `Column ${i + 1}`)
  const rows = all.slice(headerIndex + 1)
  if (rows.length === 0) throw new Error('This file has a header but no rows.')
  const mapping = guessColumns(headers)
  return {
    headers,
    rows,
    firstLine: headerIndex + 2, // line number of rows[0] in the file
    mapping,
    dateOrder: detectDateOrder(mapping.date === -1 ? [] : rows.map((r) => r[mapping.date] ?? '')),
    sign: guessSign(rows, mapping),
  }
}

// With one amount column and no usable Type column: if nothing is
// negative it's most likely a card statement or a list of purchases, so
// treat every row as an expense. Otherwise minus means money out.
export function guessSign(rows, mapping) {
  if (mapping.amount === -1) return 'negative-expense'
  const amounts = rows.map((r) => parseAmount(r[mapping.amount])).filter((v) => v !== null)
  return amounts.length && amounts.every((v) => v >= 0) ? 'positive-expense' : 'negative-expense'
}

// Rows in the file -> entries to review. Each has `problem` (why it can't
// be imported), `duplicate` (an entry with the same date, type and amount
// already exists) and `include` (imported unless either of those).
export function buildCandidates({ rows, firstLine }, mapping, { dateOrder, sign }, existing) {
  // Drops the apostrophe our export puts before "=..." to stop formulas.
  const cell = (row, field) =>
    mapping[field] >= 0 ? (row[mapping[field]] ?? '').trim().replace(/^'(?=[=+\-@])/, '') : ''
  const learned = learnCategories(existing)
  const maxCents = Math.round(LIMITS.maxAmount * 100)

  const seen = {}
  for (const e of existing) {
    const key = `${e.expense_date}|${e.type}|${toCents(e.amount)}`
    seen[key] = (seen[key] ?? 0) + 1
  }

  return rows.map((row, index) => {
    const date = parseDateValue(cell(row, 'date'), dateOrder)
    let cents = null
    let type = 'expense'
    if (mapping.amount >= 0) {
      const value = parseAmount(cell(row, 'amount'))
      if (value !== null) {
        const stated = mapping.type >= 0 ? readType(cell(row, 'type')) : null
        type = stated ?? ((value < 0) === (sign === 'negative-expense') ? 'expense' : 'income')
        cents = Math.abs(value)
      }
    } else {
      const out = parseAmount(cell(row, 'debit'))
      const into = parseAmount(cell(row, 'credit'))
      if (out) {
        cents = Math.abs(out)
      } else if (into) {
        cents = Math.abs(into)
        type = 'income'
      }
    }

    const title = tidyTitle(cell(row, 'title'))
    const note = mapping.note !== mapping.title ? cell(row, 'note') : ''
    let problem = null
    if (mapping.date === -1 || !date) problem = 'Date not readable'
    else if (!cents) problem = 'No amount'
    else if (cents > maxCents) problem = 'Amount too large'

    let duplicate = false
    if (!problem) {
      const key = `${date}|${type}|${cents}`
      if (seen[key] > 0) {
        duplicate = true
        seen[key] -= 1
      }
    }

    return {
      line: firstLine + index,
      date,
      title,
      note,
      type,
      cents,
      category: type === 'income' ? INCOME_CATEGORY : guessCategory(title, cell(row, 'category'), learned),
      problem,
      duplicate,
      include: !problem && !duplicate,
    }
  })
}

// Request body rows for POST /api/expenses/import.
export function toImportPayload(candidates) {
  return candidates.map((c) => ({
    type: c.type,
    title: c.title || null,
    amount: (c.cents / 100).toFixed(2),
    category: c.category,
    expense_date: c.date,
    description: c.note || null,
  }))
}
