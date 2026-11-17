import { CURRENCIES, makeMoney } from '../currency'
import Select from './Select'

// Symbols as this browser's locale writes them, e.g. "$", "€", "₹", "CA$".
// The closed button shows the badge and code; the list adds the name.
const OPTIONS = CURRENCIES.map((c) => ({
  value: c.code,
  label: c.code,
  hint: c.name,
  icon: <span className="option-badge">{makeMoney(c.code).symbol}</span>,
}))

export default function CurrencySelect({ value, onChange }) {
  return (
    <Select
      label="Currency"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      variant="header"
    />
  )
}
