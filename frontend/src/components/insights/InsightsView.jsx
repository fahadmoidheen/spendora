import { useMemo, useState } from 'react'
import { useMoney } from '../../currency'
import { sumCents } from '../../utils/format'
import {
  categorySplit,
  inMonths,
  monthlyFlow,
  monthPace,
  PERIODS,
  periodMonths,
  weekdaySpending,
} from '../../utils/insights'
import { onlyExpenses, onlyIncome } from '../../utils/transactions'
import { ArrowDownLeftIcon, ArrowUpRightIcon, LogoMark } from '../Icons'
import Select from '../Select'
import CategorySplit from './CategorySplit'
import MonthlyFlowChart from './MonthlyFlowChart'
import MonthPaceChart from './MonthPaceChart'
import WeekdayChart from './WeekdayChart'

// The Insights view. "This month's pace" always covers the current month,
// so it sits above the period picker; everything below the picker follows
// the chosen period.
export default function InsightsView({ expenses }) {
  const money = useMoney()
  const [period, setPeriod] = useState('6m')

  const pace = useMemo(() => monthPace(expenses), [expenses])
  const months = useMemo(() => periodMonths(period), [period])
  const inPeriod = useMemo(() => inMonths(expenses, months), [expenses, months])
  const flow = useMemo(() => monthlyFlow(inPeriod, months), [inPeriod, months])
  const split = useMemo(() => categorySplit(inPeriod), [inPeriod])
  const days = useMemo(() => weekdaySpending(inPeriod), [inPeriod])

  const received = sumCents(onlyIncome(inPeriod))
  const spent = sumCents(onlyExpenses(inPeriod))
  const net = received - spent
  const periodLabel = PERIODS.find((p) => p.value === period).label.toLowerCase()

  if (expenses.length === 0) {
    return (
      <div className="empty-card">
        <span className="empty-mark" aria-hidden="true">
          <LogoMark strokeWidth={8} dot={7} />
        </span>
        <h3 className="empty-title">Nothing to analyse yet</h3>
        <p className="empty-text">Add a few expenses or income and your charts will appear here.</p>
      </div>
    )
  }

  return (
    <div className="insights">
      <MonthPaceChart pace={pace} />

      <div className="insights-filters">
        <Select
          label="Period"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          variant="filter"
        />
      </div>

      <div className="stats">
        <div className="stat stat-hero">
          <LogoMark className="stat-watermark" strokeWidth={7} dot={6.5} />
          <p className="stat-label">Net, {periodLabel}</p>
          <p className="stat-value">{money.formatNet(net)}</p>
          <p className="stat-note">{net >= 0 ? 'More in than out' : 'Spending above income'}</p>
        </div>
        <div className="stat">
          <div className="stat-head">
            <p className="stat-label">Money in</p>
            <span className="stat-icon" aria-hidden="true">
              <ArrowDownLeftIcon />
            </span>
          </div>
          <p className="stat-value">{money.format(received)}</p>
          <p className="stat-note">
            About {money.format(Math.round(received / months.length))} a month
          </p>
        </div>
        <div className="stat">
          <div className="stat-head">
            <p className="stat-label">Money out</p>
            <span className="stat-icon" aria-hidden="true">
              <ArrowUpRightIcon />
            </span>
          </div>
          <p className="stat-value">{money.format(spent)}</p>
          <p className="stat-note">
            About {money.format(Math.round(spent / months.length))} a month
          </p>
        </div>
      </div>

      <div className="insights-grid">
        <MonthlyFlowChart flow={flow} />
        <CategorySplit split={split} />
        <WeekdayChart days={days} />
      </div>
    </div>
  )
}
