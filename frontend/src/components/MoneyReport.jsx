import { useMoney } from '../currency'
import { formatDate, formatFullDate, toCents, todayIso } from '../utils/format'
import { LogoMark } from './Icons'

const percent = (ratio) => `${Math.round(ratio * 100)}%`

// "↑ 12% vs October 2026" - plain words, no colour, so it prints anywhere.
function changeText(now, then, label) {
  if (then == null) return null
  if (then === 0) return now === 0 ? `Nothing in ${label} either` : `Nothing in ${label}`
  const change = Math.round(((now - then) / then) * 100)
  if (change === 0) return `Same as ${label}`
  return `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}% vs ${label}`
}

function Total({ label, value, note, className = '' }) {
  return (
    <div className={`report-total ${className}`.trim()}>
      <p className="report-total-label">{label}</p>
      <p className="report-total-value">{value}</p>
      {note && <p className="report-total-note">{note}</p>}
    </div>
  )
}

function Bar({ ratio, tone = '' }) {
  return (
    <span className={`report-bar ${tone}`.trim()} aria-hidden="true">
      <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </span>
  )
}

// The printable report: an A4 page in the app's style, always light. Used
// twice - as the preview in ReportDialog and, out of sight, as the only
// thing the browser prints (see "#print-root" in index.css).
export default function MoneyReport({ report, who }) {
  const money = useMoney()
  const { before } = report
  const count = report.entries.length
  const kept = report.income > 0 ? report.net / report.income : null

  return (
    <article className="report">
      <header className="report-head">
        <div className="report-brand">
          <span className="report-mark">
            <LogoMark strokeWidth={9} dot={7.5} />
          </span>
          <span className="report-wordmark">Spendora</span>
        </div>
        <div>
          <p className="report-kicker">Money report</p>
          <h1 className="report-title">{report.label}</h1>
        </div>
      </header>
      <p className="report-meta">
        {who && <>Prepared for {who} · </>}
        Generated {formatFullDate(todayIso())} · Amounts in {money.code}
      </p>

      <section className="report-totals" aria-label="Totals">
        <Total
          label="Money in"
          value={money.format(report.income)}
          note={before && changeText(report.income, before.income, before.label)}
        />
        <Total
          label="Money out"
          value={money.format(report.spent)}
          note={before && changeText(report.spent, before.spent, before.label)}
        />
        <Total
          className={`is-net${report.net < 0 ? ' is-negative' : ''}`}
          label="Net"
          value={money.formatNet(report.net)}
          note={kept === null ? null : kept >= 0 ? `${percent(kept)} of money in kept` : 'Spent more than came in'}
        />
      </section>

      {count === 0 ? (
        <p className="report-empty">No transactions in this period.</p>
      ) : (
        <>
          {report.categories.length > 0 && (
            <section className="report-section">
              <h2>Spending by category</h2>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Entries</th>
                    <th className="num">Amount</th>
                    <th className="report-share-head">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td className="num">{c.count}</td>
                      <td className="num">{money.format(c.cents)}</td>
                      <td>
                        <span className="report-share">
                          <Bar ratio={c.share} />
                          <span className="report-share-pct">{percent(c.share)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{report.categories.reduce((n, c) => n + c.count, 0)}</td>
                    <td className="num">{money.format(report.spent)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {report.budgets.length > 0 && (
            <section className="report-section">
              <h2>Budgets</h2>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Limit</th>
                    <th className="num">Spent</th>
                    <th className="num">Left</th>
                    <th className="report-share-head">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {report.budgets.map((b) => {
                    const left = b.limitCents - b.spentCents
                    const tone = { over: 'is-danger', warning: 'is-warning' }[b.level] ?? ''
                    return (
                      <tr key={b.id}>
                        <td>{b.category}</td>
                        <td className="num">{money.format(b.limitCents)}</td>
                        <td className="num">{money.format(b.spentCents)}</td>
                        <td className={`num${left < 0 ? ' report-over' : ''}`}>
                          {left < 0 ? `Over by ${money.format(-left)}` : money.format(left)}
                        </td>
                        <td>
                          <span className="report-share">
                            <Bar ratio={b.ratio} tone={tone} />
                            <span className="report-share-pct">{percent(b.ratio)}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}

          {report.months.length > 1 && (
            <section className="report-section">
              <h2>Month by month</h2>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Money in</th>
                    <th className="num">Money out</th>
                    <th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td className="num">{money.format(m.income)}</td>
                      <td className="num">{money.format(m.spent)}</td>
                      <td className={`num${m.income - m.spent < 0 ? ' report-over' : ''}`}>
                        {money.formatNet(m.income - m.spent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="report-section">
            <h2>
              Transactions <span className="report-count">{count}</span>
            </h2>
            <table className="report-table report-tx">
              <thead>
                <tr>
                  <th className="report-tx-date">Date</th>
                  <th>Title</th>
                  <th className="report-tx-category">Category</th>
                  <th className="num report-tx-amount">Amount</th>
                </tr>
              </thead>
              {report.months.map((m) => (
                <tbody key={m.key}>
                  <tr className="report-month-row">
                    <th colSpan={3} scope="colgroup">
                      {m.label}
                      <span className="report-note"> · {m.entries.length} entries</span>
                    </th>
                    <th className="num">
                      <span className="report-note">Net </span>
                      {money.formatNet(m.income - m.spent)}
                    </th>
                  </tr>
                  {m.entries.map((e) => {
                    const income = e.type === 'income'
                    return (
                      <tr key={e.id}>
                        <td className="report-tx-date">{formatDate(e.expense_date)}</td>
                        <td>
                          {e.title}
                          {e.description && <span className="report-note"> · {e.description}</span>}
                        </td>
                        <td className="report-tx-category">{e.category}</td>
                        <td className={`num${income ? ' report-income' : ''}`}>
                          {money.formatSigned(toCents(e.amount), income ? 1 : -1)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </section>
        </>
      )}

      <footer className="report-foot">
        <span>Spendora · {report.label}</span>
        <span>
          {count} {count === 1 ? 'transaction' : 'transactions'}
        </span>
      </footer>
    </article>
  )
}
