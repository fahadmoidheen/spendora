import { useAuth0 } from '@auth0/auth0-react'
import { setAccessTokenGetter } from '../api/client'
import { GOOGLE_CONNECTION } from '../auth'
import { SignInScreen, SplashScreen } from './AuthScreens'

// Shows the app only to a logged-in user; everyone else gets the sign-in
// screen. Login itself happens on Auth0's page (we never see passwords).
export default function AuthGate({ children }) {
  const { isLoading, isAuthenticated, error, loginWithRedirect, getAccessTokenSilently } =
    useAuth0()

  if (isLoading) return <SplashScreen />

  if (!isAuthenticated) {
    setAccessTokenGetter(null)
    return (
      <SignInScreen
        error={error}
        onGoogle={() =>
          loginWithRedirect({ authorizationParams: { connection: GOOGLE_CONNECTION } })
        }
        onEmail={() => loginWithRedirect()}
      />
    )
  }

  // Set during render, not in an effect: the app's first API calls run in
  // its own effects, which fire before this component's would.
  setAccessTokenGetter(getAccessTokenSilently)
  return children
}
