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
assert.ok(existsSync(join(root, 'supabase/migrations/003_leads_rate_limits.sql')))
assert.ok(existsSync(join(root, 'supabase/migrations/004_consume_rate_limit.sql')))
assert.ok(existsSync(join(root, 'supabase/migrations/005_legal_hold_and_rate_limit_invoker.sql')))
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
assert.match(route, /publicLeadsHealth/)
const publicHealth = read('lib/leads/public-health.js')
assert.match(publicHealth, /phase: 'B'/)
assert.doesNotMatch(publicHealth, /mailModeDefault/)

const careers = read('app/api/careers/route.js')
assert.match(careers, /validateCareerPayload/)
assert.match(careers, /career_applications|insertCareerApplication/)
assert.match(careers, /publicCareersHealth/)
assert.match(publicHealth, /fileUploads: false/)
assert.match(read('lib/leads/validate-career.js'), /file-upload-not-supported/)
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
assert.match(mail, /mailFieldsFromStored/)
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
assert.match(cors, /effectiveAllowedOrigins/)
assert.doesNotMatch(cors, /\*\\.vercel\\.app/)
assert.doesNotMatch(cors, /Authorization/)
const runtimeEnv = read('lib/leads/runtime-env.js')
assert.match(runtimeEnv, /deintarifheld\.de/)
assert.match(runtimeEnv, /isProductionRuntime/)

const captcha = read('lib/leads/captcha.js')
assert.match(captcha, /siteverify/)
assert.match(captcha, /RECAPTCHA_SECRET_KEY/)
assert.match(captcha, /captcha-not-configured|captchaRequired/)
const captchaAction = read('lib/leads/captcha-action.js')
assert.match(captchaAction, /standard_v2_v3_siteverify/)
assert.match(captchaAction, /resolveExpectedCaptchaAction/)
assert.doesNotMatch(read('components/ui/RecaptchaBox.jsx'), /enterprise\.js/)
const migration004 = read('supabase/migrations/004_consume_rate_limit.sql')
assert.match(migration004, /consume_rate_limit/)
assert.match(migration004, /service_role/)
assert.doesNotMatch(migration004, /^\s*drop\s+table\s+public\.leads\b/im)
const migration005 = read('supabase/migrations/005_legal_hold_and_rate_limit_invoker.sql')
assert.match(migration005, /security invoker/i)
assert.match(migration005, /legal_hold/)
assert.match(migration005, /pg_catalog,\s*public,\s*pg_temp/)
assert.doesNotMatch(migration005, /^\s*drop\s+table\s+public\.leads\b/im)

const intake = read('app/api/leads/route.js')
assert.match(intake, /enforcePublicIntake/)
assert.doesNotMatch(intake, /mailModeDefault/)
const careersGet = read('app/api/careers/route.js')
assert.match(careersGet, /enforcePublicIntake/)
assert.doesNotMatch(careersGet, /mailModeDefault/)

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
assert.match(envExample, /ALLOW_CUSTOMER_MAIL=NO/)
assert.match(envExample, /RECAPTCHA_SECRET_KEY/)
assert.doesNotMatch(envExample, /^LEADS_MAIL_MODE=live$/m)
assert.doesNotMatch(envExample, /^ALLOW_CUSTOMER_MAIL=YES$/m)
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
assert.match(form, /RecaptchaBox/)
assert.match(form, /_recaptchaToken/)
assert.doesNotMatch(form, /script\.google\.com/)
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
assert.match(deleteRoute, /enforceAdminAccess|isAdminAuthorized/)
assert.match(deleteRoute, /deletion-mode-required/)
assert.match(deleteRoute, /resolveDeletionMode/)
assert.doesNotMatch(deleteRoute, /Automated DSGVO delete/)
assert.doesNotMatch(deleteRoute, /mode = .*anonymise/)
assert.ok(existsSync(join(root, 'app/api/admin/leads/route.js')))
assert.ok(existsSync(join(root, 'app/api/admin/inbox/route.js')))
assert.ok(existsSync(join(root, 'lib/leads/admin-auth.js')))
const adminList = read('app/api/admin/leads/route.js')
assert.match(adminList, /listOpsInbox/)
assert.match(adminList, /enforceAdminAccess|isAdminAuthorized/)
assert.doesNotMatch(adminList, /withCors/)
const adminAuth = read('lib/leads/admin-auth.js')
assert.doesNotMatch(adminAuth, /process\.env\.CRON_SECRET/)
assert.match(adminAuth, /LEADS_ADMIN_SECRET/)
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
  'leads:duplicate-status',
  'leads:p0:security',
  'leads:p0:remediation',
  'leads:p0:closure',
  'leads:historic:dry-run',
  'leads:rate-limit:remote',
  'deps:audit',
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
