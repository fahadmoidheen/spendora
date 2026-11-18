// Shared fetch wrapper for the Flask API.
//
// In development Vite forwards /api to Flask (see vite.config.js). Every
// call carries the logged-in user's Auth0 access token. Failed requests
// throw an Error with `status` and, for validation failures, `fields`
// ({ field: message }).

// Set by AuthGate once the user is logged in: returns a fresh access token
// (the Auth0 SDK renews it in the background when it is about to expire).
let getAccessToken = null

export function setAccessTokenGetter(getter) {
  getAccessToken = getter
}

async function authHeader() {
  if (!getAccessToken) return {}
  try {
    return { Authorization: `Bearer ${await getAccessToken()}` }
  } catch {
    // The SDK couldn't renew the session (e.g. it was revoked or expired).
    const error = new Error('Your session has expired. Log in again.')
    error.status = 401
    throw error
  }
}

export async function request(url, { method = 'GET', body } = {}) {
  const headers = { ...(await authHeader()) }
  if (body) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    // No JSON body means Flask never answered (e.g. it isn't running and
    // the Vite proxy replied instead).
    const error = new Error(
      data?.error ?? 'Could not reach the API. Is the backend running?',
    )
    error.status = response.status
    error.fields = data?.fields
    throw error
  }
  return data
}

// Amounts go over the wire as strings so "0.10" never becomes a float.
export function amountString(value) {
  return String(value).replace(/[,\s]/g, '')
}
