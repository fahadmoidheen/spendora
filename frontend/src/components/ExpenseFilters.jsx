import { CATEGORIES, SORT_OPTIONS } from '../constants'
import { formatMonth } from '../utils/format'
import { CategoryIcon, FilterIcon, SearchIcon } from './Icons'
import Select from './Select'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories', icon: <FilterIcon /> },
  ...CATEGORIES.map((c) => ({ value: c.name, label: c.name, icon: <CategoryIcon name={c.name} /> })),
]

export default function ExpenseFilters({ filters, months, onChange }) {
  const set = (field) => (value) => onChange({ ...filters, [field]: value })

  const monthOptions = [
    { value: '', label: 'All time' },
    ...months.map((key) => ({ value: key, label: formatMonth(key) })),
  ]

  return (
    <div className="filters">
      <label className="search-pill">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search transactions"
          aria-label="Search transactions"
          value={filters.search}
          onChange={(event) => set('search')(event.target.value)}
        />
      </label>

      <Select
        label="Filter by category"
        options={CATEGORY_OPTIONS}
        value={filters.category}
        onChange={set('category')}
        variant="filter"
      />

      <Select
        label="Filter by month"
        options={monthOptions}
        value={filters.month}
        onChange={set('month')}
        variant="filter"
      />

      <Select
        label="Sort transactions"
        options={SORT_OPTIONS}
        value={filters.sort}
        onChange={set('sort')}
        variant="filter"
        className="filter-sort"
      />
    </div>
  )
}
