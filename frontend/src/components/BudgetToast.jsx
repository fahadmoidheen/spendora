import { useEffect } from 'react'
import { useMoney } from '../currency'
import { AlertCircleIcon, AlertTriangleIcon, CloseIcon } from './Icons'

const SHOW_FOR_MS = 8000

// Pops up when a save pushes a budget past 80% or 100%. Hides itself after
// a few seconds. `alert` comes from newlyCrossed() in utils/budgetAlerts.
export default function BudgetToast({ alert, onClose }) {
  const money = useMoney()

  useEffect(() => {
    const timer = setTimeout(onClose, SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [alert, onClose])

  const over = alert.level === 'over'
  const Icon = over ? AlertCircleIcon : AlertTriangleIcon
  const pct = Math.round(alert.ratio * 100)
  const title = over ? `${alert.category} is now over budget` : `${alert.category} budget is at ${pct}%`
  const detail = over
    ? `${money.format(alert.spentCents)} of ${money.format(alert.limitCents)} spent this month.`
    : `${money.format(alert.limitCents - alert.spentCents)} left this month.`

  return (
    <div className={`toast-bar toast-alert is-${over ? 'danger' : 'warning'}`}>
      <span className="headsup-icon" aria-hidden="true">
        <Icon />
      </span>
      <p>
        <strong>{title}</strong>
        <span>{detail}</span>
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-icon-sm"
        aria-label="Dismiss"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
