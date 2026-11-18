// Reading and writing CSV files, and Spendora's own export format.

import { toIsoDate } from './format'

// The delimiter used most on the first line (outside quotes): comma, or
// semicolon / tab, which many European banks use.
function detectDelimiter(text) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && ch in counts) counts[ch] += 1
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return count > 0 ? best : ','
}

// Rows of cells. Handles quoted fields (with "" for a quote, and line
// breaks inside), CRLF or LF line ends, and a byte-order mark. Blank lines
// are dropped.
export function parseCsv(input) {
  const text = input.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch !== '"') field += ch
      else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else quoted = false
    } else if (ch === '"' && field.trim() === '') {
      quoted = true
      field = ''
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

// Text that starts with = + - @ would run as a formula when the file is
// opened in Excel or Google Sheets. A leading apostrophe keeps it as text.
const safeText = (value) => (/^[=+\-@\t\r]/.test(value ?? '') ? `'${value}` : (value ?? ''))

export const EXPORT_HEADERS = ['Date', 'Type', 'Category', 'Title', 'Amount', 'Note']

// Every entry, oldest first. Amounts are plain positive numbers ("12.50")
// with the Type column saying which way the money went, so the file opens
// cleanly in any spreadsheet - and imports back into Spendora as is.
export function entriesToCsv(entries) {
  const sorted = [...entries].sort(
    (a, b) => a.expense_date.localeCompare(b.expense_date) || a.id - b.id,
  )
  return toCsv([
    EXPORT_HEADERS,
    ...sorted.map((e) => [
      e.expense_date,
      e.type,
      safeText(e.category),
      safeText(e.title),
      Number(e.amount).toFixed(2),
      safeText(e.description ?? ''),
    ]),
  ])
}

// Save text as a .csv download. The byte-order mark makes Excel read it as
// UTF-8, so symbols like € and ₹ show correctly.
export function downloadCsv(text, filename = `spendora-${toIsoDate(new Date())}.csv`) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
