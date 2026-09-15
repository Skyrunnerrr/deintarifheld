/**
 * Restrictive CORS for hybrid Checkdomain → Vercel API.
 * No wildcard origins. Exact allowlist only. Localhost never in production.
 */

import { effectiveAllowedOrigins } from './runtime-env.js'
import { applySecurityHeaders } from './security-headers.js'

export function allowedOrigins() {
  return effectiveAllowedOrigins()
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
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function withCors(request, response) {
  const headers = corsHeaders(request)
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v)
  }
  applySecurityHeaders(response.headers)
  if (!response.headers.get('x-request-id')) {
    const rid = request.headers.get('x-request-id')?.trim() || `dth_${Date.now().toString(36)}`
    response.headers.set('x-request-id', rid)
  }
  return response
}

export function optionsResponse(request) {
  const origin = resolveAllowedOrigin(request)
  if (!origin) {
    const denied = new Response(null, { status: 403 })
    applySecurityHeaders(denied.headers)
    return denied
  }
  const res = new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
  applySecurityHeaders(res.headers)
  return res
}

/** Request id without embedding client IP. */
export function requestIdFallback(request) {
  return request.headers.get('x-request-id')?.trim() || `dth_${Date.now().toString(36)}`
}
