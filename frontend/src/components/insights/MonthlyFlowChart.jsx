import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMoney } from '../../currency'
import { formatMonth } from '../../utils/format'
import { shortMonth } from '../../utils/insights'
import { ChartCard, EmptyChart, Legend, TooltipCard } from './ChartParts'
import { axisProps, reduceMotion, useChartColors } from './useChartColors'

// Money in vs money out per month: grouped columns, one axis.
export default function MonthlyFlowChart({ flow }) {
  const money = useMoney()
  const colors = useChartColors()
  const data = flow.map((row) => ({ ...row, label: shortMonth(row.key) }))
  const hasData = flow.some((row) => row.inCents || row.outCents)

  const totalIn = flow.reduce((sum, r) => sum + r.inCents, 0)
  const totalOut = flow.reduce((sum, r) => sum + r.outCents, 0)
  const net = totalIn - totalOut
  const subtitle = hasData
    ? net >= 0
      ? `You kept ${money.format(net)} of what came in.`
      : `You spent ${money.format(-net)} more than came in.`
    : null

  const table = (
    <table className="table-view">
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Money in</th>
          <th scope="col">Money out</th>
          <th scope="col">Net</th>
        </tr>
      </thead>
      <tbody>
        {flow.map((row) => (
          <tr key={row.key}>
            <th scope="row">{formatMonth(row.key)}</th>
            <td>{money.format(row.inCents)}</td>
            <td>{money.format(row.outCents)}</td>
            <td>{money.formatNet(row.netCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartCard
      className="chart-wide"
      title="Money in and out"
      subtitle={subtitle}
      legend={
        <Legend
          items={[
            { label: 'Money in', color: colors['chart-in'] },
            { label: 'Money out', color: colors['chart-out'] },
          ]}
        />
      }
      table={hasData && table}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={colors['chart-grid']} />
            <XAxis dataKey="label" {...axisProps(colors)} />
            <YAxis
              {...axisProps(colors)}
              axisLine={false}
              width={68}
              tickFormatter={money.formatAxis}
            />
            <Tooltip
              cursor={{ fill: colors['chart-grid'], fillOpacity: 0.6, stroke: 'none' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload
                return (
                  <TooltipCard
                    heading={formatMonth(row.key)}
                    rows={[
                      { label: 'Money in', value: money.format(row.inCents), color: colors['chart-in'] },
                      { label: 'Money out', value: money.format(row.outCents), color: colors['chart-out'] },
                      { label: 'Net', value: money.formatNet(row.netCents), color: 'transparent' },
                    ]}
                  />
                )
              }}
            />
            <Bar
              dataKey="inCents"
              name="Money in"
              fill={colors['chart-in']}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduceMotion}
            />
            <Bar
              dataKey="outCents"
              name="Money out"
              fill={colors['chart-out']}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart>No money in or out in this period yet.</EmptyChart>
      )}
    </ChartCard>
  )
}
