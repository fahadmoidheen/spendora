import { CategoryIcon } from './Icons'

// Category icon on a rounded tile, as in the design's transaction rows.
// Income rows get the lime tile.
export default function CategoryTile({ name, size = 'md', income = false }) {
  return (
    <span
      className={`cat-tile cat-tile-${size}${income ? ' is-income' : ''}`}
      aria-hidden="true"
    >
      <CategoryIcon name={name} />
    </span>
  )
}
