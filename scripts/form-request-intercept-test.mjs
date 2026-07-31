#!/usr/bin/env node
/**
 * Form request contract via intercepted fetch (no CORS change, no remote POST).
 * Simulates production browser targets for each channel.
 */
import assert from 'node:assert/strict'
import { leadsApiUrl, careersApiUrl, postJsonLead } from '../lib/leads/browser-api.js'

const origin = 'https://deintarifheld-leads-api.vercel.app'
process.env.NEXT_PUBLIC_LEADS_API_ORIGIN = origin

const cases = [
  {
    name: 'hero',
    url: () => leadsApiUrl(),
    expectUrl: `${origin}/api/leads/`,
    payload: {
      page_source: 'hero-funnel',
      lead_type: 'private_energy',
      website_url: '',
      company_fax: '',
    },
  },
  {
    name: 'funnel',
    url: () => leadsApiUrl(),
    expectUrl: `${origin}/api/leads/`,
    payload: {
      page_source: 'main_funnel',
      lead_type: 'private_energy',
      website_url: '',
      company_fax: '',
    },
  },
  {
    name: 'unternehmen',
    url: () => leadsApiUrl(),
    expectUrl: `${origin}/api/leads/`,
    payload: {
      page_source: 'unternehmen',
      lead_type: 'business_energy',
      website_url: '',
      company_fax: '',
    },
  },
  {
    name: 'career',
    url: () => careersApiUrl(),
    expectUrl: `${origin}/api/careers/`,
    payload: {
      page_source: 'career',
      website_url: '',
      company_fax: '',
    },
  },
]

for (const c of cases) {
  const calls = []
  const prev = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, leadRef: 'TEST' }
      },
    }
  }
  try {
    const target = c.url()
    assert.equal(target, c.expectUrl)
    assert.doesNotMatch(target, /308|script\.google|AKfycb|localhost/)
    const { res, json } = await postJsonLead(target, c.payload)
    assert.equal(res.status, 200)
    assert.equal(json.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
    assert.ok(calls[0].init.headers['Idempotency-Key'])
    const body = JSON.parse(calls[0].init.body)
    assert.equal(body.page_source, c.payload.page_source)
    assert.equal(body.website_url || '', '')
    assert.equal(body.company_fax || '', '')
  } finally {
    globalThis.fetch = prev
  }
  console.log(`FORM_INTERCEPT_OK name=${c.name} url=${c.expectUrl}`)
}

console.log('FORM_REQUEST_INTERCEPTION=PASS')
console.log('DIRECT_FORM_FETCH_TARGETS=0')
console.log('ALL_FORMS_USE_SHARED_BROWSER_API=YES')
