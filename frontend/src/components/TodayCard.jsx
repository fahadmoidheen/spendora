import { useMoney } from '../currency'
import { parseDate, todayIso } from '../utils/format'
import { dueNow, todaySpending } from '../utils/todos'
import { AlertTriangleIcon, ChevronRightIcon, PlusIcon } from './Icons'
import TodoList from './TodoList'

const MAX_SHOWN = 5

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "Today" at the top of the Transactions tab: what was spent today, how
// much of today's budget share is left, and the to-dos due today (overdue
// ones first).
export default function TodayCard({ todos, expenses, budgets, onAdd, onOpenAll, ...listProps }) {
  const money = useMoney()
  const today = todayIso()
  const due = dueNow(todos, today)
  const overdue = due.filter((t) => t.due_date < today).length
  const spending = todaySpending(expenses, budgets, today)
  const hasPace = spending.paceCents !== null
  const over = hasPace && spending.leftCents < 0

  // "Saturday, November 22" - the year is noise here.
  const dateText = parseDate(today).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <section className="panel today" aria-labelledby="today-title">
      <div className="panel-head">
        <div className="panel-head-text">
          <h2 id="today-title" className="panel-title">
            Today
          </h2>
          <span className="panel-sub">{dateText}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>
          <PlusIcon />
          Add to-do
        </button>
      </div>

      <div className="today-stats">
        <div className="today-stat">
          <p className="today-stat-label">Spent today</p>
          <p className="today-stat-value">{money.format(spending.spentCents)}</p>
          <p className="today-stat-note">
            {spending.count ? plural(spending.count, 'expense') : 'Nothing yet'}
          </p>
        </div>

        {hasPace ? (
          <div className={`today-stat${over ? ' is-warning' : ''}`}>
            <p className="today-stat-label">
              {over && <AlertTriangleIcon />}
              {over ? 'Over today’s budget' : 'Left for today'}
            </p>
            <p className="today-stat-value">{money.format(Math.abs(spending.leftCents))}</p>
            <p className="today-stat-note">
              Daily budget {money.format(spending.paceCents)}, to stay within this month’s budgets
            </p>
          </div>
        ) : (
          <div className="today-stat">
            <p className="today-stat-label">Left for today</p>
            <p className="today-stat-value">—</p>
            <p className="today-stat-note">Set budgets in Categories to get a daily amount</p>
          </div>
        )}
      </div>

      <div className="today-todos">
        <h3 className="todo-section-title">
          Due today
          {overdue > 0 && <span className="is-overdue">{overdue} overdue</span>}
        </h3>
        {due.length > 0 ? (
          <TodoList todos={due.slice(0, MAX_SHOWN)} compact {...listProps} />
        ) : (
          <p className="stat-note">Nothing due today.</p>
        )}
        <button type="button" className="btn btn-ghost btn-sm today-all" onClick={onOpenAll}>
          {due.length > MAX_SHOWN ? `See all ${due.length}` : 'All to-dos'}
          <ChevronRightIcon />
        </button>
      </div>
    </section>
  )
}
