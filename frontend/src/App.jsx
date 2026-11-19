import { useAuth0 } from '@auth0/auth0-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBudget, deleteBudget, listBudgets, updateBudget } from './api/budgets'
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from './api/expenses'
import BudgetsCard from './components/BudgetsCard'
import BudgetToast from './components/BudgetToast'
import CategoryBreakdown from './components/CategoryBreakdown'
import CurrencySelect from './components/CurrencySelect'
import ExpenseFilters from './components/ExpenseFilters'
import ExpenseList from './components/ExpenseList'
import HeadsUp from './components/HeadsUp'
import {
  ChartIcon,
  CloseIcon,
  DownloadIcon,
  FileTextIcon,
  GridIcon,
  ListIcon,
  LogoMark,
  PlusIcon,
  RefreshIcon,
  UploadIcon,
} from './components/Icons'
import ImportDialog from './components/ImportDialog'
import Pagination from './components/Pagination'
import ReportDialog from './components/ReportDialog'
import Segmented from './components/Segmented'
import Select from './components/Select'
import { TransactionsSkeleton } from './components/Skeleton'
import SummaryCards from './components/SummaryCards'
import ThemeToggle from './components/ThemeToggle'
import Toast from './components/Toast'
import TransactionDialog from './components/TransactionDialog'
import UserMenu from './components/UserMenu'
import ViewTabs from './components/ViewTabs'
import { loadCurrency, makeMoney, MoneyContext, saveCurrency } from './currency'
import { useOnlineStatus } from './useOnlineStatus'
import { newlyCrossed } from './utils/budgetAlerts'
import { downloadCsv, entriesToCsv } from './utils/csv'
import { currentMonthKey, formatMonth, monthKey, toCents } from './utils/format'
import { loadPageSize, PAGE_SIZES, savePageSize } from './utils/pagination'

const EMPTY_FILTERS = { type: 'all', search: '', category: '', month: '', sort: 'newest' }

const SLOW_AFTER_MS = 4000 // then explain the wait
const STALE_AFTER_MS = 2 * 60 * 1000 // refresh on return after this long

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
]

// The app's sections. The tab is kept in the address (#analysis), so a
// reload - or reopening the installed app - lands on the same one.
const TABS = [
  { value: 'transactions', label: 'Transactions', icon: <ListIcon /> },
  { value: 'analysis', label: 'Analysis', icon: <ChartIcon /> },
  { value: 'categories', label: 'Categories', icon: <GridIcon /> },
]

function tabFromAddress() {
  const name = window.location.hash.slice(1)
  return TABS.some((t) => t.value === name) ? name : 'transactions'
}

// The charts library is big, so Analysis loads only when first opened.
const InsightsView = lazy(() => import('./components/insights/InsightsView'))

