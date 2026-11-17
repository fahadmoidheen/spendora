// The design's segmented control, built from real radio buttons so it
// works with the keyboard (arrow keys) and inside forms.
//
// variant "soft": white pill on grey (list filter).
// variant "strong": forest pill, full width (Expense / Income in the form).
export default function Segmented({ name, label, options, value, onChange, variant = 'soft' }) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented segmented-${variant}`}>
      {options.map((option) => (
        <label key={option.value} className="segment">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.icon}
          {option.label}
        </label>
      ))}
    </div>
  )
}
