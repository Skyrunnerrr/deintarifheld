#!/usr/bin/env node
/**
 * Full public-form contract matrix.
 *
 * No network, no production writes. This locks every public form surface to
 * the same server/API/captcha/honeypot/idempotency contract and exercises the
 * validators with representative payloads.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveExpectedCaptchaAction } from '../lib/leads/captcha-action.js'
import { validatePrivatePayload } from '../lib/leads/validate-private.js'
import { validateUnternehmenPayload } from '../lib/leads/validate-unternehmen.js'
import { validateCareerPayload } from '../lib/leads/validate-career.js'
import { careersApiUrl, leadsApiUrl } from '../lib/leads/browser-api.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const surfaces = [
  {
    name: 'hero',
    path: 'components/sections/Hero.jsx',
    endpoint: 'leads',
    endpointHelper: 'leadsApiUrl',
    pageSource: 'hero-funnel',
    action: 'hero_funnel',
    sourcePage: '/',
    honeypotExprs: [
      /website_url:\s*formData\[HONEYPOT_FIELD\]/,
      /company_fax:\s*formData\[HONEYPOT_FIELD_2\]/,
    ],
  },
  {
    name: 'main-funnel',
    path: 'components/sections/FunnelSection.jsx',
    endpoint: 'leads',
    endpointHelper: 'leadsApiUrl',
    pageSource: 'main_funnel',
    action: 'main_funnel',
    sourcePage: '/',
    honeypotExprs: [
      /website_url:\s*honeypot/,
      /company_fax:\s*honeypot2/,
    ],
  },
  {
    name: 'business-live',
    path: 'app/unternehmen/page.js',
    endpoint: 'leads',
    endpointHelper: 'leadsApiUrl',
    pageSource: 'unternehmen',
    action: 'unternehmen',
    sourcePage: '/unternehmen/',
    honeypotExprs: [
      /website_url:\s*honeypot/,
      /company_fax:\s*honeypot2/,
    ],
  },
  {
    name: 'business-preview',
    path: 'components/business/BusinessForm.jsx',
    endpoint: 'leads',
    endpointHelper: 'leadsApiUrl',
    pageSource: 'unternehmen',
    action: 'unternehmen',
    sourcePage: '/unternehmen-neu/',
    honeypotExprs: [
      /\[HONEYPOT_FIELD\]:\s*honeypot/,
      /\[HONEYPOT_FIELD_2\]:\s*honeypot2/,
    ],
  },
  {
    name: 'career-home-and-route',
    path: 'components/sections/CareerSection.jsx',
    endpoint: 'careers',
    endpointHelper: 'careersApiUrl',
    pageSource: 'career',
    action: 'career',
    sourcePage: '/karriere/',
    honeypotExprs: [
      /website_url:\s*honeypot/,
      /company_fax:\s*honeypot2/,
    ],
  },
]

for (const surface of surfaces) {
  const source = read(surface.path)
  assert.match(source, new RegExp(`page_source:\\s*['"]${surface.pageSource}['"]`), `${surface.name}: page_source drift`)
  assert.match(source, new RegExp(`resolveSubmitCaptchaToken\\(['"]${surface.action}['"]`), `${surface.name}: captcha action drift`)
  assert.match(source, new RegExp(`<RecaptchaBox[^>]*action=["']${surface.action}["']`), `${surface.name}: RecaptchaBox action drift`)
  assert.match(source, new RegExp(`postJsonLead\\(${surface.endpointHelper}\\(\\)`), `${surface.name}: endpoint helper drift`)
  assert.match(source, /_recaptchaToken:\s*captcha\.token/, `${surface.name}: fresh token missing`)
  assert.match(source, /if \(!res\.ok \|\| !json\?\.ok\)/, `${surface.name}: response success guard missing`)
  assert.match(source, /if \((sending|loading)\) return/, `${surface.name}: double-submit guard missing`)
  assert.doesNotMatch(source, /script\.google\.com|AKfycb/, `${surface.name}: legacy backend reference`)
  for (const re of surface.honeypotExprs) {
    assert.match(source, re, `${surface.name}: honeypot must be transported, not discarded`)
  }
  if (surface.name === 'hero') {
    assert.match(source, /newErrors\.type = 'Bitte wähle Strom oder Gas aus'/, 'hero: energy type must be client-validated')
    assert.match(source, /error=\{errors\.type\}/, 'hero: energy type validation must be visible')
  }
  const binding = resolveExpectedCaptchaAction({
    endpoint: surface.endpoint,
    pageSource: surface.pageSource,
  })
  assert.equal(binding.ok, true, `${surface.name}: server captcha context rejected`)
  assert.equal(binding.expectedAction, surface.action, `${surface.name}: client/server captcha action mismatch`)
}

const privateHero = {
  page_source: 'hero-funnel',
  firstName: 'Max',
  email: 'max@example.invalid',
  phone: '+4915112345678',
  provider: 'Stadtwerke',
  usage: '3500',
  zip: '69115',
  type: 'strom',
  gdpr: true,
  source_page: '/',
  form_version: '2.0',
  website_url: '',
  company_fax: '',
}
const privateFunnel = { ...privateHero, page_source: 'main_funnel', usage: '4200' }

for (const [name, payload] of [['hero', privateHero], ['main-funnel', privateFunnel]]) {
  const ok = validatePrivatePayload(payload)
  assert.equal(ok.ok, true, `${name}: representative UI payload must validate`)
  assert.equal(ok.honeypotFilled, false)
  assert.equal(validatePrivatePayload({ ...payload, gdpr: false }).code, 'privacy-required')
  assert.equal(validatePrivatePayload({ ...payload, phone: '' }).code, 'invalid-phone')
  assert.equal(validatePrivatePayload({ ...payload, provider: '' }).code, 'provider-required')
  assert.equal(validatePrivatePayload({ ...payload, usage: '' }).code, 'invalid-usage')
  assert.equal(validatePrivatePayload({ ...payload, usage: '0' }).code, 'invalid-usage')
  assert.equal(validatePrivatePayload({ ...payload, zip: '' }).code, 'invalid-plz')
  assert.equal(validatePrivatePayload({ ...payload, type: '' }).code, 'invalid-energy-type')
  assert.equal(validatePrivatePayload({ ...payload, type: 'water' }).code, 'invalid-energy-type')
  assert.equal(validatePrivatePayload({ ...payload, website_url: 'bot.example' }).honeypotFilled, true)
  assert.equal(validatePrivatePayload({ ...payload, company_fax: '123' }).honeypotFilled, true)
}

for (const sourcePage of ['/unternehmen/', '/unternehmen-neu/']) {
  const business = {
    page_source: 'unternehmen',
    firma: 'DTH Test GmbH',
    ansprechpartner: 'Max Muster',
    email: 'max@example.invalid',
    telefon: '+4915112345678',
    plz: '69115',
    energieart: 'Strom',
    verbrauchStrom: '50000',
    verbrauchGas: '',
    standorte: '2–5',
    versorger: 'Stadtwerke',
    vertragslaufzeit: 'ja',
    nachricht: 'Bitte prüfen.',
    dsgvo: true,
    source_page: sourcePage,
    form_version: '2.0',
    website_url: '',
    company_fax: '',
  }
  const ok = validateUnternehmenPayload(business)
  assert.equal(ok.ok, true, `business ${sourcePage}: representative UI payload must validate`)
  assert.equal(ok.honeypotFilled, false)
  assert.equal(validateUnternehmenPayload({ ...business, dsgvo: false }).code, 'privacy-required')
  assert.equal(validateUnternehmenPayload({ ...business, energieart: '' }).code, 'invalid-energy-type')
  assert.equal(validateUnternehmenPayload({ ...business, energieart: 'Wasser' }).code, 'invalid-energy-type')
  assert.equal(validateUnternehmenPayload({ ...business, standorte: '' }).code, 'locations-required')
  assert.equal(validateUnternehmenPayload({ ...business, plz: '' }).code, 'invalid-plz')
  assert.equal(validateUnternehmenPayload({ ...business, website_url: 'bot.example' }).honeypotFilled, true)
  assert.equal(validateUnternehmenPayload({ ...business, company_fax: '123' }).honeypotFilled, true)
}

const career = {
  page_source: 'career',
  name: 'Max Muster',
  email: 'max@example.invalid',
  phone: '+4915112345678',
  motivation: 'Ich interessiere mich für die selbstständige Zusammenarbeit.',
  gdpr: true,
  source_page: '/karriere/',
  form_version: '2.0',
  website_url: '',
  company_fax: '',
}
const careerOk = validateCareerPayload(career)
assert.equal(careerOk.ok, true, 'career: representative UI payload must validate')
assert.equal(careerOk.honeypotFilled, false)
assert.equal(validateCareerPayload({ ...career, gdpr: false }).code, 'privacy-required')
assert.equal(validateCareerPayload({ ...career, phone: '' }).code, 'invalid-phone')
assert.equal(validateCareerPayload({ ...career, motivation: '' }).code, 'motivation-required')
assert.equal(validateCareerPayload({ ...career, motivation: 'zu kurz' }).code, 'motivation-required')
assert.equal(validateCareerPayload({ ...career, website_url: 'bot.example' }).honeypotFilled, true)
assert.equal(validateCareerPayload({ ...career, company_fax: '123' }).honeypotFilled, true)
assert.equal(validateCareerPayload({ ...career, file: 'resume.pdf' }).code, 'file-upload-not-supported')

const prevOrigin = process.env.NEXT_PUBLIC_LEADS_API_ORIGIN
const prevLegacy = process.env.NEXT_PUBLIC_LEADS_API_URL
try {
  process.env.NEXT_PUBLIC_LEADS_API_ORIGIN = 'https://deintarifheld-leads-api.vercel.app'
  delete process.env.NEXT_PUBLIC_LEADS_API_URL
  assert.equal(leadsApiUrl(), 'https://deintarifheld-leads-api.vercel.app/api/leads/')
  assert.equal(careersApiUrl(), 'https://deintarifheld-leads-api.vercel.app/api/careers/')
} finally {
  if (prevOrigin === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_ORIGIN
  else process.env.NEXT_PUBLIC_LEADS_API_ORIGIN = prevOrigin
  if (prevLegacy === undefined) delete process.env.NEXT_PUBLIC_LEADS_API_URL
  else process.env.NEXT_PUBLIC_LEADS_API_URL = prevLegacy
}

console.log('PUBLIC_FORM_SURFACES=5')
console.log('FORM_ENDPOINT_MATRIX=PASS')
console.log('FORM_CAPTCHA_ACTION_MATRIX=PASS')
console.log('FORM_HONEYPOT_TRANSPORT=PASS')
console.log('FORM_VALIDATOR_UI_PARITY=PASS')
console.log('FORM_REQUIRED_FIELD_SERVER_PARITY=PASS')
console.log('FORM_DOUBLE_SUBMIT_GUARDS=PASS')
console.log('FORM_SUCCESS_RESPONSE_GUARDS=PASS')
console.log('PUBLIC_FORM_CONTRACT_MATRIX=PASS')
