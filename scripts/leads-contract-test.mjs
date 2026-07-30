#!/usr/bin/env node
/**
 * Offline contract checks (file/static) — no Next alias, no network, no secrets.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

assert.ok(existsSync(join(root, 'supabase/migrations/001_leads_phase_a.sql')))
assert.ok(existsSync(join(root, 'app/api/leads/route.js')))
assert.ok(existsSync(join(root, 'lib/leads/mail.js')))
assert.ok(existsSync(join(root, 'lib/leads/cors.js')))

const route = read('app/api/leads/route.js')
assert.match(route, /export async function OPTIONS/)
assert.match(route, /withCors/)
assert.match(route, /idempotent/)
assert.match(route, /findLeadByIdempotencyKey/)
assert.match(route, /202/)

const mail = read('lib/leads/mail.js')
assert.match(mail, /LEADS_MAIL_MODE/)
assert.match(mail, /mode === 'mock'/)
assert.match(mail, /mode === 'fail'/)
assert.match(mail, /sandbox_accepted/)

const cors = read('lib/leads/cors.js')
assert.match(cors, /Access-Control-Allow-Origin/)
assert.match(cors, /deintarifheld\.de/)
assert.doesNotMatch(cors, /\*\\.vercel\\.app/)

const abuse = read('lib/leads/abuse-guard.js')
assert.doesNotMatch(abuse, /vercel\\\.app/)

const migration = read('supabase/migrations/001_leads_phase_a.sql')
assert.match(migration, /create table if not exists public\.leads/)
assert.match(migration, /idempotency_key text unique/)
assert.match(migration, /audit_events/)
assert.match(migration, /enable row level security/)

const vercel = JSON.parse(read('vercel.json'))
assert.equal(vercel.crons[0].path, '/api/cron/retention')
assert.equal(vercel.crons[0].schedule, '0 3 * * *')

const envExample = read('.env.example')
assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY/)
assert.match(envExample, /LEADS_MAIL_MODE/)
assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9]/)

const form = read('components/business/BusinessForm.jsx')
assert.match(form, /leadsApiUrl|NEXT_PUBLIC_LEADS_API_URL|\/api\/leads/)
assert.doesNotMatch(form, /script\.google\.com/)
assert.doesNotMatch(form, /RecaptchaBox/)

const pkg = JSON.parse(read('package.json'))
for (const s of [
  'infra:phase-a:preflight',
  'infra:phase-a:plan',
  'infra:phase-a:apply',
  'infra:phase-a:status',
  'infra:phase-a:smoke',
  'leads:contract',
]) {
  assert.ok(pkg.scripts[s], `missing script ${s}`)
}

assert.ok(existsSync(join(root, '.github/workflows/dth-phase-a-ci.yml')))
assert.ok(existsSync(join(root, 'scripts/infra/phase-a/run-all.sh')))

console.log('CONTRACT_TESTS=PASS')
console.log('MAIL_FAILURE_PATH_TESTABLE=YES')
console.log('CORS_OPTIONS_PRESENT=YES')
console.log('IDEMPOTENCY_LOOKUP_PRESENT=YES')
console.log('APPS_SCRIPT_DECOUPLED_IN_BUSINESS_FORM=YES')
