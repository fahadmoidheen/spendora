import { useMoney } from '../../currency'
import { CategoryIcon } from '../Icons'
import { ChartCard, EmptyChart } from './ChartParts'
import { slotColor, useChartColors } from './useChartColors'

// Where the money went: a thin segmented bar for the overall split, above
// a ranked list that gives each category's amount and share. (Better than
// a ring chart: close amounts are easy to compare in the list.)
export default function CategorySplit({ split }) {
  const money = useMoney()
  const colors = useChartColors()
  const { parts, total } = split

  const top = parts.find((p) => p.name !== 'Other')
  const subtitle = top
    ? `${top.name} took ${Math.round(top.share * 100)}% of your spending.`
    : null

  const description = parts
    .map((p) => `${p.name} ${Math.round(p.share * 100)}%`)
    .join(', ')

  return (
    <ChartCard title="Where your money went" subtitle={subtitle}>
      {total > 0 ? (
        <>
          <div className="split-bar" role="img" aria-label={`Spending by category: ${description}`}>
            {parts.map((part) => (
              <span
                key={part.name}
                className="split-seg"
                style={{ flexGrow: part.cents, background: slotColor(colors, part.slot) }}
                title={`${part.name}: ${money.format(part.cents)} (${Math.round(part.share * 100)}%)`}
              />
            ))}
          </div>
          <ul className="split-list">
            {parts.map((part) => (
              <li key={part.name}>
                <span
                  className="legend-key legend-key-box"
                  style={{ background: slotColor(colors, part.slot) }}
                  aria-hidden="true"
                />
                <span className="split-name">
                  <CategoryIcon name={part.name} />
                  {part.name}
                </span>
                <span className="split-amount">{money.format(part.cents)}</span>
                <span className="split-share">{Math.round(part.share * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyChart>No spending in this period yet.</EmptyChart>
      )}
    </ChartCard>
  )
}
