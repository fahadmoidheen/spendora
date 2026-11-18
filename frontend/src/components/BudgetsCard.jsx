import { useState } from 'react'
import { CATEGORIES } from '../constants'
import { sanitizeAmount, useMoney } from '../currency'
import { levelOf } from '../utils/budgetAlerts'
import { currentMonthKey, formatMonth } from '../utils/format'
import { spentByCategory } from '../utils/transactions'
import { amountError } from '../utils/validate'
import CategoryTile from './CategoryTile'
import { CategoryIcon, EditIcon, PlusIcon, TrashIcon } from './Icons'
import Select from './Select'

const toCents = (amount) => Math.round(Number(amount) * 100)

// Add or change one budget. New budgets pick a category; existing ones
// only change their limit.
function BudgetForm({ budget, categories, onSave, onCancel }) {
  const money = useMoney()
  const [category, setCategory] = useState(budget?.category ?? categories[0] ?? '')
  const [limit, setLimit] = useState(budget?.monthly_limit ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputId = `budget-limit-${budget?.id ?? 'new'}`

  async function handleSubmit(event) {
    event.preventDefault()
    const problem = amountError(limit, money.decimals, 'Monthly limit')
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ category, monthly_limit: limit }, budget?.id)
    } catch (err) {
      setError(err.fields?.monthly_limit ?? err.fields?.category ?? err.message)
      setSaving(false)
    }
  }

  return (
    <form className="budget-form" onSubmit={handleSubmit} noValidate>
      {budget ? (
        <p className="budget-form-title">{budget.category}</p>
      ) : (
        <Select
          label="Budget category"
          options={categories.map((name) => ({
            value: name,
            label: name,
            icon: <CategoryIcon name={name} />,
          }))}
          value={category}
          onChange={setCategory}
        />
      )}

      <label htmlFor={inputId} className="visually-hidden">
        Monthly limit
      </label>
      <div className={`amount-field amount-field-sm${error ? ' is-invalid' : ''}`}>
        <span className="amount-badge" aria-hidden="true">
          {money.symbol}
        </span>
        <input
          id={inputId}
          type="text"
          inputMode={money.decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          className="amount-input"
          placeholder="Monthly limit"
          value={limit}
          onChange={(event) => {
            setLimit(sanitizeAmount(event.target.value, money.decimals))
            setError('')
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoFocus
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      )}

      <div className="budget-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save budget'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// The design's Budgets card: this month's spending against each limit.
// Bars turn amber at 80% and red at 100%, matching the Heads-up panel.
export default function BudgetsCard({ budgets, expenses, onSave, onDelete }) {
  const money = useMoney()
  // null, "new", or the id of the budget being edited
  const [editing, setEditing] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)

  const thisKey = currentMonthKey()
  const spentBy = spentByCategory(expenses, thisKey)
  const taken = new Set(budgets.map((b) => b.category))
  const available = CATEGORIES.map((c) => c.name).filter((name) => !taken.has(name))

  const rows = budgets
    .map((b) => {
      const limit = toCents(b.monthly_limit)
      const used = spentBy[b.category] ?? 0
      return {
        ...b,
        limit,
        used,
        pct: Math.round((used / limit) * 100),
        level: levelOf(used / limit),
      }
    })
    .sort((a, b) => b.pct - a.pct) // closest to the limit first

  async function save(values, id) {
    await onSave(values, id)
    setEditing(null)
  }

  return (
    <section className="panel" aria-labelledby="budgets-title">
      <div className="panel-head">
        <h2 id="budgets-title" className="panel-title">
          Budgets
        </h2>
        {editing === null && available.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing('new')}>
            <PlusIcon />
            Add budget
          </button>
        ) : (
          <span className="panel-sub">{formatMonth(thisKey)}</span>
        )}
      </div>

      {editing === 'new' && (
        <BudgetForm categories={available} onSave={save} onCancel={() => setEditing(null)} />
      )}

      {rows.length === 0 && editing !== 'new' && (
        <p className="stat-note">Set a monthly limit for a category to track it here.</p>
      )}

      {rows.length > 0 && (
        <ul className="breakdown">
          {rows.map((b) => {
            if (editing === b.id) {
              return (
                <li key={b.id}>
                  <BudgetForm budget={b} onSave={save} onCancel={() => setEditing(null)} />
                </li>
              )
            }
            const tone = { over: ' is-danger', warning: ' is-warning' }[b.level] ?? ''
            return (
              <li key={b.id}>
                <div className="breakdown-top">
                  <CategoryTile name={b.category} size="sm" />
                  <div className="breakdown-text">
                    <p className="breakdown-name">{b.category}</p>
                    <p className="breakdown-detail">
                      {money.format(b.used)} of {money.format(b.limit)}
                      {b.used > b.limit && ` · ${money.format(b.used - b.limit)} over`}
                    </p>
                  </div>
                  <p className={`breakdown-pct${tone}`}>{b.pct}%</p>
                  <div className="row-actions">
                    {confirmingId === b.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            await onDelete(b.id)
                            setConfirmingId(null)
                          }}
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
                          aria-label={`Edit ${b.category} budget`}
                          title="Edit"
                          onClick={() => setEditing(b.id)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-icon-sm btn-icon-danger"
                          aria-label={`Delete ${b.category} budget`}
                          title="Delete"
                          onClick={() => setConfirmingId(b.id)}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="bar"
                  role="progressbar"
                  aria-label={`${b.category} budget used`}
                  aria-valuenow={Math.min(b.pct, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`bar-fill${tone}`}
                    style={{ width: `${Math.min(b.pct, 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
