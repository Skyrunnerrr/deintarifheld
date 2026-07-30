#!/usr/bin/env node
import { randomUUID } from 'node:crypto'

const base = (process.env.LEADS_SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const email = process.env.CONTROLLED_TEST_EMAIL || `career-smoke-${Date.now()}@example.invalid`

const payload = {
  page_source: 'career',
  name: 'Smoke Bewerber',
  email,
  phone: '015198765432',
  motivation: 'Interesse an einer flexiblen Vertriebsrolle bei DeinTarifheld.',
  gdpr: true,
  form_version: '2.0',
  source_page: '/karriere/',
  _formLoadedAt: Date.now() - 10_000,
  website_url: '',
  company_fax: '',
}

const res = await fetch(`${base}/api/careers`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `smoke-career-${randomUUID()}`,
    Origin: 'http://localhost:3000',
  },
  body: JSON.stringify(payload),
})
const json = await res.json().catch(() => ({}))
console.log(JSON.stringify({ status: res.status, ok: json.ok, leadRef: json.leadRef, mailMode: json.mailMode, code: json.code }, null, 2))
if (!res.ok || !json.ok) process.exit(1)
