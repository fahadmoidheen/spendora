import { GoogleIcon, LogoMark, MailIcon } from './Icons'

// Full-page screens shown before the app: loading, sign-in, and the
// "login isn't set up" notice. Same card style as the rest of the app.

function AuthCard({ children }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <span className="auth-mark" aria-hidden="true">
          <LogoMark strokeWidth={8} dot={7} />
        </span>
        {children}
      </div>
    </main>
  )
}

export function SplashScreen() {
  return (
    <main className="auth-screen">
      <div className="auth-splash">
        <span className="auth-mark" aria-hidden="true">
          <LogoMark strokeWidth={8} dot={7} />
        </span>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    </main>
  )
}

export function SignInScreen({ error, onGoogle, onEmail }) {
  return (
    <AuthCard>
      <h1 className="auth-title">Spendora</h1>
      <p className="auth-text">See where your money flows. Log in to continue.</p>

      {error && (
        <div className="notice notice-danger" role="alert">
          <p>{error.message || 'Login failed. Try again.'}</p>
        </div>
      )}

      <div className="auth-actions">
        <button type="button" className="btn btn-outline btn-block" onClick={onGoogle}>
          <GoogleIcon />
          Continue with Google
        </button>
        <button type="button" className="btn btn-primary btn-block" onClick={onEmail}>
          <MailIcon />
          Log in with email
        </button>
      </div>

      <p className="auth-foot">
        Login is handled by Auth0. Spendora never sees your password.{' '}
        <a href="/privacy.html">Privacy</a>
      </p>
    </AuthCard>
  )
}

// Shown on a plain http:// address other than localhost, e.g. a phone
// opening http://192.168.x.x - Auth0 can't run there.
export function InsecureAddress() {
  const httpsUrl = `https://${window.location.host}${window.location.pathname}`
  return (
    <AuthCard>
      <h1 className="auth-title">Login needs a secure address</h1>
      <p className="auth-text">
        Signing in only works on <code>https://</code> addresses or on this
        computer’s <code>localhost</code>.
      </p>
      <ol className="auth-steps">
        <li>
          On this computer, open <code>http://localhost:5173</code>.
        </li>
        <li>
          On a phone, start the phone server with <code>npm run dev:phone</code> and
          open the <code>https://</code> address it prints.
        </li>
      </ol>
      <a className="btn btn-primary btn-block" href={httpsUrl}>
        Try the https:// address
      </a>
    </AuthCard>
  )
}

export function LoginNotConfigured() {
  return (
    <AuthCard>
      <h1 className="auth-title">Login isn’t set up yet</h1>
      <p className="auth-text">Spendora needs your Auth0 details before anyone can log in.</p>
      <ol className="auth-steps">
        <li>
          Copy <code>frontend/.env.example</code> to <code>frontend/.env.local</code>.
        </li>
        <li>Fill in your Auth0 domain, client ID and API identifier.</li>
        <li>
          Restart <code>npm run dev</code>.
        </li>
      </ol>
      <p className="auth-foot">Step-by-step guide: README, “Login (Auth0)”.</p>
    </AuthCard>
  )
}
