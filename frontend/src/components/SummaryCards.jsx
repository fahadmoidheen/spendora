import { useMoney } from '../currency'
import { currentMonthKey, previousMonthKey, sumCents } from '../utils/format'
import {
  inMonth,
  onlyExpenses,
  onlyIncome,
  spentByCategory,
} from '../utils/transactions'
import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CartIcon,
  LogoMark,
} from './Icons'

function StatCard({ label, icon, value, note, noteClass = '' }) {
  return (
    <div className="stat">
      <div className="stat-head">
        <p className="stat-label">{label}</p>
        <span className="stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="stat-value">{value}</p>
      <p className={`stat-note ${noteClass}`}>{note}</p>
    </div>
  )
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// The design's four cards: net (the forest hero), money in, money out and
// budget left - all for the current month.
export default function SummaryCards({ expenses, budgets }) {
  const money = useMoney()
  const thisKey = currentMonthKey()
  const thisMonth = inMonth(expenses, thisKey)
  const spentList = onlyExpenses(thisMonth)
  const incomeList = onlyIncome(thisMonth)
  const spent = sumCents(spentList)
  const received = sumCents(incomeList)
  const net = received - spent
  const lastSpent = sumCents(onlyExpenses(inMonth(expenses, previousMonthKey(thisKey))))

  let netNote = { text: 'Nothing yet this month' }
  if (received || spent) {
    netNote =
      net >= 0
        ? { icon: <ArrowDownLeftIcon />, text: 'More in than out' }
        : { icon: <ArrowUpRightIcon />, text: 'Spending above income' }
  }

  let spentNote = plural(spentList.length, 'expense')
  if (lastSpent > 0) {
    const pct = Math.round(((spent - lastSpent) / lastSpent) * 100)
    if (pct > 0) spentNote = `${pct}% more than last month`
    else if (pct < 0) spentNote = `${-pct}% less than last month`
    else spentNote = 'Same as last month'
  }

  // Budget left: limits minus this month's spending in those categories.
  const spentBy = spentByCategory(expenses, thisKey)
  const limitTotal = budgets.reduce((t, b) => t + Math.round(Number(b.monthly_limit) * 100), 0)
  const budgetSpent = budgets.reduce((t, b) => t + (spentBy[b.category] ?? 0), 0)
  const left = limitTotal - budgetSpent

  let budgetValue = '—'
  let budgetNote = 'No budgets yet'
  let budgetNoteClass = ''
  if (budgets.length) {
    budgetValue = money.format(Math.max(left, 0))
    if (left < 0) {
      budgetNote = `Over by ${money.format(-left)}`
      budgetNoteClass = 'is-danger'
    } else {
      budgetNote = `of ${money.format(limitTotal)} across ${plural(budgets.length, 'budget')}`
    }
  }

  return (
    <div className="stats">
      <div className="stat stat-hero">
        <LogoMark className="stat-watermark" strokeWidth={7} dot={6.5} />
        <p className="stat-label">Net this month</p>
        <p className="stat-value">{money.formatNet(net)}</p>
        <p className="stat-note">
          {netNote.icon}
          {netNote.text}
        </p>
      </div>

      <StatCard
        label="Money in"
        icon={<ArrowDownLeftIcon />}
        value={money.format(received)}
        note={incomeList.length ? plural(incomeList.length, 'payment') : 'This month'}
      />

      <StatCard
        label="Money out"
        icon={lastSpent > 0 && spent < lastSpent ? <ArrowDownRightIcon /> : <ArrowUpRightIcon />}
        value={money.format(spent)}
        note={spentNote}
      />

      <StatCard
        label="Budget left"
        icon={<CartIcon />}
        value={budgetValue}
        note={budgetNote}
        noteClass={budgetNoteClass}
      />
    </div>
  )
}