function Spinner() {
  return (
    <div className="empty-inline">
      <div className="spinner-border" role="status">
        <span className="visually-hidden">Loading…</span>
      </div>
    </div>
  )
}

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
function FirstEntryPrompt({ onAdd, onImport }) {
  return (
    <div className="empty-card">
      <span className="empty-mark" aria-hidden="true">
        <LogoMark strokeWidth={8} dot={7} />
      </span>
      <h3 className="empty-title">No transactions yet</h3>
      <p className="empty-text">
        Add your first expense or income to see where your money flows.
      </p>
      <div className="empty-actions">
        <button type="button" className="btn btn-accent" onClick={onAdd}>
          <PlusIcon />
          Add expense
        </button>
        <button type="button" className="btn btn-ghost" onClick={onImport}>
          <UploadIcon />
          Import a CSV
        </button>
      </div>
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
  const online = useOnlineStatus()
  const [editing, setEditing] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [view, setView] = useState(tabFromAddress) // transactions | analysis | categories
  const [formOpen, setFormOpen] = useState(false) // add / edit transaction dialog
  const [savedToast, setSavedToast] = useState('')
  const [categoryMonth, setCategoryMonth] = useState(currentMonthKey)
  const [currency, setCurrency] = useState(loadCurrency)
  const [budgetToast, setBudgetToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [notice, setNotice] = useState('')

  const money = useMemo(() => makeMoney(currency), [currency])
  const closeBudgetToast = useCallback(() => setBudgetToast(null), [])

  // Loading entries and budgets. The first load (and "Try again") shows
  // placeholders; a refresh keeps what's on screen and swaps in the new
  // data. If it takes a while (the free server waking up), say so - in
  // plain words, without server talk.
  const [refreshing, setRefreshing] = useState(false)
  const [slow, setSlow] = useState(false)
  const loadingRef = useRef(false)
  const loadedAtRef = useRef(0)

  // The fetch itself. Every state change happens after it's under way, so
  // the first load can start straight from an effect.
  const runLoad = useCallback(async (quiet) => {
    loadingRef.current = true
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    try {
      const [entries, limits] = await Promise.all([listExpenses(), listBudgets()])
      setExpenses(entries)
      setBudgets(limits)
      setStatus('ready')
      setLoadError(null)
      loadedAtRef.current = Date.now()
    } catch (err) {
      if (quiet) {
        setError(`Couldn’t refresh. ${err.message}`)
      } else {
        setLoadError(err)
        setStatus('error')
      }
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
      setRefreshing(false)
      loadingRef.current = false
    }
  }, [])

  // From the refresh and "Try again" buttons, and on return to the app.
  const loadData = useCallback(
    ({ quiet = false } = {}) => {
      if (loadingRef.current) return
      if (quiet) {
        setRefreshing(true)
      } else {
        setStatus('loading')
        setLoadError(null)
      }
      runLoad(quiet)
    },
    [runLoad],
  )

  // First load - status starts as "loading", so placeholders are already up.
  useEffect(() => {
    if (!loadingRef.current) runLoad(false)
  }, [runLoad])

  // An installed app has no reload button and often stays open for days:
  // refresh by itself when it comes back to the screen after a while, or
  // when the connection returns.
  useEffect(() => {
    if (status !== 'ready') return undefined
    function refreshIfStale() {
      const stale = Date.now() - loadedAtRef.current > STALE_AFTER_MS
      if (document.visibilityState === 'visible' && stale) loadData({ quiet: true })
    }
    function refreshNow() {
      loadData({ quiet: true })
    }
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('online', refreshNow)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('online', refreshNow)
    }
  }, [loadData, status])

  const shown = useMemo(() => applyFilters(expenses, filters), [expenses, filters])

  // Pages of the (filtered) list. Changing a filter or the page size goes
  // back to page 1; deleting the last row of the last page steps back one.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(loadPageSize)
  const transactionsRef = useRef(null)
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageItems = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function updateFilters(next) {
    setFilters(next)
    setPage(1)
  }

  function goToPage(next) {
    setPage(next)
    // If the list's top has scrolled out of view, bring it back.
    const panel = transactionsRef.current
    if (panel && panel.getBoundingClientRect().top < 0) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function changePageSize(size) {
    setPageSize(size)
    savePageSize(size)
    setPage(1)
  }

  const months = useMemo(() => {
    const keys = new Set(expenses.map((e) => monthKey(e.expense_date)))
    if (filters.month) keys.add(filters.month)
    return [...keys].sort().reverse()
  }, [expenses, filters.month])

  const filtersActive = Boolean(
    filters.type !== 'all' || filters.search || filters.category || filters.month,
  )
  const clearFilters = () => updateFilters({ ...EMPTY_FILTERS, sort: filters.sort })

  // Categories tab: one month (this one by default) or all time.
  const categoryMonths = useMemo(() => {
    const keys = [...new Set([currentMonthKey(), ...months])].sort().reverse()
    // "November 2026" in the list, "Nov 2026" on the (narrow) button.
    const short = (key) =>
      new Date(`${key}-01T00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    return [
      ...keys.map((key) => ({ value: key, label: formatMonth(key), short: short(key) })),
      { value: 'all', label: 'All time' },
    ]
  }, [months])
  const categoryEntries = useMemo(
    () =>
      categoryMonth === 'all'
        ? expenses
        : expenses.filter((e) => monthKey(e.expense_date) === categoryMonth),
    [expenses, categoryMonth],
  )

  function changeCurrency(code) {
    setCurrency(code)
    saveCurrency(code)
  }

  function changeView(next) {
    setView(next)
    const { pathname, search } = window.location
    window.history.replaceState(null, '', next === 'transactions' ? pathname + search : `#${next}`)
    window.scrollTo({ top: 0 })
  }

  // "Add transaction" buttons open the dialog; editing a row opens it with
  // that entry.
  function startAdding() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleEdit(entry) {
    setEditing(entry)
    setFormOpen(true)
  }

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setEditing(null)
  }, [])

  const closeSavedToast = useCallback(() => setSavedToast(''), [])

  // After saving, say so - or, if the entry pushed a budget past 80% or
  // 100%, show that instead.
  async function handleSave(values) {
    let next
    if (editing) {
      const updated = await updateExpense(editing.id, values)
      next = expenses.map((e) => (e.id === updated.id ? updated : e))
    } else {
      const created = await createExpense(values)
      next = [...expenses, created]
      setPage(1) // a new entry is at the top of the list
    }
    setExpenses(next)
    const crossed = newlyCrossed(budgets, expenses, next)
    if (crossed) {
      setBudgetToast(crossed)
    } else {
      setSavedToast(editing ? 'Changes saved' : values.type === 'income' ? 'Income saved' : 'Expense saved')
    }
  }

  function handleImported(created) {
    const next = [...expenses, ...created]
    setExpenses(next)
    setImporting(false)
    setNotice(`Imported ${created.length} ${created.length === 1 ? 'entry' : 'entries'}.`)
    const crossed = newlyCrossed(budgets, expenses, next)
    if (crossed) setBudgetToast(crossed)
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id)
      setExpenses((list) => list.filter((e) => e.id !== id))
    } catch (err) {
      setError(`Couldn’t delete the entry. ${err.message}`)
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
      setError(`Couldn’t delete the budget. ${err.message}`)
    }
  }

  let listContent
  if (status === 'loading') {
    listContent = <TransactionsSkeleton />
  } else if (status === 'error') {
    listContent = (
      <div className="empty-inline">
        <h3 className="empty-title">Transactions couldn’t be loaded</h3>
        <p className="empty-text">Use “Try again” above once the problem is fixed.</p>
      </div>
    )
  } else if (shown.length > 0) {
    listContent = (
      <>
        <ExpenseList
          expenses={pageItems}
          totalEntries={shown}
          editingId={editing?.id}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        {shown.length > PAGE_SIZES[0] && (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={shown.length}
            onPage={goToPage}
            onPageSize={changePageSize}
          />
        )}
      </>
    )
  } else if (expenses.length === 0) {
    listContent = <FirstEntryPrompt onAdd={startAdding} onImport={() => setImporting(true)} />
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
            <button
              type="button"
              className={`btn btn-icon header-icon-btn${refreshing ? ' is-spinning' : ''}`}
              aria-label={refreshing ? 'Refreshing…' : 'Refresh'}
              title="Refresh"
              onClick={() => loadData({ quiet: status === 'ready' })}
              disabled={refreshing || status === 'loading'}
            >
              <RefreshIcon />
            </button>
            <ThemeToggle />
            <UserMenu
              user={user}
              onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            />
          </div>
        </div>
      </header>

      <main className="app-container app-main">
        {!online && (
          <div className="notice notice-info" role="status">
            <p>You’re offline — changes can’t be saved until you reconnect.</p>
          </div>
        )}
        {slow && (
          <div className="notice notice-info" role="status">
            <p>Taking a little longer than usual… This can take up to a minute.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="notice notice-danger" role="alert">
            <p>Couldn’t load your data. {loadError?.message}</p>
            {loadError?.status === 401 ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => loginWithRedirect()}>
                Log in again
              </button>
            ) : (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => loadData()}>
                Try again
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="notice notice-info" role="status">
            <p>{notice}</p>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-icon-sm"
              aria-label="Dismiss"
              onClick={() => setNotice('')}
            >
              <CloseIcon />
            </button>
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
          <div className="page-actions">
            <ViewTabs tabs={TABS} value={view} onChange={changeView} className="page-tabs" />
            <button type="button" className="btn btn-accent page-add" onClick={startAdding}>
              <PlusIcon />
              Add transaction
            </button>
          </div>
        </div>

        {view === 'analysis' && (
          status === 'ready' ? (
            <Suspense fallback={<Spinner />}>
              <InsightsView expenses={expenses} />
            </Suspense>
          ) : status === 'loading' ? (
            <Spinner />
          ) : null
        )}

        {view === 'categories' && (
          <div className="categories-grid">
            <CategoryBreakdown
              expenses={categoryEntries}
              status={status}
              control={
                <Select
                  label="Period"
                  options={categoryMonths}
                  value={categoryMonth}
                  onChange={setCategoryMonth}
                  variant="compact"
                  className="breakdown-period"
                />
              }
            />
            <BudgetsCard
              budgets={budgets}
              expenses={expenses}
              onSave={handleSaveBudget}
              onDelete={handleDeleteBudget}
              status={status}
            />
          </div>
        )}

        {view === 'transactions' && (
          <>
            {status === 'ready' && (
              <HeadsUp budgets={budgets} expenses={expenses} userId={user?.sub} />
            )}
            <SummaryCards expenses={expenses} budgets={budgets} status={status} />

            <section
              ref={transactionsRef}
              className="panel scroll-target"
              aria-labelledby="transactions-title"
            >
                <div className="panel-head">
                  <div className="panel-head-text">
                    <h2 id="transactions-title" className="panel-title">
                      Transactions
                    </h2>
                    <span className="panel-sub">
                      {status !== 'ready'
                        ? null
                        : filtersActive
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
                  <div className="panel-tools">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setImporting(true)}
                      disabled={status !== 'ready'}
                    >
                      <UploadIcon />
                      Import
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => downloadCsv(entriesToCsv(expenses))}
                      disabled={expenses.length === 0}
                      title="Download every entry as a CSV file"
                    >
                      <DownloadIcon />
                      CSV
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setReporting(true)}
                      disabled={expenses.length === 0}
                      title="Save a report as a PDF"
                    >
                      <FileTextIcon />
                      PDF
                    </button>
                  </div>
                  <Segmented
                    name="type-filter"
                    label="Show"
                    options={TYPE_FILTERS}
                    value={filters.type}
                    onChange={(type) => updateFilters((f) => ({ ...f, type }))}
                  />
                </div>
                <ExpenseFilters filters={filters} months={months} onChange={updateFilters} />
                {listContent}
            </section>
          </>
        )}
      </main>

      {/* Phones: the tabs move to a bar at the bottom, within thumb reach,
          and the floating button adds a transaction from anywhere. */}
      <ViewTabs tabs={TABS} value={view} onChange={changeView} className="bottom-nav" />
      <button type="button" className="fab" aria-label="Add transaction" onClick={startAdding}>
        <PlusIcon />
      </button>

      {formOpen && (
        <TransactionDialog
          key={editing?.id ?? 'new'}
          editing={editing}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}

      {importing && (
        <ImportDialog
          existing={expenses}
          onClose={() => setImporting(false)}
          onImported={handleImported}
        />
      )}

      {reporting && (
        <ReportDialog
          entries={expenses}
          budgets={budgets}
          user={user}
          onClose={() => setReporting(false)}
        />
      )}

      {/* Always mounted, so screen readers announce the notice when it appears. */}
      <div role="status" aria-live="polite">
        {budgetToast ? (
          <BudgetToast alert={budgetToast} onClose={closeBudgetToast} />
        ) : (
          savedToast && <Toast message={savedToast} onClose={closeSavedToast} />
        )}
      </div>
    </MoneyContext.Provider>
  )
}
