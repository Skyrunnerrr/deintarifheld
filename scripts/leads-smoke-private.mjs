#!/usr/bin/env node
/**
 * Private lead smoke against a running API (local or preview).
 * LEADS_SMOKE_BASE_URL default http://127.0.0.1:3000
 */
import { randomUUID } from 'node:crypto'

const base = (process.env.LEADS_SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const email = process.env.CONTROLLED_TEST_EMAIL || `private-smoke-${Date.now()}@example.invalid`

const payload = {
  page_source: 'hero-funnel',
  lead_type: 'private_energy',
  firstName: 'Smoke',
  email,
  phone: '015112345678',
  provider: 'TestVersorger',
  usage: '2500',
  zip: '10115',
  type: 'strom',
  gdpr: true,
  form_version: '2.0',
  source_page: '/',
  _formLoadedAt: Date.now() - 10_000,
  website_url: '',
  company_fax: '',
}

const res = await fetch(`${base}/api/leads`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `smoke-private-${randomUUID()}`,
    Origin: 'http://localhost:3000',
  },
  body: JSON.stringify(payload),
})
const json = await res.json().catch(() => ({}))
console.log(JSON.stringify({ status: res.status, ok: json.ok, leadRef: json.leadRef, mailMode: json.mailMode, code: json.code }, null, 2))
if (!res.ok || !json.ok) process.exit(1)
