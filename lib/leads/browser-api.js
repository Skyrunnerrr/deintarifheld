/**
 * Browser-safe API URL helpers for Phase B form submits.
 * Uses NEXT_PUBLIC_LEADS_API_URL when the static site talks to the Vercel API.
 */
export function leadsApiUrl() {
  const configured = process.env.NEXT_PUBLIC_LEADS_API_URL
  if (configured && String(configured).trim()) return String(configured).trim()
  return '/api/leads'
}

export function careersApiUrl() {
  const configured = process.env.NEXT_PUBLIC_LEADS_API_URL
  if (configured && String(configured).trim()) {
    return String(configured).trim().replace(/\/api\/leads\/?$/i, '/api/careers')
  }
  return '/api/careers'
}

export async function postJsonLead(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { res, json }
}
