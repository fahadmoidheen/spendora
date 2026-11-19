import { useState } from 'react'
import { CATEGORIES, INCOME_CATEGORY, LIMITS } from '../constants'
import { useMoney } from '../currency'
import { todayIso } from '../utils/format'
import { validateExpense } from '../utils/validate'
import AmountInput from './AmountInput'
import DatePicker from './DatePicker'
import { ArrowDownLeftIcon, ArrowUpRightIcon, CategoryIcon, CheckIcon, CloseIcon } from './Icons'
import Segmented from './Segmented'

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense', icon: <ArrowUpRightIcon /> },
  { value: 'income', label: 'Income', icon: <ArrowDownLeftIcon /> },
]

// Type, category and date carry over to the next entry, so logging several
// from the same day or category takes fewer clicks.
function blankValues(previous = {}) {
  return {
    type: previous.type ?? 'expense',
    title: '',
    amount: '',
    category: previous.category ?? '',
    expense_date: previous.expense_date ?? todayIso(),
    description: '',
  }
}

function valuesFrom(entry) {
  const income = entry.type === 'income'
  return {
    type: entry.type,
    title: entry.title,
    amount: entry.amount,
    // Income is filed under "Income"; don't preselect that as a chip.
    category: income ? '' : entry.category,
    expense_date: entry.expense_date,
    description: entry.description ?? '',
  }
}

// Radio groups share one name, so form.elements[name] is a list there.
function focusField(form, name) {
  const field = form.elements[name]
  const target = field instanceof RadioNodeList ? field[0] : field
  target?.focus()
}

// The add / edit transaction form, shown in TransactionDialog. Field order
// follows the design: type, amount, title, category, date, notes.
//
// onSave(values) saves (and throws on failure); onDone() closes the
// dialog. When adding, "Save & add another" keeps it open with a fresh
// form instead.
export default function ExpenseForm({ editing, onSave, onDone }) {
  const money = useMoney()
  const [values, setValues] = useState(() =>
    editing ? valuesFrom(editing) : blankValues(),
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedCount, setSavedCount] = useState(0) // "Saved" note after "add another"

  const income = values.type === 'income'
  const noun = income ? 'income' : 'expense'

  // What a blank title becomes (the API adds the next free number).
  const autoName = (income ? 'Income' : values.category || 'Food').replace(/\s+/g, '').toLowerCase()

  const categoryNames = CATEGORIES.map((c) => c.name)
  if (
    values.category &&
    values.category !== INCOME_CATEGORY &&
    !categoryNames.includes(values.category)
  ) {
    categoryNames.push(values.category)
  }

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  const update = (field) => (event) => setField(field, event.target.value)

  function setType(type) {
    setValues((v) => ({ ...v, type }))
    // Title and category messages depend on the type, so drop them.
    setErrors((current) => {
      const next = { ...current }
      delete next.title
      delete next.category
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const another = event.nativeEvent.submitter?.value === 'another'
    const found = validateExpense(values, money.decimals)
    setErrors(found)

    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      focusField(form, firstInvalid)
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      await onSave(values)
      if (editing || !another) {
        onDone()
        return
      }
      setValues(blankValues(values))
      setSavedCount((n) => n + 1)
      focusField(form, 'amount')
    } catch (error) {
      // The API re-checks every field; show its messages next to them.
      const serverFields = error.fields ? Object.keys(error.fields) : []
      if (serverFields.length && serverFields.every((f) => f in values)) {
        setErrors(error.fields)
        focusField(form, serverFields[0])
      } else {
        setSaveError(`Couldn’t save. ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const errorId = (field) => (errors[field] ? `${field}-error` : undefined)

  return (
    <form className="expense-form" onSubmit={handleSubmit} noValidate aria-labelledby="expense-form-title">
      <div className="sheet-head">
        <div>
          <h2 id="expense-form-title" className="panel-title">
            {editing ? `Edit ${noun}` : `Add ${noun}`}
          </h2>
          {savedCount > 0 && (
            <p className="panel-sub expense-form-saved" role="status">
              <CheckIcon />
              {savedCount === 1 ? 'Saved. Add the next one.' : `${savedCount} saved. Add the next one.`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-icon-sm"
          aria-label="Close"
          onClick={onDone}
          disabled={saving}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="sheet-body">
      <Segmented
        name="type"
        label="Transaction type"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={setType}
        variant="strong"
      />

      <div className="field">
        <label htmlFor="amount" className="field-label">
          Amount
        </label>
        <div className={`amount-field${errors.amount ? ' is-invalid' : ''}`}>
          <span className="amount-badge" aria-hidden="true">
            {money.symbol}
          </span>
          <AmountInput
            id="amount"
            name="amount"
            className="amount-input"
            decimals={money.decimals}
            placeholder={money.decimals > 0 ? `0.${'0'.repeat(money.decimals)}` : '0'}
            value={values.amount}
            onChange={(amount) => setField('amount', amount)}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errorId('amount')}
          />
        </div>
        {errors.amount && (
          <p id="amount-error" className="field-error">
            {errors.amount}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="title" className="field-label">
          {income ? 'Source' : 'Title'} <span className="field-hint">(optional)</span>
        </label>
        <input
          id="title"
          name="title"
          className={`form-control${errors.title ? ' is-invalid' : ''}`}
          value={values.title}
          onChange={update('title')}
          maxLength={LIMITS.title}
          placeholder={income ? 'e.g. Salary' : 'e.g. Weekly groceries'}
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errorId('title') ?? 'title-hint'}
        />
        {errors.title ? (
          <p id="title-error" className="field-error">
            {errors.title}
          </p>
        ) : (
          <p id="title-hint" className="field-note">
            Leave blank to name it {autoName}1, {autoName}2…
          </p>
        )}
      </div>

      {!income && (
        <fieldset className="field" aria-describedby={errorId('category')}>
          <legend className="field-label">Category</legend>
          <div className={`chips${errors.category ? ' is-invalid' : ''}`}>
            {categoryNames.map((name) => (
              <label key={name} className="chip">
                <input
                  type="radio"
                  name="category"
                  value={name}
                  checked={values.category === name}
                  onChange={update('category')}
                />
                <CategoryIcon name={name} />
                {name}
              </label>
            ))}
          </div>
          {errors.category && (
            <p id="category-error" className="field-error">
              {errors.category}
            </p>
          )}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="expense_date" className="field-label">
          Date
        </label>
        <DatePicker
          id="expense_date"
          name="expense_date"
          value={values.expense_date}
          onChange={(iso) => setField('expense_date', iso)}
          invalid={Boolean(errors.expense_date)}
          describedBy={errorId('expense_date')}
        />
        {errors.expense_date && (
          <p id="expense_date-error" className="field-error">
            {errors.expense_date}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="description" className="field-label">
          Notes <span className="field-hint">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          className="form-control"
          rows="2"
          value={values.description}
          onChange={update('description')}
        />
      </div>

      </div>

      <div className="sheet-foot">
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        {/* The main button comes first, so Enter in a field means "Save";
            CSS (order) shows the secondary one on its left. */}
        <div className="sheet-actions">
          <button type="submit" value="close" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : `Save ${noun}`}
          </button>
          {editing ? (
            <button type="button" className="btn btn-ghost" onClick={onDone} disabled={saving}>
              Cancel
            </button>
          ) : (
            <button type="submit" value="another" className="btn btn-ghost" disabled={saving}>
              Save &amp; add another
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
