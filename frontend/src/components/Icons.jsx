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
export const LogoutIcon = () => (
  <PathIcon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 16l-4-4 4-4 M6 12h10" />
)
export const MailIcon = () => (
  <PathIcon d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M3 7l9 6 9-6" />
)
export const CopyIcon = () => (
  <PathIcon d="M9 9h10v10H9z M5 15V5h10" />
)

// Google's "G", in its own colours, for the sign-in button.
export function GoogleIcon() {
  return (
    <svg className="icon" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
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

// Heads-up panel: budget warnings and tips.
export const AlertTriangleIcon = () => <PathIcon d="M12 4l9 16H3z M12 10v4 M12 17h.01" />
export const AlertCircleIcon = () => (
  <PathIcon d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8v5 M12 16h.01" />
)
export const TrendUpIcon = () => <PathIcon d="M3 17l6-6 4 4 8-8 M15 7h6v6" />
export const TrendDownIcon = () => <PathIcon d="M3 7l6 6 4-4 8 8 M15 17h6v-6" />
export const RepeatIcon = () => (
  <PathIcon d="M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3" />
)
export const GaugeIcon = () => <PathIcon d="M4.5 18a9 9 0 1 1 15 0 M12 14l4-5" />

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
