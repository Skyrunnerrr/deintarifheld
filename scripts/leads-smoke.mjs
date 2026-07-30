#!/usr/bin/env node
/**
 * Automation smoke: health + unternehmen lead submit.
 * Usage:
 *   LEADS_API_BASE=http://127.0.0.1:3000 node scripts/leads-smoke.mjs
 */
import 'dotenv/config'

const base = (process.env.LEADS_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
const email = process.env.SMOKE_EMAIL || `smoke+${Date.now()}@example.com`

async function main() {
  const health = await fetch(`${base}/api/leads`)
  const healthJson = await health.json()
  console.log('HEALTH', health.status, healthJson)
  if (!health.ok || !healthJson.ok) process.exit(1)

  const payload = {
    page_source: 'unternehmen',
    firma: 'Smoke Test GmbH',
    ansprechpartner: 'Smoke Tester',
    email,
    telefon: '0301234567',
    plz: '10115',
    energieart: 'Strom',
    standorte: '1',
    nachricht: 'Automatisierter Smoke-Test',
    dsgvo: true,
    form_version: '2.0',
    source_page: '/unternehmen-neu/',
    _formLoadedAt: Date.now() - 5000,
    website_url: '',
    company_fax: '',
  }

  const res = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'idempotency-key': `smoke-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  console.log('SUBMIT', res.status, {
    ok: json.ok,
    leadRef: json.leadRef,
    mail: json.mail,
    code: json.code,
    duplicate: json.duplicate,
  })
  if (!json.ok) process.exit(1)
  console.log('SMOKE_OK=YES')
}

main().catch((err) => {
  console.error('SMOKE_FAILED', err?.message || err)
  process.exit(1)
})
