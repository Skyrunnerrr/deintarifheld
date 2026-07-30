#!/usr/bin/env node
/**
 * Automated DSGVO delete-by-email.
 * Usage:
 *   LEADS_API_BASE=https://xxx.vercel.app LEADS_ADMIN_SECRET=... \
 *     node scripts/leads-delete-by-email.mjs --email user@example.com
 */
import 'dotenv/config'

const base = (process.env.LEADS_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
const secret = process.env.LEADS_ADMIN_SECRET || process.env.CRON_SECRET
const emailArg = process.argv.find((a) => a.startsWith('--email='))
const email = emailArg ? emailArg.slice('--email='.length) : process.argv[process.argv.indexOf('--email') + 1]

if (!secret) {
  console.error('LEADS_ADMIN_SECRET or CRON_SECRET required')
  process.exit(1)
}
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/leads-delete-by-email.mjs --email user@example.com')
  process.exit(1)
}

const res = await fetch(`${base}/api/admin/leads/delete`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ email }),
})
const json = await res.json().catch(() => ({}))
console.log(res.status, json)
process.exit(json.ok ? 0 : 1)
