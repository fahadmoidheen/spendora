// The display currency is picked in the header - see ../currency.js.

// Income entries are always filed under this category.
export const INCOME_CATEGORY = 'Income'

// Expense categories offered in the form. Each has a 24x24 stroke icon drawn in
// the style of the design's UI kit (round caps, 2px stroke).
export const CATEGORIES = [
  {
    name: 'Food',
    icon: 'M6 3v7a2 2 0 0 0 4 0V3 M8 12v9 M17 21V3c-2 1-3 4-3 7s1 4 3 4',
  },
  {
    name: 'Transport',
    icon: 'M8 5h8a3 3 0 0 1 3 3v8H5V8a3 3 0 0 1 3-3z M5 12h14 M8 19v.01 M16 19v.01',
  },
  { name: 'Housing', icon: 'M4 11l8-7 8 7v9H4z M10 20v-6h4v6' },
  { name: 'Utilities', icon: 'M13 3L5 14h6l-1 7 8-11h-6z' },
  {
    name: 'Shopping',
    icon: 'M3 4h2l2.4 11h10.2l2-8H6.2 M9 20h.01 M17 20h.01',
  },
  {
    name: 'Health',
    icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6a4 4 0 0 1 7 2.6c0 5.6-7 10-7 10z',
  },
  {
    name: 'Entertainment',
    icon: 'M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M14 8v10',
  },
  {
    name: 'Travel',
    icon: 'M6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M9 7V5h6v2 M9 11v5 M15 11v5',
  },
  { name: 'Other', icon: 'M3 12V4h8l10 10-8 8z M7.5 7.5h.01' },
]

const ICON_BY_NAME = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.name, c.icon])),
  [INCOME_CATEGORY]: 'M17 7L7 17 M15 17H7V9', // arrow in
}

// Unknown categories (e.g. typed in through the API) get the "Other" tag.
export function categoryIcon(name) {
  return ICON_BY_NAME[name] ?? ICON_BY_NAME.Other
}

// Limits that match the backend Expense model, so the form rejects
// anything the database would.
export const LIMITS = {
  title: 120, // String(120)
  maxAmount: 99_999_999.99, // Numeric(10, 2)
}

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
]
