// Shared fetch wrapper for the Flask API.
//
// In development Vite forwards /api to Flask (see vite.config.js). Failed
// requests throw an Error with `status` and, for validation failures,
// `fields` ({ field: message }).

export async function request(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
