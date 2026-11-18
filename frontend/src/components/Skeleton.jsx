// Grey placeholder shapes shown while entries and budgets load, in the
// same layout as the real content so nothing jumps when it arrives. They're
// hidden from screen readers; the transactions list announces "Loading"
// once instead.

// Varied widths so the rows don't look stamped out.
const WIDTHS = ['62%', '48%', '70%', '55%', '40%', '66%', '52%', '58%']

export function Skeleton({ className = '', width }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={width ? { width } : undefined}
      aria-hidden="true"
    />
  )
}

export function TransactionsSkeleton({ rows = 6 }) {
  return (
    <div aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading transactions…
      </p>
      <ul className="tx-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="tx-row tx-row-skeleton">
            <Skeleton className="skeleton-tile" />
            <div className="tx-main skeleton-stack">
              <Skeleton className="skeleton-line" width={WIDTHS[i % WIDTHS.length]} />
              <Skeleton className="skeleton-line skeleton-small" width="34%" />
            </div>
            <Skeleton className="skeleton-amount" />
          </li>
        ))}
      </ul>
    </div>
  )
}

// Budgets card and By category: tile, two lines, a percentage and a bar.
export function BreakdownSkeleton({ rows = 3 }) {
  return (
    <ul className="breakdown" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <div className="breakdown-top">
            <Skeleton className="skeleton-tile skeleton-tile-sm" />
            <div className="breakdown-text skeleton-stack">
              <Skeleton className="skeleton-line" width={WIDTHS[(i + 2) % WIDTHS.length]} />
              <Skeleton className="skeleton-line skeleton-small" width="40%" />
            </div>
            <Skeleton className="skeleton-pct" />
          </div>
          <Skeleton className="skeleton-bar" />
        </li>
      ))}
    </ul>
  )
}
