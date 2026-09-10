#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAdminAuthorized } from '../lib/leads/admin-auth.js'
import { listOpsInbox } from '../lib/leads/supabase.js'
import { ADMIN_INBOX_HTML } from '../lib/leads/admin-inbox-html.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function fakeRequest(headers = {}) {
  return {
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || headers[name] || null
      },
    },
  }
}

function fakeClient({ leads = [], careers = [] }) {
  return {
    from(table) {
      let rows = table === 'leads' ? [...leads] : [...careers]
      const q = {
        select() {
          return q
        },
        neq(col, val) {
          rows = rows.filter((row) => row[col] !== val)
          return q
        },
        order() {
          return q
        },
        limit(n) {
          rows = rows.slice(0, n)
          return q
        },
        then(resolve) {
          resolve({ data: rows, error: null })
        },
      }
      return q
    },
  }
}

function assertAuth() {
  const prevAdmin = process.env.LEADS_ADMIN_SECRET
  const prevCron = process.env.CRON_SECRET
  delete process.env.LEADS_ADMIN_SECRET
  delete process.env.CRON_SECRET
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer x' })), false)
  process.env.CRON_SECRET = 'cron-must-not-open-admin'
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer cron-must-not-open-admin' })), false)
  process.env.LEADS_ADMIN_SECRET = 'ops-secret-test'
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer ops-secret-test' })), true)
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer wrong' })), false)
  assert.equal(isAdminAuthorized(fakeRequest({ 'x-admin-secret': 'ops-secret-test' })), true)
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer ops-secret-test?from=query' })), false)
  assert.equal(isAdminAuthorized(fakeRequest({ authorization: 'Bearer cron-must-not-open-admin' })), false)
  if (prevAdmin === undefined) delete process.env.LEADS_ADMIN_SECRET
  else process.env.LEADS_ADMIN_SECRET = prevAdmin
  if (prevCron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = prevCron
  console.log('ADMIN_AUTH=PASS')
}

async function assertList() {
  const leads = [
    {
      lead_ref: 'B2B-1',
      status: 'new',
      email: 'a@example.invalid',
      payload: { verbrauchStrom: '85000', nachricht: 'Bitte prüfen' },
    },
    {
      lead_ref: 'B2B-DEL',
      status: 'deleted',
      email: 'gone@example.invalid',
      payload: {},
    },
  ]
  const careers = [{ application_ref: 'CAR-1', status: 'new', email: 'c@example.invalid', payload: { motivation: 'hi' } }]
  const all = await listOpsInbox(fakeClient({ leads, careers }), { includeDeleted: true })
  assert.equal(all.error, null)
  assert.equal(all.leads.length, 2)
  assert.equal(all.careers.length, 1)
  const live = await listOpsInbox(fakeClient({ leads, careers }), { includeDeleted: false })
  assert.equal(live.leads.length, 1)
  assert.equal(live.leads[0].lead_ref, 'B2B-1')
  assert.equal(live.leads[0].payload.verbrauchStrom, '85000')
  console.log('ADMIN_LIST=PASS')
}

function assertHtmlAndRoutes() {
  assert.match(ADMIN_INBOX_HTML, /Anfragen-Eingang/)
  assert.match(ADMIN_INBOX_HTML, /mail-failed/)
  assert.match(ADMIN_INBOX_HTML, /Nur Mail fehlgeschlagen/)
  assert.match(ADMIN_INBOX_HTML, /\/api\/admin\/leads\//)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /LEADS_ADMIN_SECRET=/)
  assert.doesNotMatch(ADMIN_INBOX_HTML, /eyJ/)
  assert.ok(existsSync(join(root, 'app/api/admin/leads/route.js')))
  assert.ok(existsSync(join(root, 'app/api/admin/inbox/route.js')))
  const list = readFileSync(join(root, 'app/api/admin/leads/route.js'), 'utf8')
  assert.match(list, /isAdminAuthorized/)
  assert.match(list, /listOpsInbox/)
  assert.doesNotMatch(list, /withCors/)
  const inbox = readFileSync(join(root, 'app/api/admin/inbox/route.js'), 'utf8')
  assert.match(inbox, /ADMIN_INBOX_HTML/)
  const del = readFileSync(join(root, 'app/api/admin/leads/delete/route.js'), 'utf8')
  assert.match(del, /isAdminAuthorized/)
  const staticBuild = readFileSync(join(root, 'scripts/build-static-production.sh'), 'utf8')
  assert.match(staticBuild, /mv app\/api/)
  console.log('ADMIN_INBOX_ROUTES=PASS')
}

await assertAuth()
await assertList()
assertHtmlAndRoutes()
console.log('ADMIN_INBOX_TESTS=PASS')
