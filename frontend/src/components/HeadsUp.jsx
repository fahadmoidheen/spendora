import { useMemo, useState } from 'react'
import { useMoney } from '../currency'
import { budgetAlerts, daysLeftInMonth } from '../utils/budgetAlerts'
import { currentMonthKey, formatDate } from '../utils/format'
import { categoryChanges, monthOutlook, upcomingRepeats } from '../utils/tips'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CloseIcon,
  GaugeIcon,
  RepeatIcon,
  TrendDownIcon,
  TrendUpIcon,
} from './Icons'

const MAX_TIPS = 4

const percent = (ratio) => `${Math.round(Math.abs(ratio) * 100)}%`
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function daysLeftText(days) {
  if (days === 0) return 'last day of the month'
  return `${plural(days, 'day')} to go`
}

function dueText(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// Budget warnings first (red, then amber), then up to four tips. Every item
// has a key that includes the month, so a dismissed item comes back next
// month - and a warning that becomes "over budget" is a new item.
function buildItems(budgets, expenses, money) {
  const month = currentMonthKey()
  const items = []

  const daysLeft = daysLeftInMonth()
  for (const a of budgetAlerts(budgets, expenses)) {
    const key = `budget:${month}:${a.category}:${a.level}`
    if (a.level === 'over') {
      const overBy = a.spentCents - a.limitCents
      items.push({
        key,
        tone: 'danger',
        Icon: AlertCircleIcon,
        title: overBy > 0 ? `${a.category} is over budget` : `${a.category} budget is used up`,
        detail:
          overBy > 0
            ? `${money.format(a.spentCents)} of ${money.format(a.limitCents)} · ${money.format(overBy)} over`
            : `${money.format(a.limitCents)} spent · ${daysLeftText(daysLeft)}`,
      })
    } else {
      items.push({
        key,
        tone: 'warning',
        Icon: AlertTriangleIcon,
        title: `${a.category} budget is at ${percent(a.ratio)}`,
        detail: `${money.format(a.limitCents - a.spentCents)} left · ${daysLeftText(daysLeft)}`,
      })
    }
  }

  const tips = []
  const changes = categoryChanges(expenses)
  for (const c of changes.filter((c) => c.change > 0)) {
    tips.push({
      key: `tip:${month}:${c.category}:up`,
      tone: 'note',
      Icon: TrendUpIcon,
      title: `${c.category} is ${percent(c.change)} above your usual`,
      detail: `${money.formatWhole(c.currentCents)} so far, vs. about ${money.formatWhole(c.usualCents)} by this point in a usual month`,
    })
  }

  const repeats = upcomingRepeats(expenses)
  if (repeats.length === 1) {
    const [r] = repeats
    tips.push({
      key: `tip:${month}:repeat:${r.title.toLowerCase()}`,
      tone: 'note',
      Icon: RepeatIcon,
      title: `${r.title} is likely due ${dueText(r.daysUntil)}`,
      detail: `About ${money.format(r.amountCents)} around ${formatDate(r.dueDate)} — you’ve paid it each month lately`,
    })
  } else if (repeats.length > 1) {
    tips.push({
      key: `tip:${month}:repeats:${repeats.map((r) => r.title.toLowerCase()).join('|')}`,
      tone: 'note',
      Icon: RepeatIcon,
      title: `${repeats.length} repeating payments due in the next 7 days`,
      detail: repeats
        .map((r) => `${r.title} ${money.format(r.amountCents)} (${formatDate(r.dueDate)})`)
        .join(' · '),
    })
  }

  const outlook = monthOutlook(expenses)
  if (outlook) {
    const more = outlook.change > 0
    tips.push({
      key: `tip:${month}:outlook:${more ? 'up' : 'down'}`,
      tone: more ? 'note' : 'good',
      Icon: GaugeIcon,
      title: `On pace for about ${money.formatWhole(outlook.projectedCents)} this month`,
      detail: `${percent(outlook.change)} ${more ? 'more' : 'less'} than a usual month (${money.formatWhole(outlook.usualCents)})`,
    })
  }

  for (const c of changes.filter((c) => c.change < 0)) {
    tips.push({
      key: `tip:${month}:${c.category}:down`,
      tone: 'good',
      Icon: TrendDownIcon,
      title: `${c.category} is ${percent(c.change)} below your usual`,
      detail: `${money.formatWhole(c.currentCents)} so far, vs. about ${money.formatWhole(c.usualCents)} by now in a usual month`,
    })
  }

  return [...items, ...tips.slice(0, MAX_TIPS)]
}

// Dismissed items are remembered per user in this browser. Only this
// month's keys are kept, so the list never grows.
const storageKey = (userId) => `spendora:headsup-dismissed:${userId ?? 'me'}`

function loadDismissed(userId) {
  const month = `:${currentMonthKey()}:`
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    return new Set(Array.isArray(saved) ? saved.filter((k) => k.includes(month)) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(userId, keys) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...keys]))
  } catch {
    // Storage blocked (private window): dismissals last until reload.
  }
}

// The Overview's "Heads-up" panel: budgets close to or over their limit,
// then short tips from the user's own history. Hidden when there's
// nothing to say.
export default function HeadsUp({ budgets, expenses, userId }) {
  const money = useMoney()
  const [dismissed, setDismissed] = useState(() => loadDismissed(userId))

  const items = useMemo(
    () => buildItems(budgets, expenses, money).filter((item) => !dismissed.has(item.key)),
    [budgets, expenses, money, dismissed],
  )

  if (items.length === 0) return null

  function dismiss(key) {
    const next = new Set(dismissed).add(key)
    setDismissed(next)
    saveDismissed(userId, next)
  }

  const alertCount = items.filter((i) => i.tone === 'danger' || i.tone === 'warning').length

  return (
    <section className="panel headsup" aria-labelledby="headsup-title">
      <div className="panel-head">
        <h2 id="headsup-title" className="panel-title">
          Heads-up
        </h2>
        <span className="panel-sub">
          {alertCount
            ? `${plural(alertCount, 'budget')} need${alertCount === 1 ? 's' : ''} attention`
            : 'From your last few months'}
        </span>
      </div>
      <ul className="headsup-list">
        {items.map(({ key, tone, Icon, title, detail }) => (
          <li key={key} className={`headsup-item is-${tone}`}>
            <span className="headsup-icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="headsup-text">
              <p className="headsup-title">{title}</p>
              <p className="headsup-detail">{detail}</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-icon-sm"
              aria-label={`Dismiss: ${title}`}
              title="Dismiss"
              onClick={() => dismiss(key)}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
