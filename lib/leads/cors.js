/**
 * Restrictive CORS for hybrid Checkdomain → Vercel API.
 * No wildcard origins. Exact allowlist only.
 */

import { clientIp } from './abuse-guard.js'

const DEFAULT_ORIGINS = [
  'https://deintarifheld.de',
  'https://www.deintarifheld.de',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

export function allowedOrigins() {
  const extra = (process.env.LEADS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // Deduplicate
  return [...new Set([...DEFAULT_ORIGINS, ...extra])]
}

export function resolveAllowedOrigin(request) {
  const origin = request.headers.get('origin')?.trim()
  if (!origin) return null
  return allowedOrigins().includes(origin) ? origin : null
}

export function corsHeaders(request, { allowMethods = 'POST, GET, OPTIONS' } = {}) {
  const origin = resolveAllowedOrigin(request)
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function withCors(request, response) {
  const headers = corsHeaders(request)
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v)
  }
  // Request id for observability (not PII)
  if (!response.headers.get('x-request-id')) {
    const rid = `dth_${Date.now().toString(36)}_${clientIp(request).slice(0, 8)}`
    response.headers.set('x-request-id', rid)
  }
  return response
}

export function optionsResponse(request) {
  const origin = resolveAllowedOrigin(request)
  if (!origin) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}
