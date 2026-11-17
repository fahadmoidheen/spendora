// Stroke icons in the design's UI-kit style: 24x24, 2px round strokes.
// They take the current text colour and are hidden from screen readers -
// buttons that show only an icon carry an aria-label instead.
import { categoryIcon } from '../constants'

export function PathIcon({ d, className = 'icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const EditIcon = () => <PathIcon d="M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4" />
export const TrashIcon = () => <PathIcon d="M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13" />
export const PlusIcon = () => <PathIcon d="M12 5v14M5 12h14" />
export const SearchIcon = () => (
  <PathIcon d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M20 20l-4-4" />
)
export const CalendarIcon = () => (
  <PathIcon d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M4 10h16 M9 3v4 M15 3v4" />
)
export const ChevronLeftIcon = () => <PathIcon d="M15 6l-6 6 6 6" />
export const ChevronDownIcon = () => <PathIcon d="M6 9l6 6 6-6" />
export const CheckIcon = () => <PathIcon d="M5 12l5 5 9-11" />
export const FilterIcon = () => <PathIcon d="M4 6h16 M7 12h10 M10 18h4" />
export const ChevronRightIcon = () => <PathIcon d="M9 6l6 6-6 6" />
// Money out / money in, as in the design.
export const ArrowUpRightIcon = () => <PathIcon d="M7 17L17 7 M9 7h8v8" />
export const ArrowDownLeftIcon = () => <PathIcon d="M17 7L7 17 M15 17H7V9" />
export const ArrowDownRightIcon = () => <PathIcon d="M7 7l10 10 M17 9v8H9" />
export const CartIcon = () => (
  <PathIcon d="M3 4h2l2.4 11h10.2l2-8H6.2 M9 20h.01 M17 20h.01" />
)
export const CloseIcon = () => <PathIcon d="M6 6l12 12 M18 6L6 18" />
export const SunIcon = () => (
  <PathIcon d="M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4" />
)
export const MoonIcon = () => <PathIcon d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
export const ReceiptIcon = () => (
  <PathIcon d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 8h6 M9 12h6 M9 16h3" />
)

export function CategoryIcon({ name }) {
  return <PathIcon d={categoryIcon(name)} />
}

// Spendora mark: a dollar sign drawn as one line that starts at a coin and
// ends in an arrow. Geometry from the logo design; the default stroke is
// the design's small-size weight so it stays crisp in the header.
export function LogoMark({ className = 'logo-mark', strokeWidth = 9, dot = 7.5 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M50 9v11M50 80v11" />
      <path d="M64 36A14 14 0 1 0 50 50A14 14 0 1 1 36 64" />
      <path d="M29 71l7-7 7 7" />
      <circle cx="64" cy="36" r={dot} fill="currentColor" stroke="none" />
    </svg>
  )
}
