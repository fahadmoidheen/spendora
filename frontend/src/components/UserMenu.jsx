import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, LogoutIcon } from './Icons'

function initials(user) {
  const source = user.name || user.email || '?'
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

// Profile photo from Google / Gravatar, or initials when there is none.
function Avatar({ user, size = 'sm' }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {user.picture && !broken ? (
        <img
          src={user.picture}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        initials(user)
      )}
    </span>
  )
}

// Header account button: photo, then a card with name, email, user id
// (needed once for `flask assign-owner`) and Log out.
export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(user.sub)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked - the id is still visible to select by hand.
    }
  }

  const label = user.name || user.email || 'your account'

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-icon header-icon-btn avatar-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar user={user} />
      </button>

      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-head">
            <Avatar user={user} size="lg" />
            <div className="user-menu-who">
              <p className="user-menu-name">{user.name || user.email}</p>
              {user.email && user.email !== user.name && (
                <p className="user-menu-email">{user.email}</p>
              )}
            </div>
          </div>

          <div className="user-menu-id">
            <p className="user-menu-label">Your user ID</p>
            <div className="user-menu-id-row">
              <code>{user.sub}</code>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-icon-sm"
                aria-label={copied ? 'Copied' : 'Copy user ID'}
                title={copied ? 'Copied' : 'Copy user ID'}
                onClick={copyUserId}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}>
            <LogoutIcon />
            Log out
          </button>
          <a className="user-menu-link" href="/privacy.html">
            Privacy
          </a>
        </div>
      )}
    </div>
  )
}
