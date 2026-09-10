#!/usr/bin/env node
/**
 * Offline contract checks (file/static) — no Next alias, no network, no secrets.
 * Phase A + Phase B.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

assert.ok(existsSync(join(root, 'supabase/migrations/001_leads_phase_a.sql')))
assert.ok(existsSync(join(root, 'supabase/migrations/002_leads_phase_b.sql')))
assert.ok(existsSync(join(root, 'app/api/leads/route.js')))
assert.ok(existsSync(join(root, 'app/api/careers/route.js')))
assert.ok(existsSync(join(root, 'lib/leads/mail.js')))
assert.ok(existsSync(join(root, 'lib/leads/cors.js')))
assert.ok(existsSync(join(root, 'lib/leads/validate-private.js')))
assert.ok(existsSync(join(root, 'lib/leads/validate-career.js')))

const route = read('app/api/leads/route.js')
assert.match(route, /export async function OPTIONS/)
assert.match(route, /withCors/)
assert.match(route, /idempotent/)
assert.match(route, /findLeadByIdempotencyKey/)
assert.match(route, /202/)
assert.match(route, /mailMode/)
assert.match(route, /mailStatus/)
assert.match(route, /private_energy|validatePrivatePayload/)
assert.match(route, /phase: 'B'/)

const careers = read('app/api/careers/route.js')
assert.match(careers, /validateCareerPayload/)
assert.match(careers, /career_applications|insertCareerApplication/)
assert.match(careers, /file-upload-not-supported|fileUploads: false/)
assert.match(careers, /mailMode/)

const mail = read('lib/leads/mail.js')
assert.match(mail, /LEADS_MAIL_MODE/)
assert.match(mail, /mode === 'mock'/)
assert.match(mail, /mode === 'fail'/)
assert.match(mail, /mode === 'internal_live'/)
assert.match(mail, /sandbox_accepted/)
assert.match(mail, /LEADS_MAIL_MODE \|\| 'mock'/)
assert.match(mail, /mode !== 'live'|mail-mode-unsupported/)
assert.match(mail, /buildPrivateMails/)
assert.match(mail, /buildCareerMails/)
assert.match(mail, /buildInternalOpsMail/)
assert.match(mail, /parseLeadToAddresses/)
assert.match(mail, /Verbrauch Strom/)
assert.match(mail, /Neue Unternehmensanfrage/)
assert.match(mail, /customerConfirmation: 'skipped'/)
assert.match(mail, /mailStatus: 'internal_sent'/)
assert.match(mail, /MAIL_TEMPLATE_IDS/)
assert.match(route, /lead\.internal_mail_sent|customer_confirmation_skipped/)
assert.match(careers, /career\.internal_mail_sent|customer_confirmation_skipped/)

const cors = read('lib/leads/cors.js')
assert.match(cors, /Access-Control-Allow-Origin/)
assert.match(cors, /deintarifheld\.de/)
assert.doesNotMatch(cors, /\*\\.vercel\\.app/)

const abuse = read('lib/leads/abuse-guard.js')
assert.doesNotMatch(abuse, /vercel\\\.app/)

const migration001 = read('supabase/migrations/001_leads_phase_a.sql')
assert.match(migration001, /create table if not exists public\.leads/)
assert.match(migration001, /idempotency_key text unique/)
assert.match(migration001, /audit_events/)
assert.match(migration001, /enable row level security/)

const migration002 = read('supabase/migrations/002_leads_phase_b.sql')
assert.match(migration002, /lead_type/)
assert.match(migration002, /career_applications/)
assert.match(migration002, /mail_status/)
assert.match(migration002, /grant select, insert, update, delete on table public\.leads to service_role/i)
assert.match(migration002, /grant select, insert, update, delete on table public\.career_applications to service_role/i)
assert.doesNotMatch(migration002, /^\s*drop\s+table\s+public\.leads\b/im)
assert.doesNotMatch(migration002, /^\s*truncate\b/im)
assert.match(migration002, /Rollback notes/i)

const vercel = JSON.parse(read('vercel.json'))
assert.equal(vercel.crons[0].path, '/api/cron/retention')
assert.equal(vercel.crons[0].schedule, '0 3 * * *')

const envExample = read('.env.example')
assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY/)
assert.match(envExample, /LEADS_MAIL_MODE=mock/)
assert.match(envExample, /internal_live/)
assert.doesNotMatch(envExample, /^LEADS_MAIL_MODE=live$/m)
assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]+/)

const browserApi = read('lib/leads/browser-api.js')
assert.match(browserApi, /NEXT_PUBLIC_LEADS_API_ORIGIN/)
assert.match(browserApi, /\/api\/leads\//)
assert.match(browserApi, /\/api\/careers\//)
assert.match(browserApi, /Idempotency-Key/)
assert.match(browserApi, /ensureTrailingSlash|joinOriginPath/)

const form = read('components/business/BusinessForm.jsx')
assert.match(form, /from '@\/lib\/leads\/browser-api'/)
assert.match(form, /leadsApiUrl|postJsonLead/)
assert.doesNotMatch(form, /script\.google\.com/)
assert.doesNotMatch(form, /RecaptchaBox/)
assert.doesNotMatch(form, /function leadsApiUrl/)

const hero = read('components/sections/Hero.jsx')
assert.match(hero, /leadsApiUrl|postJsonLead/)
assert.doesNotMatch(hero, /script\.google\.com/)

const funnel = read('components/sections/FunnelSection.jsx')
assert.match(funnel, /leadsApiUrl|postJsonLead/)
assert.doesNotMatch(funnel, /script\.google\.com/)

const career = read('components/sections/CareerSection.jsx')
assert.match(career, /careersApiUrl|postJsonLead/)
assert.doesNotMatch(career, /script\.google\.com/)

const legacyBiz = read('app/unternehmen/page.js')
assert.match(legacyBiz, /leadsApiUrl|postJsonLead/)
assert.doesNotMatch(legacyBiz, /script\.google\.com/)

const staticCareer = read('public/karriere.html')
assert.doesNotMatch(staticCareer, /script\.google\.com\/macros/)
assert.match(staticCareer, /\/karriere\//)

const apply = read('scripts/infra/phase-a/apply.sh')
assert.doesNotMatch(apply, /checkdomain_api_v1/)
assert.match(apply, /checkdomain_active.:false|dns_automation.:.skipped/)

const deleteRoute = read('app/api/admin/leads/delete/route.js')
assert.match(deleteRoute, /channel/)
assert.match(deleteRoute, /careerUpdated/)
assert.match(deleteRoute, /isAdminAuthorized/)
assert.ok(existsSync(join(root, 'app/api/admin/leads/route.js')))
assert.ok(existsSync(join(root, 'app/api/admin/inbox/route.js')))
assert.ok(existsSync(join(root, 'lib/leads/admin-auth.js')))
const adminList = read('app/api/admin/leads/route.js')
assert.match(adminList, /listOpsInbox/)
assert.match(adminList, /isAdminAuthorized/)
assert.doesNotMatch(adminList, /withCors/)
const staticBuild = read('scripts/build-static-production.sh')
assert.match(staticBuild, /mv app\/api/)

const pkg = JSON.parse(read('package.json'))
for (const s of [
  'infra:phase-a:preflight',
  'infra:phase-a:plan',
  'infra:phase-a:apply',
  'infra:phase-a:status',
  'infra:phase-a:smoke',
  'leads:contract',
  'leads:mail:internal-live',
  'leads:smoke:business',
  'leads:smoke:private',
  'leads:smoke:career',
  'leads:admin:inbox',
  'phase-b:verify',
]) {
  assert.ok(pkg.scripts[s], `missing script ${s}`)
}

assert.ok(existsSync(join(root, '.github/workflows/dth-phase-a-ci.yml')))
assert.ok(existsSync(join(root, 'scripts/infra/phase-a/run-all.sh')))
assert.ok(existsSync(join(root, 'docs/legal/DATENSCHUTZ_PHASE_B_DRAFT.md')))
assert.ok(existsSync(join(root, 'docs/legal/DATENSCHUTZ_CUTOVER_CANDIDATE.md')))
assert.ok(existsSync(join(root, 'docs/legal/DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md')))
assert.ok(existsSync(join(root, 'docs/legal/DTH_09C_APPROVAL_PACK.md')))
const privacyCutover = read('docs/legal/DATENSCHUTZ_CUTOVER_CANDIDATE.md')
assert.match(privacyCutover, /STATUS=LEGAL_APPROVAL_REQUIRED/)
assert.match(privacyCutover, /LIVE_PUBLISH_AUTHORIZED=NO/)
const privacyFinal = read('docs/legal/DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md')
assert.match(privacyFinal, /STATUS=NOAH_AND_LEGAL_APPROVAL_REQUIRED/)
assert.match(privacyFinal, /LIVE_PUBLISH_AUTHORIZED=NO/)
assert.match(privacyFinal, /TECHNICAL_STATE=INTERNAL_LIVE_NOTIFICATION/)
assert.match(privacyFinal, /CUSTOMER_CONFIRMATION=OFF/)
assert.match(privacyFinal, /RESEND_DOMAIN_VERIFIED=NO/)
const gate = read('scripts/deploy/checkdomain/common.sh')
assert.match(gate, /internal_live/)
assert.match(gate, /INTERNAL_NOTIFICATION=LIVE/)
assert.match(gate, /TEMPORARY_MODE=YES/)

assert.ok(existsSync(join(root, 'scripts/build-static-production.sh')))
assert.ok(existsSync(join(root, 'scripts/deploy/checkdomain/dth-checkdomain.sh')))
assert.ok(existsSync(join(root, 'app/rechner/page.js')))

const pkgScripts = [
  'build:static:production',
  'verify:static:production',
  'cutover:plan',
  'browser-api:test',
]
for (const s of pkgScripts) {
  assert.ok(pkg.scripts[s], `missing script ${s}`)
}

console.log('CONTRACT_TESTS=PASS')
console.log('PHASE_B_CONTRACT=PASS')
console.log('MAIL_FAILURE_PATH_TESTABLE=YES')
console.log('CORS_OPTIONS_PRESENT=YES')
console.log('IDEMPOTENCY_LOOKUP_PRESENT=YES')
console.log('APPS_SCRIPT_DECOUPLED_IN_BUSINESS_FORM=YES')
console.log('PRIVATE_AND_CAREER_DECOUPLED=YES')
console.log('ENV_EXAMPLE_DEFAULT_MAIL_MODE=mock')
console.log('CHECKDOMAIN_ACTIVE_STATUS=NO')
