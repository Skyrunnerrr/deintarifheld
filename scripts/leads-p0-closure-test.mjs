#!/usr/bin/env node
/**
 * PR #6 final closure proofs — no production writes, no real customer mail.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAPTCHA_ACTION_FUNNEL,
  CAPTCHA_ACTION_HERO,
  PAGE_SOURCE_HERO,
  isValidGoogleV3Action,
  resolveExpectedCaptchaAction,
} from '../lib/leads/captcha-action.js'
import {
  ANONYMISED_EMAIL,
  PII_REDACTION_COLUMN,
  PII_STATES,
  PII_STATE_NAMING,
  classifyPiiState,
  isAlreadyRedacted,
  isEraseEligible,
  isHistoricCleanupEligible,
  isLegalHold,
  isPhysicalEligible,
  isRetentionEligible,
} from '../lib/leads/deletion-state.js'
import {
  HISTORIC_CLEANUP_EXECUTION_READY,
  assertNoPiiInSummary,
  dryRunHistoricSoftDeletes,
} from '../lib/leads/historic-cleanup.js'
import { resolveDeletionMode } from '../lib/leads/deletion-mode.js'
import {
  evaluateStagingRateLimitTarget,
  parseSupabaseProjectRef,
} from '../lib/leads/staging-rate-limit-guard.js'
import {
  allowlistRowFieldErrors,
  indexAllowlist,
  matchAllowlistedFinding,
} from '../lib/audit/npm-allowlist.js'
import { processLeadDeletion, runRetention } from '../lib/leads/supabase.js'
import {
  planProvenExpertWithdrawal,
  simulateProvenExpertFalseTrueFalse,
  stripProvenExpertDom,
} from '../lib/consent/provenexpert-runtime.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', 'out', '.git'].includes(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full)
  }
  return out
}

function makeClient(seed) {
  const leads = [...(seed.leads || [])]
  const careers = [...(seed.careers || [])]
  const audits = []

  function matches(row, filters) {
    return filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val
      if (f.op === 'neq') return row[f.col] !== f.val
      if (f.op === 'in') return f.val.includes(row[f.col])
      if (f.op === 'is') return row[f.col] == null
      if (f.op === 'lt') return row[f.col] < f.val
      return true
    })
  }

  function tableApi(name, rows) {
    const filters = []
    const q = {
      select() { return q },
      eq(col, val) { filters.push({ op: 'eq', col, val }); return q },
      neq(col, val) { filters.push({ op: 'neq', col, val }); return q },
      in(col, val) { filters.push({ op: 'in', col, val }); return q },
      is(col, val) { filters.push({ op: 'is', col, val }); return q },
      lt(col, val) { filters.push({ op: 'lt', col, val }); return q },
      update(patch) {
        q._patch = patch
        q._mode = 'update'
        return q
      },
      delete() {
        q._mode = 'delete'
        return q
      },
      insert(row) {
        if (name === 'audit_events') audits.push(row)
        return Promise.resolve({ data: row, error: null })
      },
      then(resolve) {
        const selected = rows.filter((r) => matches(r, filters))
        if (q._mode === 'update') {
          for (const row of selected) Object.assign(row, q._patch)
        }
        if (q._mode === 'delete') {
          for (const row of selected) {
            const idx = rows.indexOf(row)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        resolve({ data: selected, error: null })
      },
    }
    return q
  }

  return {
    leads,
    careers,
    audits,
    from(table) {
      if (table === 'leads') return tableApi('leads', leads)
      if (table === 'career_applications') return tableApi('careers', careers)
      if (table === 'audit_events') return tableApi('audit_events', audits)
      throw new Error(table)
    },
  }
}

function assertRecaptchaV3Actions() {
  const hero = resolveExpectedCaptchaAction({ endpoint: 'leads', pageSource: PAGE_SOURCE_HERO })
  assert.equal(hero.expectedAction, CAPTCHA_ACTION_HERO)
  assert.equal(CAPTCHA_ACTION_HERO, 'hero_funnel')
  assert.equal(isValidGoogleV3Action('hero-funnel'), false)
  assert.equal(isValidGoogleV3Action(CAPTCHA_ACTION_FUNNEL), true)
  const heroSrc = read('components/sections/Hero.jsx')
  assert.match(heroSrc, /action="hero_funnel"/)
  assert.match(heroSrc, /_recaptchaAction:\s*'hero_funnel'/)
  assert.match(heroSrc, /page_source:\s*'hero-funnel'/)
  assert.doesNotMatch(heroSrc, /action="hero-funnel"/)
  console.log('RECAPTCHA_V3_ACTIONS=PASS')
}

function assertPublicDsgvoClaims() {
  const forbidden = [
    [/DSGVO-konform/i, 'DSGVO-konform'],
    [/Keine Weitergabe an Dritte/i, 'Keine Weitergabe an Dritte'],
    [/100%\s*DSGVO/i, '100% DSGVO'],
    [/nicht an unbeteiligte Dritte/i, 'nicht an unbeteiligte Dritte'],
    [/entsprechen der DSGVO/i, 'entsprechen der DSGVO'],
  ]
  const skip = [
    /^app\/datenschutz\//,
    /^app\/agb\//,
    /^app\/impressum\//,
  ]
  const fail = []
  for (const rootName of ['components', 'app', 'lib']) {
    for (const full of walk(join(root, rootName))) {
      const rel = relative(root, full)
      if (skip.some((re) => re.test(rel))) continue
      if (rel === 'lib/constants.js' || rel.startsWith('components/') || rel.startsWith('app/')) {
        const text = readFileSync(full, 'utf8')
        for (const [re, label] of forbidden) {
          if (re.test(text)) fail.push(`${rel}: ${label}`)
        }
      }
    }
  }
  const constants = read('lib/constants.js')
  assert.match(constants, /SSL-verschlüsselt|Datenschutzinformationen/)
  if (fail.length) {
    console.error(fail.join('\n'))
    assert.equal(fail.length, 0)
  }
  console.log('PUBLIC_DSGVO_CLAIMS=PASS')
}

function assertLegalAlignmentDocs() {
  const pub = read('docs/compliance/PUBLIC_LEGAL_ALIGNMENT.md')
  assert.match(pub, /PUBLIC_LEGAL_ALIGNMENT=FAIL/)
  assert.match(pub, /LEGAL_TEXT_CODE_MISMATCH=YES/)
  assert.match(pub, /LEGAL_REVIEW_REQUIRED=YES/)
  assert.match(pub, /reCAPTCHA/)
  assert.match(pub, /ProvenExpert/)
  assert.match(pub, /TTDSG/)
  assert.match(pub, /TDDDG/)
  const agb = read('app/agb/page.js')
  assert.match(agb, /automatische\s+Eingangsbestätigung/)
  assert.match(read('docs/deployment/PR6_DEPLOY_ORDER.md'), /AUTO_PRODUCTION_DEPLOY_ON_MAIN=UNKNOWN/)
  assert.match(read('docs/deployment/PR6_DEPLOY_ORDER.md'), /PR6_DEPLOYMENT_SAFE=NO/)
  assert.match(read('docs/compliance/HISTORIC_SOFT_DELETE_CLEANUP.md'), /HISTORIC_CLEANUP_DISCOVERY=PASS/)
  assert.match(read('docs/compliance/HISTORIC_SOFT_DELETE_CLEANUP.md'), /HISTORIC_CLEANUP_EXECUTION=NO/)
  assert.match(read('docs/compliance/HISTORIC_SOFT_DELETE_CLEANUP.md'), /HISTORIC_CLEANUP_EXECUTION_READY=NO/)
  assert.match(read('docs/compliance/HISTORIC_SOFT_DELETE_CLEANUP.md'), /HISTORIC_CLEANUP_APPLIED=NO/)
  assert.match(read('docs/compliance/RATE_LIMIT_ATOMIC_REMOTE.md'), /RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN/)
  console.log('PUBLIC_LEGAL_ALIGNMENT=FAIL')
  console.log('LEGAL_TEXT_CODE_MISMATCH=YES')
  console.log('LEGAL_REVIEW_REQUIRED=YES')
}

function assertProvenExpertWithdrawal() {
  const off = planProvenExpertWithdrawal({
    previousAllowed: false,
    nextAllowed: false,
    destroyApiAvailable: false,
    alreadyReloaded: false,
  })
  assert.equal(off.loadScript, false)
  assert.equal(off.showLocalBadge, true)

  const on = planProvenExpertWithdrawal({
    previousAllowed: false,
    nextAllowed: true,
    destroyApiAvailable: false,
    alreadyReloaded: false,
  })
  assert.equal(on.loadScript, true)
  assert.equal(on.allowFurtherRequests, true)

  const withdraw = planProvenExpertWithdrawal({
    previousAllowed: true,
    nextAllowed: false,
    alreadyReloaded: false,
  })
  assert.equal(withdraw.loadScript, false)
  assert.equal(withdraw.stripDom, true)
  assert.equal(withdraw.reload, true)
  assert.equal(withdraw.allowFurtherRequests, false)
  assert.equal(withdraw.showLocalBadge, true)

  const afterReload = planProvenExpertWithdrawal({
    previousAllowed: true,
    nextAllowed: false,
    alreadyReloaded: true,
  })
  assert.equal(afterReload.reload, false)
  assert.equal(afterReload.stripDom, true)

  const noDestroyShortcut = planProvenExpertWithdrawal({
    previousAllowed: true,
    nextAllowed: false,
    destroyApiAvailable: true,
    alreadyReloaded: false,
  })
  assert.equal(noDestroyShortcut.reload, true, 'destroy-api flag must not skip reload')
  assert.equal(noDestroyShortcut.stripDom, true)

  const nodes = []
  const fakeRoot = {
    querySelectorAll(sel) {
      if (String(sel).includes('pe-pro-seal') || String(sel).includes('provenexpert')) {
        return nodes
      }
      return []
    },
  }
  const seal = { removed: false, remove() { this.removed = true } }
  nodes.push(seal)
  stripProvenExpertDom(fakeRoot)
  assert.equal(seal.removed, true)

  const widget = read('components/ui/ProSealWidget.js')
  assert.match(widget, /planProvenExpertWithdrawal/)
  assert.match(widget, /stripProvenExpertDom/)
  assert.match(widget, /location\.reload/)

  const cycle = simulateProvenExpertFalseTrueFalse()
  assert.equal(cycle.off.consent, false)
  assert.equal(cycle.off.scriptPresent, false)
  assert.equal(cycle.off.localFallback, true)
  assert.equal(cycle.on.consent, true)
  assert.equal(cycle.on.scriptPresent, true)
  assert.equal(cycle.on.sealPresent, true)
  assert.equal(cycle.on.localFallback, false)
  assert.equal(cycle.withdrawn.consent, false)
  assert.equal(cycle.withdrawn.scriptPresent, false)
  assert.equal(cycle.withdrawn.sealPresent, false)
  assert.equal(cycle.withdrawn.localFallback, true)
  assert.equal(cycle.withdrawn.reload, true)
  console.log('PROVENEXPERT_INITIAL_CONSENT=PASS')
  console.log('PROVENEXPERT_WITHDRAWAL=PASS')
}

async function assertDeleteStateMachine() {
  assert.equal(PII_REDACTION_COLUMN, 'anonymized_at')
  assert.equal(PII_STATE_NAMING, 'legacy_anonymized_at_means_redacted_not_anonymous')
  assert.equal(classifyPiiState({ status: 'new', legal_hold: false }), PII_STATES.ACTIVE)
  assert.equal(classifyPiiState({ status: 'deleted', anonymized_at: null, legal_hold: false }), PII_STATES.SOFT_DELETED)
  assert.equal(classifyPiiState({ status: 'deleted', legal_hold: true }), PII_STATES.LEGAL_HOLD)
  assert.equal(classifyPiiState({ status: 'deleted', anonymized_at: '2026-01-01', legal_hold: false }), PII_STATES.REDACTED)
  assert.equal(classifyPiiState(null), PII_STATES.PHYSICALLY_DELETED)
  assert.equal(isHistoricCleanupEligible({ status: 'deleted', anonymized_at: null, legal_hold: false }), true)
  assert.equal(isHistoricCleanupEligible({ status: 'deleted', anonymized_at: null, legal_hold: true }), false)
  assert.equal(isLegalHold({ legal_hold: true }), true)
  assert.equal(isLegalHold({ legal_hold: false, status: 'deleted' }), false)
  assert.equal(isAlreadyRedacted({ anonymized_at: '2026-01-01T00:00:00.000Z' }), true)
  assert.equal(isEraseEligible({ status: 'deleted', anonymized_at: null, legal_hold: false }), true)
  assert.equal(isEraseEligible({ status: 'deleted', anonymized_at: '2026-01-01', legal_hold: false }), false)
  assert.equal(isEraseEligible({ status: 'new', legal_hold: true }), false)
  assert.equal(isPhysicalEligible({ status: 'deleted', anonymized_at: 'x', legal_hold: false }), true)
  assert.equal(isPhysicalEligible({ legal_hold: true }), false)
  assert.equal(isRetentionEligible({ status: 'deleted', anonymized_at: null, legal_hold: true }), false)

  const old = new Date(Date.now() - 200 * 86400000).toISOString()

  const active = makeClient({
    leads: [{
      id: 'a1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'new',
      firma: 'Acme GmbH',
      anonymized_at: null,
      legal_hold: false,
      payload: { email: 'person@example.invalid', nachricht: 'secret', firma: 'Acme GmbH' },
    }],
    careers: [],
  })
  const missing = await processLeadDeletion(active, 'person@example.invalid', { channel: 'business' })
  assert.equal(missing.code, 'deletion-mode-required')
  const alias = resolveDeletionMode('anonymise')
  assert.equal(alias.ok, true)
  assert.equal(alias.mode, 'redact')
  assert.equal(alias.legacyAlias, true)
  assert.equal(resolveDeletionMode('').code, 'deletion-mode-required')
  const r1 = await processLeadDeletion(active, 'person@example.invalid', { channel: 'business', mode: 'redact' })
  assert.equal(r1.updated, 1)
  assert.equal(active.leads[0].email, ANONYMISED_EMAIL)
  assert.equal(active.leads[0].payload.nachricht, undefined)
  assert.equal(active.leads[0].firma, 'Acme GmbH')
  assert.ok(active.leads[0].anonymized_at)

  const physicalActive = makeClient({
    leads: [{
      id: 'p1',
      email: 'person@example.invalid',
      page_source: 'hero-funnel',
      status: 'new',
      anonymized_at: null,
      legal_hold: false,
      payload: { email: 'person@example.invalid' },
    }],
  })
  const r2 = await processLeadDeletion(physicalActive, 'person@example.invalid', { channel: 'private', mode: 'physical' })
  assert.equal(r2.updated, 1)
  assert.equal(physicalActive.leads.length, 0)

  const softActive = makeClient({
    leads: [{
      id: 's1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'new',
      firma: 'Keep',
      anonymized_at: null,
      legal_hold: false,
      payload: { nachricht: 'still here', email: 'person@example.invalid' },
    }],
  })
  const r3 = await processLeadDeletion(softActive, 'person@example.invalid', { channel: 'business', mode: 'soft' })
  assert.equal(r3.updated, 1)
  assert.equal(softActive.leads[0].status, 'deleted')
  assert.equal(softActive.leads[0].payload.nachricht, 'still here')
  assert.equal(softActive.leads[0].legal_hold, false)

  const softThenRedact = makeClient({
    leads: [{
      id: 'sr1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'deleted',
      firma: 'HoldCo',
      anonymized_at: null,
      legal_hold: false,
      payload: { nachricht: 'pii', email: 'person@example.invalid', firma: 'HoldCo' },
    }],
  })
  const r4 = await processLeadDeletion(softThenRedact, 'person@example.invalid', { channel: 'business', mode: 'anonymise' })
  assert.equal(r4.mode, 'redact')
  assert.equal(r4.updated, 1)
  assert.equal(softThenRedact.leads[0].payload.nachricht, undefined)
  assert.equal(softThenRedact.leads[0].firma, 'HoldCo')

  const softThenPhysical = makeClient({
    leads: [{
      id: 'sp1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'deleted',
      anonymized_at: null,
      legal_hold: false,
      payload: { nachricht: 'pii' },
    }],
  })
  const r5 = await processLeadDeletion(softThenPhysical, 'person@example.invalid', { channel: 'business', mode: 'physical' })
  assert.equal(r5.updated, 1)
  assert.equal(softThenPhysical.leads.length, 0)

  const already = makeClient({
    leads: [{
      id: 'ar1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'deleted',
      firma: 'ShouldStay',
      anonymized_at: '2026-01-01T00:00:00.000Z',
      legal_hold: false,
      payload: { type: 'strom' },
    }],
  })
  const before = JSON.stringify(already.leads[0].payload)
  const r6 = await processLeadDeletion(already, 'person@example.invalid', { channel: 'business', mode: 'redact' })
  assert.equal(r6.updated, 0)
  assert.equal(JSON.stringify(already.leads[0].payload), before)
  assert.equal(already.leads[0].firma, 'ShouldStay')

  const hold = makeClient({
    leads: [{
      id: 'h1',
      email: 'person@example.invalid',
      page_source: 'unternehmen',
      status: 'deleted',
      anonymized_at: null,
      legal_hold: true,
      payload: { nachricht: 'held' },
    }],
  })
  const r7 = await processLeadDeletion(hold, 'person@example.invalid', { channel: 'business', mode: 'redact' })
  assert.equal(r7.updated, 0)
  assert.equal(hold.leads[0].payload.nachricht, 'held')

  const retentionClient = makeClient({
    leads: [
      {
        id: 'ret-soft',
        email: 'old@example.invalid',
        page_source: 'unternehmen',
        status: 'deleted',
        firma: 'OldCo',
        anonymized_at: null,
        legal_hold: false,
        created_at: old,
        payload: { nachricht: 'old pii', email: 'old@example.invalid', firma: 'OldCo' },
      },
      {
        id: 'ret-hold',
        email: 'hold@example.invalid',
        page_source: 'unternehmen',
        status: 'new',
        anonymized_at: null,
        legal_hold: true,
        created_at: old,
        payload: { nachricht: 'must stay' },
      },
    ],
    careers: [{
      id: 'ret-car',
      email: 'car@example.invalid',
      status: 'deleted',
      full_name: 'Ada',
      anonymized_at: null,
      legal_hold: false,
      created_at: old,
      payload: { motivation: 'x', email: 'car@example.invalid' },
    }],
  })
  const ret = await runRetention(retentionClient, { retentionDays: 90, privateRetentionDays: 90, careerRetentionDays: 183 })
  assert.equal(ret.error, null)
  assert.equal(ret.business, 1)
  assert.equal(retentionClient.leads.find((r) => r.id === 'ret-soft').payload.nachricht, undefined)
  assert.equal(retentionClient.leads.find((r) => r.id === 'ret-hold').payload.nachricht, 'must stay')
  assert.equal(retentionClient.careers[0].full_name, null)

  const sql = read('lib/leads/supabase.js')
  assert.doesNotMatch(sql, /loadLeadsForDeletion[\s\S]{0,400}neq\('status',\s*'deleted'\)/)
  assert.doesNotMatch(sql, /legal hold by email/)
  assert.match(read('docs/compliance/DELETION_RETENTION_MODES.md'), /legal anonymisation/)
  assert.match(read('docs/compliance/DELETION_RETENTION_MODES.md'), /PII_STATE_NAMING=PASS/)
  assert.match(read('docs/compliance/DELETION_RETENTION_MODES.md'), /technical legacy name/)

  const historicClient = makeClient({
    leads: [
      {
        id: 'hist-1',
        lead_ref: 'B2B-SAFE-1',
        email: 'old@example.invalid',
        status: 'deleted',
        anonymized_at: null,
        legal_hold: false,
        payload: { nachricht: 'secret-should-not-appear' },
      },
      {
        id: 'hist-hold',
        lead_ref: 'B2B-HOLD-1',
        email: 'hold@example.invalid',
        status: 'deleted',
        anonymized_at: null,
        legal_hold: true,
      },
    ],
    careers: [{
      id: 'hist-car',
      application_ref: 'CAR-SAFE-1',
      email: 'car@example.invalid',
      status: 'deleted',
      anonymized_at: null,
      legal_hold: false,
    }],
  })
  const dry = await dryRunHistoricSoftDeletes(historicClient)
  assert.equal(dry.ok, true)
  assert.equal(dry.leads.count, 1)
  assert.deepEqual(dry.leads.refs, ['B2B-SAFE-1'])
  assert.equal(dry.careers.count, 1)
  assert.ok(assertNoPiiInSummary(dry.leads))
  assert.ok(assertNoPiiInSummary(dry.careers))
  assert.equal(HISTORIC_CLEANUP_EXECUTION_READY, false)
  assert.equal(dry.executionReady, false)
  const historicScript = read('scripts/historic-soft-delete-dry-run.mjs')
  assert.match(historicScript, /INVENTORY ONLY/)
  assert.doesNotMatch(historicScript, /APPLY_HISTORIC_CLEANUP/)
  assert.doesNotMatch(historicScript, /EXPLICITLY_AUTHORIZED_CLEANUP/)
  assert.match(read('scripts/rate-limit-atomic-remote.mjs'), /EXPECTED_STAGING_SUPABASE_PROJECT_REF/)
  const deleteRoute = read('app/api/admin/leads/delete/route.js')
  assert.doesNotMatch(deleteRoute, /Automated DSGVO/)
  assert.doesNotMatch(deleteRoute, /legal anonymisation/)
  assert.match(deleteRoute, /deletion-mode-required/)
  assert.match(read('docs/compliance/DELETION_RETENTION_MODES.md'), /Not legal anonymisation/)
  console.log('DELETE_STATE_MACHINE=PASS')
  console.log('DELETION_MODE_EXPLICIT=PASS')
  console.log('DSGVO_DELETE_SEMANTICS=PASS')
  console.log('LEGAL_HOLD_SEPARATION=PASS')
  console.log('HISTORIC_CLEANUP_DISCOVERY=PASS')
  console.log('HISTORIC_CLEANUP_EXECUTION=NO')
  console.log('HISTORIC_CLEANUP_APPLIED=NO')
  console.log('PII_STATE_NAMING=PASS')
}

function assertAiRegister() {
  const guard = read('docs/compliance/AI_ACT_GUARDRAILS.md')
  assert.match(guard, /INTERNAL_AI_USE=YES/)
  assert.match(guard, /CUSTOMER_FACING_AI=NO/)
  assert.match(guard, /CAREER_AI_SELECTION_ALLOWED=NO/)
  assert.match(guard, /ARTICLE50_FUTURE_AI_GATE=PASS/)
  const lit = read('docs/compliance/AI_LITERACY_REGISTER.md')
  assert.match(lit, /ARTICLE4_AI_LITERACY_REGISTER=PARTIAL/)
  assert.match(lit, /TRAINING=UNKNOWN/)
  assert.match(lit, /Cursor Cloud Agent/)
  assert.match(lit, /INTERNAL_AI_USE/)
  assert.match(lit, /Internal AI Operator \/ Human PR Reviewer/)
  assert.doesNotMatch(lit, /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  console.log('AI_ACT_GUARDRAILS=PASS')
  console.log('INTERNAL_AI_USE_REGISTER=PASS')
  console.log('ARTICLE4_AI_LITERACY_REGISTER=PARTIAL')
  console.log('CAREER_AI_SELECTION_ALLOWED=NO')
  console.log('ARTICLE50_FUTURE_AI_GATE=PASS')
}

function assertNpmRegister() {
  assert.ok(existsSync(join(root, 'docs/audit/NPM_ADVISORY_ALLOWLIST.json')))
  const allow = JSON.parse(read('docs/audit/NPM_ADVISORY_ALLOWLIST.json'))
  const { map, errors } = indexAllowlist(allow.advisories || [])
  assert.equal(errors.length, 0)
  assert.ok(map.size > 0)
  const sample = allow.advisories[0]
  assert.equal(allowlistRowFieldErrors({ ...sample, url: '' }).includes('url'), true)
  const pkgMismatch = matchAllowlistedFinding(
    { id: sample.id, package: 'other-package', severity: sample.severity },
    map,
  )
  assert.equal(pkgMismatch, null)
  const sevMismatch = matchAllowlistedFinding(
    { id: sample.id, package: sample.package, severity: 'critical' },
    map,
  )
  assert.equal(sevMismatch, null)
  const ok = matchAllowlistedFinding(
    { id: sample.id, package: sample.package, severity: sample.severity },
    map,
  )
  assert.ok(ok)
  const ci = read('scripts/npm-audit-ci.mjs')
  assert.match(ci, /id AND package AND severity/)
  assert.match(ci, /process\.exit\(1\)/)
  console.log('NPM_ADVISORY_REGISTER=PASS')
  console.log('NPM_ALLOWLIST_ID_MATCH=PASS')
  console.log('NPM_ALLOWLIST_PACKAGE_MATCH=PASS')
  console.log('NPM_ALLOWLIST_SEVERITY_MATCH=PASS')
}

function assertStagingRateLimitGuard() {
  assert.equal(parseSupabaseProjectRef('https://abcd1234.supabase.co'), 'abcd1234')
  const unknown = evaluateStagingRateLimitTarget({ allowTest: false })
  assert.equal(unknown.status, 'UNKNOWN')
  const missing = evaluateStagingRateLimitTarget({
    allowTest: true,
    expectedRef: '',
    supabaseUrl: 'https://abcd1234.supabase.co',
  })
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, 'missing_expected_ref')
  const mismatch = evaluateStagingRateLimitTarget({
    allowTest: true,
    expectedRef: 'staging-ref',
    supabaseUrl: 'https://other-ref.supabase.co',
  })
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.reason, 'project_ref_mismatch')
  const prodRt = evaluateStagingRateLimitTarget({
    allowTest: true,
    expectedRef: 'staging-ref',
    supabaseUrl: 'https://staging-ref.supabase.co',
    productionRuntime: true,
  })
  assert.equal(prodRt.ok, false)
  const prodProj = evaluateStagingRateLimitTarget({
    allowTest: true,
    expectedRef: 'prod-ref',
    supabaseUrl: 'https://prod-ref.supabase.co',
    productionProjectRef: 'prod-ref',
  })
  assert.equal(prodProj.ok, false)
  assert.equal(prodProj.reason, 'production_project')
  const ok = evaluateStagingRateLimitTarget({
    allowTest: true,
    expectedRef: 'staging-ref',
    supabaseUrl: 'https://staging-ref.supabase.co',
  })
  assert.equal(ok.ok, true)
  console.log('STAGING_RATE_LIMIT_TARGET_GUARD=PASS')
  console.log('RATE_LIMIT_ATOMIC_REMOTE_DB=UNKNOWN')
}

function assertPublicRepoPii() {
  const lit = read('docs/compliance/AI_LITERACY_REGISTER.md')
  assert.doesNotMatch(lit, /wunderland50@gmail\.com/)
  assert.doesNotMatch(lit, /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  console.log('PUBLIC_REPO_PII_MINIMISATION=PASS')
}

async function main() {
  assertRecaptchaV3Actions()
  assertPublicDsgvoClaims()
  assertLegalAlignmentDocs()
  assertProvenExpertWithdrawal()
  await assertDeleteStateMachine()
  assertAiRegister()
  assertNpmRegister()
  assertStagingRateLimitGuard()
  assertPublicRepoPii()
  console.log('P0_CLOSURE_TESTS=PASS')
  console.log('REAL_CUSTOMER_MAIL_SENT=NO')
  console.log('PRODUCTION_DATA_MUTATED=NO')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
