// Paging for the transactions list (components/Pagination.jsx).

export const PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25
const STORAGE_KEY = 'spendora:page-size'

// The rows-per-page choice is remembered in this browser.
export function loadPageSize() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return PAGE_SIZES.includes(saved) ? saved : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

export function savePageSize(size) {
  try {
    localStorage.setItem(STORAGE_KEY, String(size))
  } catch {
    // Storage blocked (private window): the choice lasts until reload.
  }
}

// Page buttons to show: always the first and last page and the ones next
// to the current page, with gaps between - [1, 'gap', 4, 5, 6, 'gap', 12].
// A gap that would hide a single page shows that page instead.
export function pageNumbers(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const wanted = new Set([1, count, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach((p) => wanted.add(p))
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => wanted.add(p))
  const pages = [...wanted].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)

  const out = []
  let previous = 0
  for (const p of pages) {
    if (p - previous === 2) out.push(previous + 1)
    else if (p - previous > 2) out.push(`gap-${p}`)
    out.push(p)
    previous = p
  }
  return out
}
