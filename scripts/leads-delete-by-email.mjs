#!/usr/bin/env node
/**
 * Admin erase-by-email. Mode is required. Not a legal DSGVO decision.
 * Usage:
 *   LEADS_API_BASE=https://xxx.vercel.app LEADS_ADMIN_SECRET=... \
 *     node scripts/leads-delete-by-email.mjs --email user@example.com --mode=redact
 */
import 'dotenv/config'
import { evaluateAdminEraseInput } from '../lib/leads/admin-erase.js'

const base = (process.env.LEADS_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
const secret = process.env.LEADS_ADMIN_SECRET
const emailArg = process.argv.find((a) => a.startsWith('--email='))
const email = emailArg ? emailArg.slice('--email='.length) : process.argv[process.argv.indexOf('--email') + 1]
const channelArg = process.argv.find((a) => a.startsWith('--channel='))
const channel = channelArg ? channelArg.slice('--channel='.length) : 'all'
const modeArg = process.argv.find((a) => a.startsWith('--mode='))
const mode = modeArg ? modeArg.slice('--mode='.length) : ''

if (!secret) {
  console.error('LEADS_ADMIN_SECRET required')
  process.exit(1)
}

const input = evaluateAdminEraseInput({ email, mode, channel })
if (!input.ok) {
  console.error(input.status, { ok: false, code: input.code })
  if (input.code === 'redacted-placeholder-not-allowed') {
    console.error('REDACTED_EMAIL is a shared placeholder. Physical erasure of redacted rows requires a separately authorized unique ref.')
  } else if (input.code === 'deletion-mode-required' || input.code === 'invalid-email' || input.code === 'invalid-deletion-mode') {
    console.error('Usage: node scripts/leads-delete-by-email.mjs --email user@example.com --mode=soft|redact|physical [--channel=all|business|private|career]')
  }
  process.exit(1)
}

const res = await fetch(`${base}/api/admin/leads/delete`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ email: input.email, channel: input.channel, mode: input.mode }),
})
const json = await res.json().catch(() => ({}))
console.log(res.status, json)
process.exit(json.ok ? 0 : 1)
