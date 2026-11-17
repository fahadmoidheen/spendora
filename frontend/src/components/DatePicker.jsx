import { useEffect, useId, useRef, useState } from 'react'
import {
  formatFullDate,
  formatLongDate,
  formatMonth,
  parseDate,
  toIsoDate,
  todayIso,
} from '../utils/format'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons'

// Calendar date picker in the app's own style, replacing the browser's
// <input type="date"> (which looks different in every browser).
//
// Mouse: click the field, pick a day. Keyboard: Enter/Space opens; arrows
// move by day/week; Home/End go to the start/end of the week; PageUp/
// PageDown change month (with Shift, year); Enter picks; Escape closes.
//
// Values are "YYYY-MM-DD" strings, like the API's expense_date.

const PANEL_HEIGHT = 420 // roughly - decides whether to open upwards

// First day of the week for the browser's locale (0 = Sunday).
function weekStartDay() {
  try {
    const locale = new Intl.Locale(navigator.language)
    const info = locale.getWeekInfo?.() ?? locale.weekInfo
    if (info?.firstDay) return info.firstDay % 7
  } catch {
    // Older browsers don't expose week info - fall back to Sunday.
  }
  return 0
}

const WEEK_START = weekStartDay()

// Weekday column headings, starting on WEEK_START. 4 Jan 2026 is a Sunday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(2026, 0, 4 + ((WEEK_START + i) % 7))
  return {
    short: date.toLocaleDateString(undefined, { weekday: 'short' }),
    long: date.toLocaleDateString(undefined, { weekday: 'long' }),
  }
})

function addDays(iso, days) {
  const date = parseDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

// Same day in another month, clamped: 31 Jan + 1 month -> 28 Feb.
function addMonths(iso, months) {
  const date = parseDate(iso)
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return toIsoDate(target)
}

function dayOfWeek(iso) {
  return (parseDate(iso).getDay() - WEEK_START + 7) % 7
}

// Always six weeks, so the calendar doesn't change height between months.
function monthWeeks(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const offset = dayOfWeek(`${monthKey}-01`)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) =>
      toIsoDate(new Date(y, m - 1, 1 - offset + week * 7 + day)),
    ),
  )
}

export default function DatePicker({ id, name, value, onChange, invalid, describedBy }) {
  const panelId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const gridRef = useRef(null)
  // Set when keyboard focus should follow the focused day on next render.
  const focusDayRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const [focused, setFocused] = useState(value || todayIso())

  const today = todayIso()
  const viewMonth = focused.slice(0, 7)

  function openPicker() {
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setAbove(spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow)
    setFocused(value || today)
    focusDayRef.current = true
    setOpen(true)
  }

  function close({ returnFocus = false } = {}) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function select(iso) {
    onChange(iso)
    close({ returnFocus: true })
  }

  function moveFocus(iso) {
    focusDayRef.current = true
    setFocused(iso)
  }

  useEffect(() => {
    if (!open || !focusDayRef.current) return
    focusDayRef.current = false
    gridRef.current?.querySelector(`[data-date="${focused}"]`)?.focus()
  }, [open, focused])

  // A click anywhere outside closes the calendar.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onGridKeyDown(event) {
    const moves = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -dayOfWeek(focused)),
      End: () => addDays(focused, 6 - dayOfWeek(focused)),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveFocus(move())
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close({ returnFocus: true })
    }
  }

  // Tabbing out of the picker closes it too.
  function onBlur(event) {
    if (event.relatedTarget && !rootRef.current.contains(event.relatedTarget)) {
      setOpen(false)
    }
  }

  return (
    <div className="datepicker" ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        className={`date-field${invalid ? ' is-invalid' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openPicker())}
      >
        <span className={value ? undefined : 'date-placeholder'}>
          {value ? formatFullDate(value) : 'Pick a date'}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date"
          className={`datepicker-panel${above ? ' is-above' : ''}`}
        >
          <div className="datepicker-head">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-icon-sm"
              aria-label="Previous month"
              onClick={() => setFocused(addMonths(focused, -1))}
            >
              <ChevronLeftIcon />
            </button>
            <p className="datepicker-title" aria-live="polite">
              {formatMonth(viewMonth)}
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-icon-sm"
              aria-label="Next month"
              onClick={() => setFocused(addMonths(focused, 1))}
            >
              <ChevronRightIcon />
            </button>
          </div>

          <table
            ref={gridRef}
            className="datepicker-grid"
            role="grid"
            aria-label={formatMonth(viewMonth)}
            onKeyDown={onGridKeyDown}
          >
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th key={d.long} scope="col" abbr={d.long}>
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthWeeks(viewMonth).map((week) => (
                <tr key={week[0]}>
                  {week.map((iso) => {
                    const classes = [
                      'day',
                      iso.slice(0, 7) !== viewMonth && 'is-outside',
                      iso === today && 'is-today',
                      iso === value && 'is-selected',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td key={iso} role="gridcell" aria-selected={iso === value}>
                        <button
                          type="button"
                          className={classes}
                          data-date={iso}
                          tabIndex={iso === focused ? 0 : -1}
                          aria-label={formatLongDate(iso)}
                          aria-current={iso === today ? 'date' : undefined}
                          onClick={() => select(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="datepicker-foot">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => select(today)}
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => select(addDays(today, -1))}
            >
              Yesterday
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
