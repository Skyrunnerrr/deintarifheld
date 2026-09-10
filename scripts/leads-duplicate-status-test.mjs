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
  assert.match(supabase, /mail_status, mail_mode, mail_sent_at/)
  assert.match(supabase, /findLeadByIdempotencyKey/)
  assert.match(supabase, /findRecentDuplicate/)
  assert.match(supabase, /findCareerByIdempotencyKey/)
  assert.match(supabase, /findRecentCareerDuplicate/)
  assert.doesNotMatch(leads, /duplicate: true[\s\S]{0,180}mail: true/)
  assert.doesNotMatch(careers, /duplicate: true[\s\S]{0,180}mail: true/)
  assert.doesNotMatch(leads, /duplicate: true[\s\S]{0,220}mailStatus: 'accepted'/)
  assert.doesNotMatch(careers, /duplicate: true[\s\S]{0,220}mailStatus: 'accepted'/)
  console.log('BUSINESS_DUPLICATE_WIRING=PASS')
  console.log('PRIVATE_DUPLICATE_WIRING=PASS')
  console.log('CAREER_DUPLICATE_WIRING=PASS')
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
  assert.match(adminList, /isAdminAuthorized/)
  const cron = read('app/api/cron/retention/route.js')
  assert.match(cron, /CRON_SECRET/)
  if (prevAdmin === undefined) delete process.env.LEADS_ADMIN_SECRET
  else process.env.LEADS_ADMIN_SECRET = prevAdmin
  if (prevCron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = prevCron
  console.log('ADMIN_SECRET_ONLY=PASS')
  console.log('CRON_SECRET_ADMIN_DENIED=PASS')
}

function assertInboxFailedVisible() {
  assert.match(ADMIN_INBOX_HTML, /mail-failed/)
  assert.match(ADMIN_INBOX_HTML, /Nur Mail fehlgeschlagen/)
  assert.match(ADMIN_INBOX_HTML, /badge-failed/)
  assert.match(ADMIN_INBOX_HTML, /unknown/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /LEADS_ADMIN_SECRET=/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /\?secret=/)
  console.log('INBOX_FAILED_VISIBLE=PASS')
}

assertStoredMailMatrix()
assertChannelWiring()
assertAdminIsolation()
assertInboxFailedVisible()
console.log('DUPLICATE_STATUS_TESTS=PASS')
