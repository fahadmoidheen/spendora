import { useLayoutEffect, useRef } from 'react'
import { sanitizeAmount } from '../currency'
import { parseAmount } from '../utils/csvImport'

// "1234.5" -> "1,234.5". Commas group the whole part; the fraction is left
// as typed.
function groupDigits(plain) {
  if (!plain) return ''
  const [whole, fraction] = plain.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

// Characters that aren't separators, before position `end` of `text`.
const digitsBefore = (text, end) => text.slice(0, end).replace(/,/g, '').length

// An amount box that shows thousands separators while you type
// ("1,234.50"), while `value` and `onChange` deal in the plain number
// ("1234.50") that the form validates and the API receives.
//
// Re-formatting moves characters around, so the caret is put back after
// the same digit it followed. Backspace or Delete on a comma removes the
// digit next to it (otherwise the comma would just reappear). Pasted text
// is read like a bank amount, so "1.234,50" and "$1,234.50" both work.
export default function AmountInput({ value, onChange, decimals = 2, ...props }) {
  const ref = useRef(null)
  const caret = useRef(null) // digits before the caret, to restore after render

  useLayoutEffect(() => {
    const input = ref.current
    if (caret.current === null || !input || document.activeElement !== input) return
    let left = caret.current
    let pos = 0
    while (pos < input.value.length && left > 0) {
      if (input.value[pos] !== ',') left -= 1
      pos += 1
    }
    input.setSelectionRange(pos, pos)
    caret.current = null
  })

  function handleChange(event) {
    const input = event.target
    let plain = input.value.replace(/,/g, '')
    let at = digitsBefore(input.value, input.selectionStart ?? input.value.length)

    // Deleting only a comma changes nothing; delete the digit beside it.
    const kind = event.nativeEvent?.inputType
    if (plain === value && kind === 'deleteContentBackward' && at > 0) {
      plain = plain.slice(0, at - 1) + plain.slice(at)
      at -= 1
    } else if (plain === value && kind === 'deleteContentForward') {
      plain = plain.slice(0, at) + plain.slice(at + 1)
    }

    caret.current = at
    onChange(sanitizeAmount(plain, decimals))
  }

  function handlePaste(event) {
    const cents = parseAmount(event.clipboardData.getData('text'))
    event.preventDefault()
    if (cents === null) return
    caret.current = null
    onChange(sanitizeAmount((Math.abs(cents) / 100).toFixed(decimals), decimals))
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      {...props}
      value={groupDigits(value)}
      onChange={handleChange}
      onPaste={handlePaste}
    />
  )
}
