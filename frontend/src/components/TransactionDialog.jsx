import { useEffect, useRef } from 'react'
import ExpenseForm from './ExpenseForm'

// "Add transaction" / "Edit transaction" as a modal (native <dialog>: focus
// stays inside, Escape closes it). Full screen on phones, like the import
// and report dialogs.
export default function TransactionDialog({ editing, onSave, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    // Straight to the amount - on a phone that opens the number keyboard.
    dialog.querySelector('#amount')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="sheet transaction-dialog"
      aria-labelledby="expense-form-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <ExpenseForm editing={editing} onSave={onSave} onDone={onClose} />
    </dialog>
  )
}
