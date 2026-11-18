import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { importExpenses } from '../api/expenses'
import { CATEGORIES } from '../constants'
import { useMoney } from '../currency'
import {
  analyzeCsv,
  buildCandidates,
  CsvError,
  guessSign,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  toImportPayload,
} from '../utils/csvImport'
import { formatDate } from '../utils/format'
import { CategoryIcon, CloseIcon, UploadIcon } from './Icons'
import Segmented from './Segmented'
import Select from './Select'

const PAGE = 100 // rows shown at a time in the review list

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <CategoryIcon name={c.name} />,
}))

const AMOUNT_MODES = [
  { value: 'single', label: 'One amount column' },
  { value: 'split', label: 'Money out / in columns' },
]

const DATE_ORDERS = [
  { value: 'dmy', label: 'Day first (31/12/2026)' },
  { value: 'mdy', label: 'Month first (12/31/2026)' },
]

const SIGNS = [
  { value: 'negative-expense', label: 'Spending is negative (−12.00)' },
  { value: 'positive-expense', label: 'Spending is positive (12.00)' },
]

const plural = (n, word, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`

function ColumnSelect({ id, label, optional, value, columns, onChange }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-hint"> (optional)</span>}
      </label>
      <Select id={id} label={label} options={columns} value={value} onChange={onChange} variant="filter" />
    </div>
  )
}

// One row of the review list. memo: a file can have thousands of rows and
// only the one being changed should re-render.
const ReviewRow = memo(function ReviewRow({ row, money, onToggle, onCategory }) {
  const income = row.type === 'income'
  return (
    <li className={`import-row${row.include ? '' : ' is-off'}`}>
      <input
        type="checkbox"
        className="import-check"
        checked={row.include}
        disabled={Boolean(row.problem)}
        onChange={(event) => onToggle(row.line, event.target.checked)}
        aria-label={`Import line ${row.line}: ${row.title || 'no description'}`}
      />
      <div className="import-main">
        <p className="import-title">{row.title || <span className="import-muted">No description</span>}</p>
        <p className="import-meta">
          {row.date ? formatDate(row.date) : 'No date'}
          <span aria-hidden="true"> · </span>
          line {row.line}
          {row.problem && <span className="import-tag is-problem">{row.problem}</span>}
          {row.duplicate && <span className="import-tag">Already in Spendora</span>}
        </p>
      </div>
      <div className="import-category">
        {row.problem ? null : income ? (
          <span className="import-income-tag">Income</span>
        ) : (
          <Select
            label={`Category for line ${row.line}`}
            options={CATEGORY_OPTIONS}
            value={row.category}
            onChange={(category) => onCategory(row.line, category)}
            variant="compact"
          />
        )}
      </div>
      <p className={`import-amount${income ? ' is-income' : ''}`}>
        {row.cents ? money.formatSigned(row.cents, income ? 1 : -1) : '—'}
      </p>
    </li>
  )
})

// Import a bank statement or a Spendora export: pick a file, check the
// guessed columns, untick or re-file rows, then save them in one go.
export default function ImportDialog({ existing, onClose, onImported }) {
  const money = useMoney()
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [file, setFile] = useState(null) // { name, analysis }
  const [readError, setReadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [mapping, setMapping] = useState(null)
  const [amountMode, setAmountMode] = useState('single')
  const [dateOrder, setDateOrder] = useState('dmy')
  const [sign, setSign] = useState('negative-expense')
  const [edits, setEdits] = useState({}) // line -> { include?, category? }
  const [visible, setVisible] = useState(PAGE)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  async function readFile(picked) {
    setReadError('')
    if (!picked) return
    if (picked.size > MAX_FILE_BYTES) {
      setReadError('That file is over 5 MB. Export a shorter date range and try again.')
      return
    }
    try {
      const analysis = analyzeCsv(await picked.text())
      const m = analysis.mapping
      setFile({ name: picked.name, analysis })
      setMapping(m)
      setAmountMode(m.amount === -1 && (m.debit !== -1 || m.credit !== -1) ? 'split' : 'single')
      setDateOrder(analysis.dateOrder.order)
      setSign(analysis.sign)
      setEdits({})
      setVisible(PAGE)
      setSaveError('')
    } catch (err) {
      if (!(err instanceof CsvError)) console.warn('Could not read the CSV file:', err)
      setReadError(
        err instanceof CsvError
          ? err.message
          : 'This file couldn’t be read. Make sure it’s a CSV file and try again.',
      )
    }
  }

  const columns = useMemo(
    () =>
      file
        ? [
            { value: -1, label: 'Not in this file' },
            ...file.analysis.headers.map((header, index) => ({ value: index, label: header })),
          ]
        : [],
    [file],
  )

  const candidates = useMemo(() => {
    if (!file) return []
    const effective =
      amountMode === 'single'
        ? { ...mapping, debit: -1, credit: -1 }
        : { ...mapping, amount: -1 }
    return buildCandidates(file.analysis, effective, { dateOrder, sign }, existing)
  }, [file, mapping, amountMode, dateOrder, sign, existing])

  // The user's ticks and category changes on top. Unedited rows keep their
  // identity, so only edited rows re-render.
  const rows = useMemo(
    () =>
      candidates.map((row) => {
        const edit = edits[row.line]
        if (!edit) return row
        return {
          ...row,
          include: !row.problem && (edit.include ?? row.include),
          category: edit.category ?? row.category,
        }
      }),
    [candidates, edits],
  )

  const counts = useMemo(() => {
    let include = 0
    let duplicate = 0
    let problem = 0
    for (const row of rows) {
      if (row.include) include += 1
      if (row.duplicate) duplicate += 1
      if (row.problem) problem += 1
    }
    return { include, duplicate, problem }
  }, [rows])

  function setColumn(field, index) {
    // A column feeds one field only - free it from wherever it was.
    const next = Object.fromEntries(
      Object.entries(mapping).map(([f, i]) => [f, i === index && index !== -1 ? -1 : i]),
    )
    next[field] = index
    setMapping(next)
    if (field === 'amount') setSign(guessSign(file.analysis.rows, next))
  }

  // Stable callbacks so memoised rows don't all re-render.
  const handlers = useMemo(
    () => ({
      toggle: (line, include) => setEdits((e) => ({ ...e, [line]: { ...e[line], include } })),
      category: (line, category) => setEdits((e) => ({ ...e, [line]: { ...e[line], category } })),
    }),
    [],
  )

  function toggleAll(include) {
    setEdits((e) => {
      const next = { ...e }
      for (const row of rows) if (!row.problem) next[row.line] = { ...next[row.line], include }
      return next
    })
  }

  async function save() {
    const chosen = rows.filter((row) => row.include)
    setSaving(true)
    setSaveError('')
    try {
      const { entries } = await importExpenses(toImportPayload(chosen))
      onImported(entries)
    } catch (err) {
      const [key, message] = Object.entries(err.fields ?? {})[0] ?? []
      const index = Number(key?.split('.')[1])
      setSaveError(
        Number.isInteger(index) && chosen[index]
          ? `Line ${chosen[index].line}: ${message}`
          : `Couldn’t import. ${err.message}`,
      )
      setSaving(false)
    }
  }

  const missingDate = mapping?.date === -1
  const missingAmount =
    mapping && (amountMode === 'single' ? mapping.amount === -1 : mapping.debit === -1 && mapping.credit === -1)
  const tooMany = counts.include > MAX_IMPORT_ROWS
  const importable = rows.filter((row) => !row.problem)
  const allOn = importable.length > 0 && importable.every((row) => row.include)

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="import-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onClose()
      }}
    >
      <div className="sheet-head">
        <div>
          <h2 id="import-title" className="panel-title">
            Import from CSV
          </h2>
          <p className="panel-sub">
            {file ? file.name : 'A bank statement, or a file exported from Spendora.'}
          </p>
        </div>
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

      {!file ? (
        <div className="sheet-body">
          <label
            className={`import-drop${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              readFile(event.dataTransfer.files?.[0])
            }}
          >
            <span className="import-drop-icon" aria-hidden="true">
              <UploadIcon />
            </span>
            <span className="import-drop-title">Choose a CSV file</span>
            <span className="import-drop-text">or drop it here · up to 5 MB</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="visually-hidden"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
          </label>
          {readError && (
            <p className="form-error" role="alert">
              {readError}
            </p>
          )}
          <p className="field-note">
            Most banks offer “Download as CSV” on the statement page. You’ll check every row before
            anything is saved.
          </p>
        </div>
      ) : (
        <>
          <div className="sheet-body">
            <section className="import-columns" aria-label="Columns">
              <div className="import-columns-head">
                <p className="field-label">Which column is which?</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFile(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                >
                  Choose another file
                </button>
              </div>
              <div className="import-grid">
                <ColumnSelect id="col-date" label="Date" value={mapping.date} columns={columns} onChange={(i) => setColumn('date', i)} />
                <ColumnSelect id="col-title" label="Description" optional value={mapping.title} columns={columns} onChange={(i) => setColumn('title', i)} />
                {file.analysis.dateOrder.numeric && (
                  <div className="field">
                    <label className="field-label" htmlFor="date-order">
                      Date order
                    </label>
                    <Select id="date-order" label="Date order" options={DATE_ORDERS} value={dateOrder} onChange={setDateOrder} variant="filter" />
                    {!file.analysis.dateOrder.sure && (
                      <p className="field-note is-warning">Every day in this file is 12 or under, so check this.</p>
                    )}
                  </div>
                )}
              </div>

              <Segmented name="amount-mode" label="Amounts" options={AMOUNT_MODES} value={amountMode} onChange={setAmountMode} />
              <div className="import-grid">
                {amountMode === 'single' ? (
                  <>
                    <ColumnSelect id="col-amount" label="Amount" value={mapping.amount} columns={columns} onChange={(i) => setColumn('amount', i)} />
                    <div className="field">
                      <label className="field-label" htmlFor="amount-sign">
                        Spending shows as
                      </label>
                      <Select id="amount-sign" label="Spending shows as" options={SIGNS} value={sign} onChange={setSign} variant="filter" />
                    </div>
                  </>
                ) : (
                  <>
                    <ColumnSelect id="col-debit" label="Money out" value={mapping.debit} columns={columns} onChange={(i) => setColumn('debit', i)} />
                    <ColumnSelect id="col-credit" label="Money in" value={mapping.credit} columns={columns} onChange={(i) => setColumn('credit', i)} />
                  </>
                )}
                <ColumnSelect id="col-category" label="Category" optional value={mapping.category} columns={columns} onChange={(i) => setColumn('category', i)} />
                <ColumnSelect id="col-note" label="Note" optional value={mapping.note} columns={columns} onChange={(i) => setColumn('note', i)} />
              </div>
            </section>

            <section className="import-review" aria-labelledby="import-review-title">
              <div className="import-review-head">
                <label className="import-all">
                  <input
                    type="checkbox"
                    className="import-check"
                    checked={allOn}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                  <span id="import-review-title" className="field-label">
                    {plural(rows.length, 'row')}
                  </span>
                </label>
                <p className="import-summary">
                  {counts.duplicate > 0 && <span>{plural(counts.duplicate, 'already in Spendora', 'already in Spendora')}</span>}
                  {counts.problem > 0 && <span className="is-problem">{plural(counts.problem, 'can’t be read', 'can’t be read')}</span>}
                </p>
              </div>
              {(missingDate || missingAmount) && (
                <p className="field-note is-warning">
                  Pick the {missingDate ? 'date' : 'amount'} column above to read the rows.
                </p>
              )}
              <ul className="import-list">
                {rows.slice(0, visible).map((row) => (
                  <ReviewRow
                    key={row.line}
                    row={row}
                    money={money}
                    onToggle={handlers.toggle}
                    onCategory={handlers.category}
                  />
                ))}
              </ul>
              {rows.length > visible && (
                <button type="button" className="btn btn-ghost btn-sm import-more" onClick={() => setVisible((v) => v + PAGE)}>
                  Show {Math.min(PAGE, rows.length - visible)} more of {plural(rows.length - visible, 'row')}
                </button>
              )}
            </section>
          </div>

          <div className="sheet-foot">
            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
            {tooMany && (
              <p className="form-error">
                Import at most {MAX_IMPORT_ROWS.toLocaleString()} rows at a time — untick some or split the file.
              </p>
            )}
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={saving || counts.include === 0 || tooMany}
              >
                {saving ? 'Importing…' : `Import ${plural(counts.include, 'entry', 'entries')}`}
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  )
}
