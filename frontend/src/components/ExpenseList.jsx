import { useState } from 'react'
import { INCOME_CATEGORY } from '../constants'
import { useMoney } from '../currency'
import { formatDate, sumCents, toCents } from '../utils/format'
import { isIncome, onlyExpenses, onlyIncome } from '../utils/transactions'
import CategoryTile from './CategoryTile'
import { EditIcon, TrashIcon } from './Icons'

// Footer: a net figure when the list mixes money in and out, otherwise
// the plain total.
function ListTotal({ entries }) {
  const money = useMoney()
  const inCents = sumCents(onlyIncome(entries))
  const outCents = sumCents(onlyExpenses(entries))

  let label = 'Total spent'
  let value = money.format(outCents)
  if (inCents && outCents) {
    label = 'Net'
    value = money.formatNet(inCents - outCents)
  } else if (inCents) {
    label = 'Total received'
    value = money.formatSigned(inCents, 1)
  }

  return (
    <div className="tx-total">
      <span className="tx-total-label">{label}</span>
      <span className="tx-total-amount">{value}</span>
    </div>
  )
}

// Transaction rows from the design: category tile, title, "Category ·
// date · notes", signed amount, then edit / delete. `expenses` is the page
// being shown; the total covers `totalEntries` (every entry that matches
// the filters, on all pages).
export default function ExpenseList({ expenses, totalEntries = expenses, editingId, onEdit, onDelete }) {
  const money = useMoney()
  // Delete asks for a second click inside the row instead of a browser
  // confirm() popup.
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function confirmDelete(id) {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <>
      <ul className="tx-list">
        {expenses.map((e) => {
          const income = isIncome(e)
          return (
            <li
              key={e.id}
              className={`tx-row${e.id === editingId ? ' is-editing' : ''}`}
            >
              <CategoryTile name={income ? INCOME_CATEGORY : e.category} income={income} />

              <div className="tx-main">
                <p className="tx-name">{e.title}</p>
                <p className="tx-meta">
                  {[e.category, formatDate(e.expense_date), e.description]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <p className={`tx-amount${income ? ' is-income' : ''}`}>
                {money.formatSigned(toCents(e.amount), income ? 1 : -1)}
              </p>

              <div className="tx-actions">
                {confirmingId === e.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => confirmDelete(e.id)}
                      disabled={deletingId === e.id}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-icon-sm"
                      onClick={() => onEdit(e)}
                      aria-label={`Edit ${e.title}`}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-icon-sm btn-icon-danger"
                      onClick={() => setConfirmingId(e.id)}
                      aria-label={`Delete ${e.title}`}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ListTotal entries={totalEntries} />
    </>
  )
}
