#!/usr/bin/env node
/**
 * Trigger retention cron manually (automation / CI).
 * Usage:
 *   LEADS_API_BASE=https://xxx.vercel.app CRON_SECRET=... node scripts/leads-retention.mjs
 */
import 'dotenv/config'

const base = (process.env.LEADS_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('CRON_SECRET required')
  process.exit(1)
}

const res = await fetch(`${base}/api/cron/retention`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
})
const json = await res.json().catch(() => ({}))
console.log(res.status, json)
process.exit(json.ok ? 0 : 1)
