import { Auth0Provider } from '@auth0/auth0-react'
import App from './App.jsx'
import { AUTH0, authConfigured } from './auth'
import AuthGate from './components/AuthGate'
import { InsecureAddress, LoginNotConfigured } from './components/AuthScreens'
import UpdatePrompt from './components/UpdatePrompt'

// Decides what the page can show before the app itself.
function Screen() {
  if (!authConfigured) return <LoginNotConfigured />

  // Auth0's login library refuses to run on plain http:// (except
  // localhost) and would crash to a blank page - explain instead.
  if (!window.isSecureContext) return <InsecureAddress />

  // Login with Auth0 (authorization code + PKCE, no client secret).
  // Refresh tokens kept in localStorage keep you logged in across
  // reloads; the alternative (Auth0's hidden iframe) breaks in browsers
  // that block third-party cookies. Needs "Refresh Token Rotation" on in
  // the Auth0 app settings - see README, "Login".
  return (
    <Auth0Provider
      domain={AUTH0.domain}
      clientId={AUTH0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0.audience,
      }}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <AuthGate>
        <App />
      </AuthGate>
    </Auth0Provider>
  )
}

export default function Root() {
  return (
    <>
      <Screen />
      {/* On every screen, signed in or not: "new version ready" toast. */}
      <UpdatePrompt />
    </>
  )
}
