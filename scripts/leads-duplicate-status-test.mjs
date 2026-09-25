#!/usr/bin/env node
/**
 * Truthful duplicate/idempotency mail status + admin secret isolation.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mailFieldsFromStored } from '../lib/leads/mail.js'
import { isAdminAuthorized } from '../lib/leads/admin-auth.js'
import { ADMIN_INBOX_HTML } from '../lib/leads/admin-inbox-html.js'
import { buildIdempotencyKey } from '../lib/leads/idempotency.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

function fakeRequest(headers = {}) {
  return {
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || headers[name] || null
      },
    },
  }
}

function assertStoredMailMatrix() {
  const failed = mailFieldsFromStored({ mail_status: 'failed', mail_mode: 'internal_live' })
  assert.equal(failed.mail, false)
  assert.equal(failed.mailStatus, 'failed')
  assert.equal(failed.mailMode, 'internal_live')

  const internal = mailFieldsFromStored({ mail_status: 'internal_sent', mail_mode: 'internal_live' })
  assert.equal(internal.mail, true)
  assert.equal(internal.mailStatus, 'internal_sent')

  const accepted = mailFieldsFromStored({ mail_status: 'accepted', mail_mode: 'mock' })
  assert.equal(accepted.mail, true)
  assert.equal(accepted.mailStatus, 'accepted')

  const legacy = mailFieldsFromStored({ mail_status: null, mail_mode: null })
  assert.equal(legacy.mail, false)
  assert.equal(legacy.mailStatus, 'unknown')
  assert.equal(legacy.mailMode, null)

  const empty = mailFieldsFromStored({})
  assert.equal(empty.mail, false)
  assert.equal(empty.mailStatus, 'unknown')

  console.log('DUPLICATE_STATUS_FAILED=PASS')
  console.log('DUPLICATE_STATUS_INTERNAL_SENT=PASS')
  console.log('DUPLICATE_STATUS_ACCEPTED=PASS')
  console.log('DUPLICATE_STATUS_LEGACY_NULL=PASS')
}

function assertChannelWiring() {
  const leads = read('app/api/leads/route.js')
  const careers = read('app/api/careers/route.js')
  const supabase = read('lib/leads/supabase.js')
  assert.match(leads, /mailFieldsFromStored/)
  assert.match(careers, /mailFieldsFromStored/)
  assert.match(leads, /mail: mailStatus === 'accepted' \|\| mailStatus === 'internal_sent'/)
  assert.match(careers, /mail: mailStatus === 'accepted' \|\| mailStatus === 'internal_sent'/)
  assert.match(supabase, /mail_status, mail_mode, mail_sent_at/)
  assert.match(supabase, /findLeadByIdempotencyKey/)
  assert.match(supabase, /findCareerByIdempotencyKey/)
  assert.doesNotMatch(supabase, /findRecentDuplicate/)
  assert.doesNotMatch(supabase, /findRecentCareerDuplicate/)
  assert.doesNotMatch(leads, /duplicate_check_failed/)
  assert.doesNotMatch(careers, /duplicate_check_failed/)
  assert.doesNotMatch(leads, /duplicate: true[\s\S]{0,180}mail: true/)
  assert.doesNotMatch(careers, /duplicate: true[\s\S]{0,180}mail: true/)
  assert.doesNotMatch(leads, /duplicate: true[\s\S]{0,220}mailStatus: 'accepted'/)
  assert.doesNotMatch(careers, /duplicate: true[\s\S]{0,220}mailStatus: 'accepted'/)
  console.log('BUSINESS_DUPLICATE_WIRING=PASS')
  console.log('PRIVATE_DUPLICATE_WIRING=PASS')
  console.log('CAREER_DUPLICATE_WIRING=PASS')
}

function assertPayloadAwareFallbackIdempotency() {
  const request = fakeRequest({})
  const now = 1_800_000
  const base = {
    page_source: 'privat',
    email: 'same@example.invalid',
    provider: 'Provider A',
    usage: '3500',
    _formLoadedAt: 123,
  }
  const first = buildIdempotencyKey(request, base, { scope: 'lead', now })
  const telemetryOnlyChange = buildIdempotencyKey(
    request,
    { ...base, _formLoadedAt: 999 },
    { scope: 'lead', now },
  )
  const edited = buildIdempotencyKey(
    request,
    { ...base, provider: 'Provider B' },
    { scope: 'lead', now },
  )
  assert.equal(first, telemetryOnlyChange)
  assert.notEqual(first, edited)

  const explicit = buildIdempotencyKey(
    fakeRequest({ 'idempotency-key': 'client-key-12345' }),
    { ...base, provider: 'Provider C' },
    { scope: 'lead', now },
  )
  assert.equal(explicit, 'client-key-12345')
  console.log('PAYLOAD_AWARE_IDEMPOTENCY=PASS')
}

function assertAdminIsolation() {
  const prevAdmin = process.env.LEADS_ADMIN_SECRET
  const prevCron = process.env.CRON_SECRET
  delete process.env.LEADS_ADMIN_SECRET
  process.env.CRON_SECRET = 'cron-only-must-fail'
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer cron-only-must-fail' })), false)
  assert.equal(isAdminAuthorized(fakeRequest({ 'x-admin-secret': 'cron-only-must-fail' })), false)
  process.env.LEADS_ADMIN_SECRET = 'ops-admin-only'
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer ops-admin-only' })), true)
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer cron-only-must-fail' })), false)
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer wrong' })), false)
  const auth = read('lib/leads/admin-auth.js')
  assert.doesNotMatch(auth, /process\.env\.CRON_SECRET/)
  const adminList = read('app/api/admin/leads/route.js')
  assert.doesNotMatch(adminList, /withCors/)
  assert.match(adminList, /enforceAdminAccess|isAdminAuthorized/)
  const cron = read('app/api/cron/retention/route.js')
  assert.match(cron, /isCronAuthorized/)
  assert.doesNotMatch(cron, /LEADS_ADMIN_SECRET/)
  if (prevAdmin === undefined) delete process.env.LEADS_ADMIN_SECRET
  else process.env.LEADS_ADMIN_SECRET = prevAdmin
  if (prevCron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = prevCron
  console.log('ADMIN_SECRET_ONLY=PASS')
  console.log('CRON_SECRET_ADMIN_DENIED=PASS')
}

function assertInboxFailedVisible() {
  assert.match(ADMIN_INBOX_HTML, /Nur Mail fehlgeschlagen/)
  const inboxJs = read('public/ops/inbox.js')
  assert.match(inboxJs, /mail-failed/)
  assert.match(inboxJs, /badge-failed/)
  assert.match(inboxJs, /unknown/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /LEADS_ADMIN_SECRET=/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /\?secret=/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /sessionStorage/)
  console.log('INBOX_FAILED_VISIBLE=PASS')
}

assertStoredMailMatrix()
assertChannelWiring()
assertPayloadAwareFallbackIdempotency()
assertAdminIsolation()
assertInboxFailedVisible()
console.log('DUPLICATE_STATUS_TESTS=PASS')
