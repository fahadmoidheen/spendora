// Small building blocks shared by the Insights charts.

// A chart's card: title, one-line takeaway, legend, the chart, and a
// "view as table" fallback so no value is only reachable by hovering.
export function ChartCard({ title, subtitle, legend, table, className = '', children }) {
  return (
    <section className={`panel chart-card ${className}`.trim()}>
      <div className="chart-head">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="chart-sub">{subtitle}</p>}
      </div>
      {legend}
      <div className="chart-body">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>View as table</summary>
          {table}
        </details>
      )}
    </section>
  )
}

// Legend: a swatch that mirrors the mark (box for bars, line for lines)
// and the series name in normal text colour.
export function Legend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={`legend-key legend-key-${item.shape ?? 'box'}`}
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// Hover card: values first (bold), series names after, each keyed by a
// short stroke of its colour.
export function TooltipCard({ heading, rows }) {
  return (
    <div className="chart-tooltip">
      {heading && <p className="chart-tooltip-heading">{heading}</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.label}>
            <span className="tooltip-key" style={{ background: row.color }} aria-hidden="true" />
            <strong>{row.value}</strong>
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EmptyChart({ children }) {
  return <p className="chart-empty">{children}</p>
}
