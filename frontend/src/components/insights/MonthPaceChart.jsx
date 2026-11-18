import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMoney } from '../../currency'
import { formatMonth } from '../../utils/format'
import { shortMonth } from '../../utils/insights'
import { ChartCard, EmptyChart, Legend, TooltipCard } from './ChartParts'
import { axisProps, reduceMotion, useChartColors } from './useChartColors'

// This month's running spend against last month's, day by day. This month
// is the point (accent + light wash); last month is context (grey).
export default function MonthPaceChart({ pace }) {
  const money = useMoney()
  const colors = useChartColors()
  const { points, thisKey, lastKey, today, spentSoFar, lastAtSameDay } = pace
  const hasData = spentSoFar > 0 || points.some((p) => p.lastMonth)

  let subtitle = `Spent ${money.format(spentSoFar)} so far in ${formatMonth(thisKey)}.`
  if (lastAtSameDay > 0) {
    const diff = spentSoFar - lastAtSameDay
    subtitle +=
      diff === 0
        ? ' Same as this point last month.'
        : ` That's ${money.format(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than by day ${today} last month.`
  }

  const lastDay = points.length
  const ticks = [1, 8, 15, 22, lastDay].filter((d, i, all) => all.indexOf(d) === i)

  const table = (
    <table className="table-view">
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">{formatMonth(thisKey)}</th>
          <th scope="col">{formatMonth(lastKey)}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.day}>
            <th scope="row">{p.day}</th>
            <td>{p.thisMonth === null ? '—' : money.format(p.thisMonth)}</td>
            <td>{p.lastMonth === null ? '—' : money.format(p.lastMonth)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartCard
      className="chart-wide"
      title="This month’s pace"
      subtitle={subtitle}
      legend={
        <Legend
          items={[
            { label: formatMonth(thisKey), color: colors['chart-out'], shape: 'line' },
            { label: formatMonth(lastKey), color: colors['chart-last'], shape: 'line' },
          ]}
        />
      }
      table={hasData && table}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors['chart-grid']} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, lastDay]}
              ticks={ticks}
              {...axisProps(colors)}
            />
            <YAxis {...axisProps(colors)} axisLine={false} width={68} tickFormatter={money.formatAxis} />
            <Tooltip
              cursor={{ stroke: colors['chart-axis'], strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                const rows = []
                if (p.thisMonth !== null) {
                  rows.push({ label: `${shortMonth(thisKey)} ${p.day}`, value: money.format(p.thisMonth), color: colors['chart-out'] })
                }
                if (p.lastMonth !== null) {
                  rows.push({ label: `${shortMonth(lastKey)} ${p.day}`, value: money.format(p.lastMonth), color: colors['chart-last'] })
                }
                return <TooltipCard heading={`Spent by day ${p.day}`} rows={rows} />
              }}
            />
            <Line
              dataKey="lastMonth"
              name={formatMonth(lastKey)}
              stroke={colors['chart-last']}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
            <Area
              dataKey="thisMonth"
              name={formatMonth(thisKey)}
              stroke={colors['chart-out']}
              strokeWidth={2}
              fill={colors['chart-out']}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart>No spending this month or last month yet.</EmptyChart>
      )}
    </ChartCard>
  )
}
