import { PAGE_SIZES, pageNumbers } from '../utils/pagination'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import Select from './Select'

const SIZE_OPTIONS = PAGE_SIZES.map((n) => ({ value: n, label: `${n} per page` }))

// Under the transactions list: "26–50 of 132", page buttons and a
// rows-per-page choice. Phones show "Page 2 of 6" between the arrows
// instead of the numbers.
export default function Pagination({ page, pageCount, pageSize, total, onPage, onPageSize }) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav className="pager" aria-label="Transaction pages">
      <p className="pager-range">
        {from}–{to} of {total}
      </p>

      {pageCount > 1 && (
        <div className="pager-pages">
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-icon-sm"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeftIcon />
          </button>
          {pageNumbers(page, pageCount).map((p) =>
            typeof p === 'number' ? (
              <button
                key={p}
                type="button"
                className={`pager-page${p === page ? ' is-current' : ''}`}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            ) : (
              <span key={p} className="pager-gap" aria-hidden="true">
                …
              </span>
            ),
          )}
          <span className="pager-status" aria-hidden="true">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-icon-sm"
            aria-label="Next page"
            disabled={page === pageCount}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      <Select
        label="Rows per page"
        options={SIZE_OPTIONS}
        value={pageSize}
        onChange={onPageSize}
        variant="compact"
        className="pager-size"
      />
    </nav>
  )
}
