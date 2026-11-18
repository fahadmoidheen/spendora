import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createBudget, deleteBudget, listBudgets, updateBudget } from './api/budgets'
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from './api/expenses'
import BudgetsCard from './components/BudgetsCard'
import CategoryBreakdown from './components/CategoryBreakdown'
import CurrencySelect from './components/CurrencySelect'
import ExpenseFilters from './components/ExpenseFilters'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import { CloseIcon, LogoMark, PlusIcon } from './components/Icons'
import Segmented from './components/Segmented'
import SummaryCards from './components/SummaryCards'
import ThemeToggle from './components/ThemeToggle'
import UserMenu from './components/UserMenu'
import { loadCurrency, makeMoney, MoneyContext, saveCurrency } from './currency'
import { currentMonthKey, formatMonth, monthKey, toCents } from './utils/format'

const EMPTY_FILTERS = { type: 'all', search: '', category: '', month: '', sort: 'newest' }

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
]

// Ties on date fall back to id, so newer entries for the same day come first.
const SORTERS = {
  newest: (a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id,
  oldest: (a, b) => a.expense_date.localeCompare(b.expense_date) || a.id - b.id,
  highest: (a, b) => toCents(b.amount) - toCents(a.amount),
  lowest: (a, b) => toCents(a.amount) - toCents(b.amount),
}

function applyFilters(entries, { type, search, category, month, sort }) {
  const query = search.trim().toLowerCase()
  return entries
    .filter(
      (e) =>
        (type === 'all' || e.type === type) &&
        (!query ||
          e.title.toLowerCase().includes(query) ||
          (e.description ?? '').toLowerCase().includes(query)) &&
        (!category || e.category === category) &&
        (!month || monthKey(e.expense_date) === month),
    )
    .sort(SORTERS[sort])
}

// Shown when there is nothing at all yet (the design's empty card).
function FirstEntryPrompt({ onAdd }) {
  return (
    <div className="empty-card">
      <span className="empty-mark" aria-hidden="true">
        <LogoMark strokeWidth={8} dot={7} />
      </span>
      <h3 className="empty-title">No transactions yet</h3>
      <p className="empty-text">
        Add your first expense or income to see where your money flows.
      </p>
      <button type="button" className="btn btn-accent" onClick={onAdd}>
        <PlusIcon />
        Add expense
      </button>
    </div>
  )
}

export default function App() {
  const [expenses, setExpenses] = useState([])
  const [budgets, setBudgets] = useState([])
  const { user, logout, loginWithRedirect } = useAuth0()
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [currency, setCurrency] = useState(loadCurrency)
  const formRef = useRef(null)

  const money = useMemo(() => makeMoney(currency), [currency])

  useEffect(() => {
    let cancelled = false
    Promise.all([listExpenses(), listBudgets()])
      .then(([entries, limits]) => {
        if (cancelled) return
        setExpenses(entries)
        setBudgets(limits)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shown = useMemo(() => applyFilters(expenses, filters), [expenses, filters])

  const months = useMemo(() => {
    const keys = new Set(expenses.map((e) => monthKey(e.expense_date)))
    if (filters.month) keys.add(filters.month)
    return [...keys].sort().reverse()
  }, [expenses, filters.month])

  const filtersActive = Boolean(
    filters.type !== 'all' || filters.search || filters.category || filters.month,
  )
  const clearFilters = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })

  const breakdownLabel = [
    filters.month ? formatMonth(filters.month) : 'All time',
    filters.search || filters.category ? 'filtered' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  function changeCurrency(code) {
    setCurrency(code)
    saveCurrency(code)
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // "Add expense" buttons: leave edit mode, bring the form into view and
  // put the cursor in Amount. Waits a frame for the form to remount.
  function startAdding() {
    setEditing(null)
    requestAnimationFrame(() => {
      scrollToForm()
      document.getElementById('amount')?.focus({ preventScroll: true })
    })
  }

  function handleEdit(entry) {
    setEditing(entry)
    requestAnimationFrame(scrollToForm)
  }

  async function handleSave(values) {
    if (editing) {
      const updated = await updateExpense(editing.id, values)
      setExpenses((list) => list.map((e) => (e.id === updated.id ? updated : e)))
      setEditing(null)
    } else {
      const created = await createExpense(values)
      setExpenses((list) => [...list, created])
    }
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id)
      setExpenses((list) => list.filter((e) => e.id !== id))
      if (editing?.id === id) setEditing(null)
    } catch (err) {
      setError(`Could not delete the entry. ${err.message}`)
    }
  }

  // Errors are left to BudgetsCard, which shows them next to the field.
  async function handleSaveBudget(values, id) {
    if (id) {
      const updated = await updateBudget(id, values)
      setBudgets((list) => list.map((b) => (b.id === id ? updated : b)))
    } else {
      const created = await createBudget(values)
      setBudgets((list) => [...list, created])
    }
  }

  async function handleDeleteBudget(id) {
    try {
      await deleteBudget(id)
      setBudgets((list) => list.filter((b) => b.id !== id))
    } catch (err) {
      setError(`Could not delete the budget. ${err.message}`)
    }
  }

  let listContent
  if (status === 'loading') {
    listContent = (
      <div className="empty-inline">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    )
  } else if (status === 'error') {
    listContent = (
      <div className="empty-inline">
        <h3 className="empty-title">Transactions couldn’t be loaded</h3>
        <p className="empty-text">Fix the problem shown above, then refresh the page.</p>
      </div>
    )
  } else if (shown.length > 0) {
    listContent = (
      <ExpenseList
        expenses={shown}
        editingId={editing?.id}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    )
  } else if (expenses.length === 0) {
    listContent = <FirstEntryPrompt onAdd={startAdding} />
  } else {
    listContent = (
      <div className="empty-inline">
        <h3 className="empty-title">Nothing matches these filters</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <MoneyContext.Provider value={money}>
      <header className="app-header">
        <div className="app-container app-header-inner">
          <span className="brand">
            <span className="brand-mark">
              <LogoMark />
            </span>
            <span className="brand-wordmark">Spendora</span>
          </span>
          <div className="header-actions">
            <CurrencySelect value={currency} onChange={changeCurrency} />
            <ThemeToggle />
            <UserMenu
              user={user}
              onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            />
          </div>
        </div>
      </header>

      <main className="app-container app-main">
        {status === 'error' && (
          <div className="notice notice-danger" role="alert">
            <p>Could not load your data. {loadError?.message}</p>
            {loadError?.status === 401 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => loginWithRedirect()}>
                Log in again
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="notice notice-danger" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-icon-sm btn-icon-danger"
              aria-label="Dismiss"
              onClick={() => setError('')}
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="page-head">
          <div>
            <p className="page-eyebrow">{formatMonth(currentMonthKey())}</p>
            <h1 className="page-title">Your money flow</h1>
          </div>
          <button type="button" className="btn btn-accent" onClick={startAdding}>
            <PlusIcon />
            Add expense
          </button>
        </div>

        <SummaryCards expenses={expenses} budgets={budgets} />

        <div className="layout">
          <section className="panel layout-main" aria-labelledby="transactions-title">
            <div className="panel-head">
              <div className="panel-head-text">
                <h2 id="transactions-title" className="panel-title">
                  Transactions
                </h2>
                <span className="panel-sub">
                  {filtersActive
                    ? `${shown.length} of ${expenses.length}`
                    : `${expenses.length} total`}
                  {filtersActive && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </span>
              </div>
              <Segmented
                name="type-filter"
                label="Show"
                options={TYPE_FILTERS}
                value={filters.type}
                onChange={(type) => setFilters((f) => ({ ...f, type }))}
              />
            </div>
            <ExpenseFilters filters={filters} months={months} onChange={setFilters} />
            {listContent}
          </section>

          <div className="layout-side">
            <div ref={formRef} className="scroll-target">
              <ExpenseForm
                key={editing?.id ?? 'new'}
                editing={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            </div>
            <BudgetsCard
              budgets={budgets}
              expenses={expenses}
              onSave={handleSaveBudget}
              onDelete={handleDeleteBudget}
            />
            <CategoryBreakdown expenses={shown} label={breakdownLabel} />
          </div>
        </div>
      </main>
    </MoneyContext.Provider>
  )
}
