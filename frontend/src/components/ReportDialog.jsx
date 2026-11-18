import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currentMonthKey, todayIso } from '../utils/format'
import { buildReport, periodRanges, PERIODS } from '../utils/report'
import DatePicker from './DatePicker'
import { CloseIcon, FileTextIcon } from './Icons'
import MoneyReport from './MoneyReport'
import Select from './Select'

// "PDF report": pick a period, see the report, then print it. The browser's
// print window has "Save as PDF", so no PDF library is needed and the text
// stays sharp and selectable.
//
// The report is drawn twice: once here as a preview, and once in a
// #print-root element on <body> - the only thing visible when printing.
export default function ReportDialog({ entries, budgets, user, onClose, initialPeriod = 'this-month' }) {
  const dialogRef = useRef(null)
  const [period, setPeriod] = useState(initialPeriod)
  const [custom, setCustom] = useState(() => ({ from: `${currentMonthKey()}-01`, to: todayIso() }))
  const [printRoot] = useState(() => {
    const el = document.createElement('div')
    el.id = 'print-root'
    return el
  })

  useEffect(() => {
    document.body.append(printRoot)
    return () => printRoot.remove()
  }, [printRoot])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const report = useMemo(
    () => buildReport(entries, budgets, periodRanges(period, { entries, custom })),
    [entries, budgets, period, custom],
  )
  const who = user?.name || user?.email || ''

  function savePdf() {
    // The page title becomes the suggested file name.
    const title = document.title
    document.title = `Spendora report - ${report.label}`
    const restore = () => {
      document.title = title
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className="sheet report-dialog"
        aria-labelledby="report-title"
        onCancel={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <div className="sheet-head">
          <div>
            <h2 id="report-title" className="panel-title">
              PDF report
            </h2>
            <p className="panel-sub">Totals, categories, budgets and every transaction.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-icon-sm" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="sheet-body">
          <div className="report-controls">
            <div className="field">
              <label className="field-label" htmlFor="report-period">
                Period
              </label>
              <Select id="report-period" label="Period" options={PERIODS} value={period} onChange={setPeriod} variant="filter" />
            </div>
            {period === 'custom' && (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="report-from">
                    From
                  </label>
                  <DatePicker id="report-from" name="report-from" value={custom.from} onChange={(from) => setCustom((c) => ({ ...c, from }))} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="report-to">
                    To
                  </label>
                  <DatePicker id="report-to" name="report-to" value={custom.to} onChange={(to) => setCustom((c) => ({ ...c, to }))} />
                </div>
              </>
            )}
          </div>

          <div className="report-preview">
            <MoneyReport report={report} who={who} />
          </div>
        </div>

        <div className="sheet-foot">
          <p className="field-note">
            Your browser’s print window opens next — choose “Save as PDF” as the printer.
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={savePdf}>
              <FileTextIcon />
              Save as PDF
            </button>
          </div>
        </div>
      </dialog>
      {createPortal(<MoneyReport report={report} who={who} />, printRoot)}
    </>
  )
}
