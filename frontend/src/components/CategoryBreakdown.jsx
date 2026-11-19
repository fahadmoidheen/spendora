import { useMoney } from '../currency'
import { sumCents, toCents } from '../utils/format'
import { onlyExpenses } from '../utils/transactions'
import CategoryTile from './CategoryTile'
import { BreakdownSkeleton } from './Skeleton'

function totalsByCategory(expenses) {
  const totals = {}
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] ?? 0) + toCents(e.amount)
  }
  return Object.entries(totals)
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents)
}

// Where the shown expenses went, by category (income is left out).
// status: "loading" | "error" | "ready" (App's load status). `control`
// (e.g. a period picker) replaces the `label` text in the header.
export default function CategoryBreakdown({ expenses, label, control, status = 'ready' }) {
  const money = useMoney()
  const spending = onlyExpenses(expenses)
  const rows = totalsByCategory(spending)
  const total = sumCents(spending)

  return (
    <section className="panel" aria-labelledby="breakdown-title">
      <div className="panel-head">
        <h2 id="breakdown-title" className="panel-title">
          By category
        </h2>
        {control ?? <span className="panel-sub">{label}</span>}
      </div>

      {status === 'loading' ? (
        <BreakdownSkeleton rows={4} />
      ) : status === 'error' ? (
        <p className="stat-note">Spending couldn’t be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="stat-note">No spending to show yet.</p>
      ) : (
        <ul className="breakdown">
          {rows.map((row) => {
            const pct = Math.round((row.cents / total) * 100)
            return (
              <li key={row.name}>
                <div className="breakdown-top">
                  <CategoryTile name={row.name} size="sm" />
                  <div className="breakdown-text">
                    <p className="breakdown-name">{row.name}</p>
                    <p className="breakdown-detail">{money.format(row.cents)}</p>
                  </div>
                  <p className="breakdown-pct">{pct}%</p>
                </div>
                <div
                  className="bar"
                  role="progressbar"
                  aria-label={`${row.name} share of spending`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
