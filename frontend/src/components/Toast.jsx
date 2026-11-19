import { useEffect } from 'react'
import { CheckIcon, CloseIcon } from './Icons'

const SHOW_FOR_MS = 3000

// A short confirmation at the bottom of the screen ("Expense saved") that
// hides itself. Same shape as the budget notice (BudgetToast).
export default function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="toast-bar toast-alert is-good">
      <span className="headsup-icon" aria-hidden="true">
        <CheckIcon />
      </span>
      <p>
        <strong>{message}</strong>
      </p>
      <button type="button" className="btn btn-ghost btn-icon btn-icon-sm" aria-label="Dismiss" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  )
}
