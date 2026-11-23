import { useState } from 'react'
import { todayIso } from '../utils/format'
import { groupTodos } from '../utils/todos'
import { PlusIcon } from './Icons'
import TodoList from './TodoList'

const SECTIONS = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Today' },
  { key: 'upcoming', title: 'Coming up' },
  { key: 'someday', title: 'No date' },
]

// The To-dos tab: a quick "add for today" box, then the open to-dos by
// when they're due, and the recently done ones behind a toggle.
export default function TodosView({ todos, status, onQuickAdd, onAdd, ...listProps }) {
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [showDone, setShowDone] = useState(false)

  const groups = groupTodos(todos, todayIso())
  const openCount = todos.length - groups.done.length

  async function handleQuickAdd(event) {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    setAdding(true)
    setAddError('')
    try {
      await onQuickAdd(text)
      setTitle('')
    } catch (error) {
      setAddError(`Couldn’t add it. ${error.message}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="todos-title">
      <div className="panel-head">
        <div className="panel-head-text">
          <h2 id="todos-title" className="panel-title">
            To-dos
          </h2>
          {status === 'ready' && (
            <span className="panel-sub">{openCount ? `${openCount} open` : 'All clear'}</span>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd} disabled={status !== 'ready'}>
          <PlusIcon />
          Add with details
        </button>
      </div>

      <form className="todo-quick" onSubmit={handleQuickAdd}>
        <label htmlFor="todo-quick" className="visually-hidden">
          New to-do for today
        </label>
        <input
          id="todo-quick"
          className="form-control"
          placeholder="Add a to-do for today…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoComplete="off"
          disabled={status !== 'ready'}
        />
        <button type="submit" className="btn btn-primary" disabled={adding || !title.trim()}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
      {addError && (
        <p className="form-error" role="alert">
          {addError}
        </p>
      )}

      {status === 'loading' && <p className="stat-note">Loading to-dos…</p>}
      {status === 'error' && <p className="stat-note">To-dos couldn’t be loaded.</p>}

      {status === 'ready' && openCount === 0 && (
        <div className="empty-inline">
          <h3 className="empty-title">Nothing to do</h3>
          <p className="empty-text">
            Add tasks and bills here. Ones with an amount can be saved as an expense when you tick them off.
          </p>
        </div>
      )}

      {status === 'ready' &&
        SECTIONS.filter((s) => groups[s.key].length > 0).map((s) => (
          <div key={s.key} className={`todo-section is-${s.key}`}>
            <h3 className="todo-section-title">
              {s.title} <span>{groups[s.key].length}</span>
            </h3>
            <TodoList todos={groups[s.key]} {...listProps} />
          </div>
        ))}

      {status === 'ready' && groups.done.length > 0 && (
        <div className="todo-section is-done">
          <button
            type="button"
            className="btn btn-ghost btn-sm todo-done-toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone ? 'Hide done' : `Show done (${groups.done.length})`}
          </button>
          {showDone && <TodoList todos={groups.done} {...listProps} />}
        </div>
      )}
    </section>
  )
}
