import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './Icons'

// Dropdown in the app's style. A native <select> can't be used because
// its open list is drawn by the operating system and ignores CSS.
//
// Follows the ARIA "select-only combobox" pattern: focus stays on the
// button, the highlighted option is announced via aria-activedescendant.
// Keys: Enter/Space/Arrows open; Arrows, Home/End, PageUp/PageDown move;
// Enter/Space pick; Escape or Tab close; typing jumps to a matching
// option.
//
// options: [{ value, label, short?, hint?, icon? }]
//   short - shorter text for the closed button (e.g. "USD")
//   hint  - grey text after the label in the list (e.g. "US dollar")
//   icon  - element shown before the label

const OPTION_HEIGHT = 44
const MENU_MAX_HEIGHT = 304

export default function Select({
  value,
  onChange,
  options,
  label,
  id,
  variant = 'field',
  className = '',
}) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const typed = useRef({ text: '', timer: 0 })

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [placement, setPlacement] = useState({ above: false, right: false })

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]
  const last = options.length - 1

  function openMenu(startIndex = selectedIndex) {
    // Open upwards when there's no room below. (Right-aligning is decided
    // after the menu renders - see the layout effect below.)
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = Math.min(MENU_MAX_HEIGHT, options.length * OPTION_HEIGHT + 12)
    const spaceBelow = window.innerHeight - rect.bottom
    setPlacement({ above: spaceBelow < menuHeight + 12 && rect.top > spaceBelow, right: false })
    setActive(startIndex)
    setOpen(true)
  }

  // The menu is as wide as its longest option, so only once it's drawn do
  // we know whether it sticks out past the right edge; if so, align it to
  // the button's right edge instead. Runs before paint, so no flicker.
  useLayoutEffect(() => {
    if (!open || placement.right) return
    if (listRef.current.getBoundingClientRect().right > window.innerWidth - 8) {
      setPlacement((p) => ({ ...p, right: true }))
    }
  }, [open, placement.right])

  function choose(index) {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Index of the next option whose label starts with what was typed.
  function findTyped(char, from) {
    const state = typed.current
    clearTimeout(state.timer)
    state.text += char.toLowerCase()
    state.timer = setTimeout(() => {
      state.text = ''
    }, 600)
    const rotated = [...options.keys()].map((_, i) => (from + 1 + i) % options.length)
    const match = rotated.find((i) => options[i].label.toLowerCase().startsWith(state.text))
    return match ?? -1
  }

  function onKeyDown(event) {
    const { key } = event
    const printable = key.length === 1 && key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault()
        openMenu()
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault()
        openMenu(key === 'Home' ? 0 : last)
      } else if (printable) {
        const match = findTyped(key, selectedIndex)
        if (match !== -1) openMenu(match)
      }
      return
    }

    const moves = {
      ArrowDown: () => Math.min(active + 1, last),
      ArrowUp: () => Math.max(active - 1, 0),
      Home: () => 0,
      End: () => last,
      PageDown: () => Math.min(active + 8, last),
      PageUp: () => Math.max(active - 8, 0),
    }
    if (moves[key]) {
      event.preventDefault()
      setActive(moves[key]())
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      choose(active)
    } else if (key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (key === 'Tab') {
      setOpen(false)
    } else if (printable) {
      const match = findTyped(key, active)
      if (match !== -1) setActive(match)
    }
  }

  // Keep the highlighted option in view by scrolling the menu only -
  // scrollIntoView() would scroll the whole page as well.
  useEffect(() => {
    const list = listRef.current
    const option = list?.children[active]
    if (!option) return
    const top = option.offsetTop
    const bottom = top + option.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top - 6
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 6
    }
  }, [open, active])

  // A click anywhere outside closes the menu.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => () => clearTimeout(typed.current.timer), [])

  const menuClass = [
    'select-menu',
    placement.above && 'is-above',
    placement.right && 'is-right',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`select select-${variant} ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">
          {selected?.icon}
          <span className="select-text">{selected?.short ?? selected?.label}</span>
        </span>
        <ChevronDownIcon />
      </button>

      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={label} className={menuClass}>
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <li
                key={option.value}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`select-option${index === active ? ' is-active' : ''}`}
                onPointerMove={() => index !== active && setActive(index)}
                // Keep focus on the button so the menu doesn't blur shut.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {option.icon}
                <span className="select-option-text">
                  {option.label}
                  {option.hint && <span className="select-option-hint">{option.hint}</span>}
                </span>
                {isSelected && <CheckIcon />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
