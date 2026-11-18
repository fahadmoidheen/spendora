import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMoney } from '../../currency'
import { ChartCard, EmptyChart, TooltipCard } from './ChartParts'
import { axisProps, reduceMotion, useChartColors } from './useChartColors'

// Spending per day of the week. The busiest day is highlighted (accent);
// the others are grey, so the one that matters stands out.
export default function WeekdayChart({ days }) {
  const money = useMoney()
  const colors = useChartColors()
  const busiest = days.reduce((best, d) => (d.cents > best.cents ? d : best), days[0])
  const hasData = busiest.cents > 0

  const table = (
    <table className="table-view">
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Spent</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.day}>
            <th scope="row">{d.long}</th>
            <td>{money.format(d.cents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartCard
      title="Spending by day of week"
      subtitle={hasData ? `${busiest.long} is your biggest spending day.` : null}
      table={hasData && table}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={days} margin={{ top: 20, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={colors['chart-grid']} />
            <XAxis dataKey="short" {...axisProps(colors)} />
            <YAxis {...axisProps(colors)} axisLine={false} width={68} tickFormatter={money.formatAxis} />
            <Tooltip
              cursor={{ fill: colors['chart-grid'], fillOpacity: 0.6, stroke: 'none' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <TooltipCard
                    heading={d.long}
                    rows={[{ label: 'Spent', value: money.format(d.cents), color: d.day === busiest.day ? colors['chart-out'] : colors['series-muted'] }]}
                  />
                )
              }}
            />
            <Bar dataKey="cents" name="Spent" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!reduceMotion}>
              {days.map((d) => (
                <Cell key={d.day} fill={d.day === busiest.day ? colors['chart-out'] : colors['series-muted']} />
              ))}
              {/* Only the busiest day gets its value printed on top. */}
              <LabelList
                dataKey="cents"
                position="top"
                fill={colors.ink}
                fontSize={12}
                fontWeight={600}
                formatter={(value) => (value === busiest.cents ? money.formatAxis(value) : '')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart>No spending in this period yet.</EmptyChart>
      )}
    </ChartCard>
  )
}
