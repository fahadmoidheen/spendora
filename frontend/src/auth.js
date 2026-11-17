// Auth0 settings, read from frontend/.env.local (copy .env.example).
// None of these are secrets: they appear in every login URL anyway.

export const AUTH0 = {
  domain: (import.meta.env.VITE_AUTH0_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
  clientId: (import.meta.env.VITE_AUTH0_CLIENT_ID ?? '').trim(),
  // Must match AUTH0_AUDIENCE in backend/.env (the Auth0 API identifier).
  audience: (import.meta.env.VITE_AUTH0_AUDIENCE ?? '').trim(),
}

export const authConfigured = Boolean(AUTH0.domain && AUTH0.clientId && AUTH0.audience)

// Auth0's name for its built-in Google login.
export const GOOGLE_CONNECTION = 'google-oauth2'
