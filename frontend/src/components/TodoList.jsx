import { useState } from 'react'
import { useMoney } from '../currency'
import { toCents, todayIso } from '../utils/format'
import { dueLabel, REPEAT_LABELS } from '../utils/todos'
import { CheckIcon, CloseIcon, EditIcon, RepeatIcon, TrashIcon } from './Icons'

// To-do rows: a round checkbox, the title, "when · repeat · category",
// the amount (payments only), then edit / delete.
//
// Ticking a payment asks first whether to save it as an expense, inside
// the row. Unticking a done to-do reopens it. `compact` (the Today card)
// leaves out delete.
export default function TodoList({ todos, onComplete, onReopen, onEdit, onDelete, compact = false }) {
  const money = useMoney()
  const today = todayIso()
  const [askingId, setAskingId] = useState(null) // "save as an expense?"
  const [confirmingId, setConfirmingId] = useState(null) // "delete?"
  const [busyId, setBusyId] = useState(null)

  async function run(id, action) {
    setBusyId(id)
    try {
      await action()
    } finally {
      setBusyId(null)
      setAskingId(null)
      setConfirmingId(null)
    }
  }

  function toggle(todo) {
    if (todo.done) return run(todo.id, () => onReopen(todo))
    if (todo.amount) return setAskingId(askingId === todo.id ? null : todo.id)
    return run(todo.id, () => onComplete(todo, false))
  }

  return (
    <ul className="todo-list">
      {todos.map((t) => {
        const due = t.done ? null : dueLabel(t, today)
        const busy = busyId === t.id
        const meta = [
          due && <span key="due" className={due.overdue ? 'is-overdue' : undefined}>{due.text}</span>,
          t.repeat !== 'none' && (
            <span key="repeat" className="todo-repeat">
              <RepeatIcon />
              {REPEAT_LABELS[t.repeat]}
            </span>
          ),
          t.amount && t.category && <span key="category">{t.category}</span>,
        ].filter(Boolean)

        return (
          <li key={t.id} className={`todo-row${t.done ? ' is-done' : ''}`}>
            <label className="todo-check">
              <input
                type="checkbox"
                checked={t.done || askingId === t.id}
                onChange={() => toggle(t)}
                disabled={busy}
                aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
              />
              <span className="todo-check-box" aria-hidden="true">
                <CheckIcon />
              </span>
            </label>

            <div className="todo-main">
              <p className="todo-title">{t.title}</p>
              {meta.length > 0 && <p className="todo-meta">{meta}</p>}
            </div>

            {t.amount && <p className="todo-amount">{money.format(toCents(t.amount))}</p>}

            <div className="tx-actions">
              {confirmingId === t.id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => run(t.id, () => onDelete(t.id))}
                    disabled={busy}
                  >
                    Delete
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-icon-sm"
                    onClick={() => onEdit(t)}
                    aria-label={`Edit ${t.title}`}
                    title="Edit"
                  >
                    <EditIcon />
                  </button>
                  {!compact && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-icon-sm btn-icon-danger"
                      onClick={() => setConfirmingId(t.id)}
                      aria-label={`Delete ${t.title}`}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </>
              )}
            </div>

            {askingId === t.id && (
              <div className="todo-ask" role="group" aria-label={`Finish ${t.title}`}>
                <p>
                  Save {money.format(toCents(t.amount))} as an expense
                  {t.category ? ` in ${t.category}` : ''}?
                </p>
                <div className="todo-ask-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => run(t.id, () => onComplete(t, true))}
                    disabled={busy}
                  >
                    Save expense
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => run(t.id, () => onComplete(t, false))}
                    disabled={busy}
                  >
                    Just mark done
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-icon-sm"
                    aria-label="Cancel"
                    onClick={() => setAskingId(null)}
                    disabled={busy}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
