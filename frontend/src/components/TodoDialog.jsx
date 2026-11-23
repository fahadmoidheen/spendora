import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, LIMITS } from '../constants'
import { useMoney } from '../currency'
import { todayIso } from '../utils/format'
import { addDays, REPEAT_OPTIONS, todoValues } from '../utils/todos'
import { amountError } from '../utils/validate'
import AmountInput from './AmountInput'
import DatePicker from './DatePicker'
import { CategoryIcon, CloseIcon } from './Icons'
import Segmented from './Segmented'

function blankValues() {
  return { title: '', due_date: todayIso(), amount: '', category: '', repeat: 'none', done: false }
}

function validate(values, decimals) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Say what needs doing.'
  else if (title.length > LIMITS.title) errors.title = `Keep it under ${LIMITS.title} characters.`
  if (values.amount) {
    const amount = amountError(values.amount, decimals)
    if (amount) errors.amount = amount
  }
  if (values.repeat !== 'none' && !values.due_date) errors.due_date = 'Pick a date to repeat from.'
  return errors
}

// Add / edit a to-do, as a modal like the transaction dialog. A to-do
// with an amount is a payment: ticking it off can save it as an expense.
//
// onSave(values) saves (and throws on failure); onClose() closes.
export default function TodoDialog({ editing, onSave, onClose }) {
  const money = useMoney()
  const dialogRef = useRef(null)
  const [values, setValues] = useState(() => (editing ? todoValues(editing) : blankValues()))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    dialog.querySelector('#todo-title')?.focus()
    return () => dialog.close()
  }, [])

  const today = todayIso()
  const tomorrow = addDays(today, 1)
  const quickDates = [
    { value: today, label: 'Today' },
    { value: tomorrow, label: 'Tomorrow' },
    { value: '', label: 'No date' },
  ]

  const categoryNames = CATEGORIES.map((c) => c.name)
  if (values.category && !categoryNames.includes(values.category)) categoryNames.push(values.category)

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

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validate(values, money.decimals)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      dialogRef.current.querySelector(`#todo-${first.replace('_', '-')}`)?.focus()
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await onSave(values)
      onClose()
    } catch (error) {
      setSaveError(`Couldn’t save. ${error.message}`)
      setSaving(false)
    }
  }

  const errorId = (field) => (errors[field] ? `todo-${field}-error` : undefined)

  return (
    <dialog
      ref={dialogRef}
      className="sheet transaction-dialog"
      aria-labelledby="todo-form-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onClose()
      }}
    >
      <form className="expense-form" onSubmit={handleSubmit} noValidate>
        <div className="sheet-head">
          <h2 id="todo-form-title" className="panel-title">
            {editing ? 'Edit to-do' : 'Add to-do'}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-icon-sm"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="sheet-body">
          <div className="field">
            <label htmlFor="todo-title" className="field-label">
              To-do
            </label>
            <input
              id="todo-title"
              className={`form-control${errors.title ? ' is-invalid' : ''}`}
              value={values.title}
              onChange={(e) => setField('title', e.target.value)}
              maxLength={LIMITS.title}
              placeholder="e.g. Pay rent, call the bank"
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errorId('title')}
            />
            {errors.title && (
              <p id="todo-title-error" className="field-error">
                {errors.title}
              </p>
            )}
          </div>

          <fieldset className="field" aria-describedby={errorId('due_date')}>
            <legend className="field-label">When</legend>
            <div className="chips">
              {quickDates.map((option) => (
                <label key={option.label} className="chip">
                  <input
                    type="radio"
                    name="todo-when"
                    checked={values.due_date === option.value}
                    onChange={() => setField('due_date', option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <DatePicker
              id="todo-due-date"
              name="due_date"
              value={values.due_date}
              onChange={(iso) => setField('due_date', iso)}
              invalid={Boolean(errors.due_date)}
              describedBy={errorId('due_date')}
            />
            {errors.due_date && (
              <p id="todo-due_date-error" className="field-error">
                {errors.due_date}
              </p>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor="todo-amount" className="field-label">
              Amount <span className="field-hint">(optional)</span>
            </label>
            <div className={`amount-field${errors.amount ? ' is-invalid' : ''}`}>
              <span className="amount-badge" aria-hidden="true">
                {money.symbol}
              </span>
              <AmountInput
                id="todo-amount"
                className="amount-input"
                decimals={money.decimals}
                placeholder={money.decimals > 0 ? `0.${'0'.repeat(money.decimals)}` : '0'}
                value={values.amount}
                onChange={(amount) => setField('amount', amount)}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errorId('amount') ?? 'todo-amount-hint'}
              />
            </div>
            {errors.amount ? (
              <p id="todo-amount-error" className="field-error">
                {errors.amount}
              </p>
            ) : (
              <p id="todo-amount-hint" className="field-note">
                For a bill or payment. When you tick it off, you can save it as an expense.
              </p>
            )}
          </div>

          {values.amount && (
            <fieldset className="field">
              <legend className="field-label">
                Category <span className="field-hint">(blank = Other)</span>
              </legend>
              <div className="chips">
                {categoryNames.map((name) => (
                  <label key={name} className="chip">
                    <input
                      type="radio"
                      name="todo-category"
                      value={name}
                      checked={values.category === name}
                      onChange={() => setField('category', name)}
                    />
                    <CategoryIcon name={name} />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="field">
            <span className="field-label" id="todo-repeat-label">
              Repeat
            </span>
            <Segmented
              name="todo-repeat"
              label="Repeat"
              options={REPEAT_OPTIONS}
              value={values.repeat}
              onChange={(repeat) => setField('repeat', repeat)}
            />
            {values.repeat !== 'none' && (
              <p className="field-note">Ticking it off moves it to the next date.</p>
            )}
          </div>
        </div>

        <div className="sheet-foot">
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="sheet-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to-do'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
