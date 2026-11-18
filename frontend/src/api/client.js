// Shared fetch wrapper for the Flask API.
//
// In development Vite forwards /api to Flask (see vite.config.js). Every
// call carries the logged-in user's Auth0 access token. Failed requests
// throw an Error with `status` and, for validation failures, `fields`
// ({ field: message }).
//
// The error's `message` is always a short, plain sentence for people -
// never server details. Screens put it after what failed: "Couldn't save.
// Please try again in a moment." The technical detail goes to the browser
// console for debugging.

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
  } catch (err) {
    // The SDK couldn't renew the session (e.g. it was revoked or expired).
    console.warn('Could not get an access token:', err)
    throw apiError(MESSAGES.session, 401)
  }
}

export const MESSAGES = {
  offline: 'Check your internet connection and try again.',
  session: 'Your session has expired. Please log in again.',
  forbidden: 'You don’t have access to this.',
  gone: 'It may have been deleted already.',
  invalid: 'Please check the details and try again.',
  tooBig: 'That’s too much at once. Try fewer rows.',
  generic: 'Please try again in a moment.',
}

// A plain sentence for a failed response. Only a 409 keeps the server's
// own words, because those are written for people ("There is already a
// budget for Food."); everything else is generic.
function friendlyMessage(status, data) {
  if (status === 401) return MESSAGES.session
  if (status === 403) return MESSAGES.forbidden
  if (status === 404) return MESSAGES.gone
  if (status === 409 && data?.error) return data.error
  if (status === 413) return MESSAGES.tooBig
  if (status === 400 || status === 422) return MESSAGES.invalid
  return MESSAGES.generic
}

// The hosted API (Render's free plan) sleeps when nobody uses it and takes
// up to a minute to start again. Meanwhile the request either fails or the
// host in front of it (Netlify, or the Vite dev proxy) gives up and answers
// 502/503/504 itself - without the JSON our API always sends. Reads (GET)
// are safe to repeat, so they're retried for about a minute. Saves are
// never retried: a save that timed out may still have gone through.
const WAKING_STATUSES = new Set([502, 503, 504])
const RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 10000, 12000, 15000]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function apiError(message, status, fields) {
  const error = new Error(message)
  error.status = status
  error.fields = fields
  return error
}

export async function request(url, { method = 'GET', body } = {}) {
  const canRetry = method === 'GET'

  for (let attempt = 0; ; attempt++) {
    const retryLeft = canRetry && attempt < RETRY_DELAYS_MS.length && navigator.onLine !== false
    const headers = { ...(await authHeader()) }
    if (body) headers['Content-Type'] = 'application/json'

    let response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      if (retryLeft) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      console.warn(`${method} ${url} failed:`, err)
      throw apiError(navigator.onLine === false ? MESSAGES.offline : MESSAGES.generic, 0)
    }

    if (response.status === 204) return null

    const data = await response.json().catch(() => null)
    if (response.ok) return data

    // No JSON body: our API never answered (asleep, starting, or not
    // running) and the host in front of it replied instead.
    if (!data && WAKING_STATUSES.has(response.status) && retryLeft) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    console.warn(`${method} ${url} answered ${response.status}:`, data ?? '(no JSON body)')
    throw apiError(friendlyMessage(response.status, data), response.status, data?.fields)
  }
}

// Amounts go over the wire as strings so "0.10" never becomes a float.
export function amountString(value) {
  return String(value).replace(/[,\s]/g, '')
}
