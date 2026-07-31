#!/usr/bin/env node
/**
 * Unit tests for trailing-slash-safe browser API URL contract.
 * Env is read at call time in browser-api helpers.
 */
import assert from 'node:assert/strict'
import { leadsApiUrl, careersApiUrl, newIdempotencyKey, postJsonLead } from '../lib/leads/browser-api.js'

const origin = 'https://deintarifheld-leads-api.vercel.app'

async function withEnv(env, fn) {
  const prev = {
    ORIGIN: process.env.NEXT_PUBLIC_LEADS_API_ORIGIN,
    URL: process.env.NEXT_PUBLIC_LEADS_API_URL,
  }
  if (env.ORIGIN === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_ORIGIN
  else process.env.NEXT_PUBLIC_LEADS_API_ORIGIN = env.ORIGIN
  if (env.URL === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_URL
  else process.env.NEXT_PUBLIC_LEADS_API_URL = env.URL
  try {
    return await fn()
  } finally {
    if (prev.ORIGIN === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_ORIGIN
    else process.env.NEXT_PUBLIC_LEADS_API_ORIGIN = prev.ORIGIN
    if (prev.URL === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_URL
    else process.env.NEXT_PUBLIC_LEADS_API_URL = prev.URL
  }
}

withEnv({ ORIGIN: origin, URL: undefined }, () => {
  assert.equal(leadsApiUrl(), `${origin}/api/leads/`)
  assert.equal(careersApiUrl(), `${origin}/api/careers/`)
})

withEnv({ ORIGIN: undefined, URL: `${origin}/api/leads` }, () => {
  assert.equal(leadsApiUrl(), `${origin}/api/leads/`)
  assert.equal(careersApiUrl(), `${origin}/api/careers/`)
})

withEnv({ ORIGIN: undefined, URL: `${origin}/api/leads/` }, () => {
  assert.equal(leadsApiUrl(), `${origin}/api/leads/`)
  assert.equal(careersApiUrl(), `${origin}/api/careers/`)
})

withEnv({ ORIGIN: `${origin}/`, URL: undefined }, () => {
  assert.equal(leadsApiUrl(), `${origin}/api/leads/`)
  assert.doesNotMatch(leadsApiUrl(), /\/\/api/)
  assert.doesNotMatch(leadsApiUrl(), /api\/leads\/api\/leads/)
})

withEnv({ ORIGIN: undefined, URL: undefined }, () => {
  assert.equal(leadsApiUrl(), '/api/leads/')
  assert.equal(careersApiUrl(), '/api/careers/')
})

await withEnv({ ORIGIN: origin, URL: undefined }, async () => {
  const key = newIdempotencyKey()
  assert.ok(key && key.length >= 8)
  const calls = []
  const prevFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true }
      },
    }
  }
  try {
    const { res, json, idempotencyKey } = await postJsonLead(leadsApiUrl(), {
      page_source: 'hero-funnel',
    })
    assert.equal(res.status, 200)
    assert.equal(json.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, `${origin}/api/leads/`)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
    assert.ok(calls[0].init.headers['Idempotency-Key'])
    assert.equal(idempotencyKey, calls[0].init.headers['Idempotency-Key'])
    assert.doesNotMatch(calls[0].url, /script\.google/)
  } finally {
    globalThis.fetch = prevFetch
  }
})

console.log('BROWSER_API_CONTRACT_TEST=PASS')
console.log('CANONICAL_API_ENV_CONTRACT=NEXT_PUBLIC_LEADS_API_ORIGIN')
console.log(`LEADS_FINAL_URL=${origin}/api/leads/`)
console.log(`CAREERS_FINAL_URL=${origin}/api/careers/`)
console.log('TRAILING_SLASH_NORMALIZED=YES')
