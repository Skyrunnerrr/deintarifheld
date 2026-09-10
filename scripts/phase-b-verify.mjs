#!/usr/bin/env node
/**
 * Offline Phase B verification aggregator (no network, no secrets).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(script) {
  const r = spawnSync('npm', ['run', script], { cwd: root, encoding: 'utf8' })
  process.stdout.write(r.stdout || '')
  process.stderr.write(r.stderr || '')
  if (r.status !== 0) {
    console.error(`VERIFY_FAIL script=${script}`)
    process.exit(r.status || 1)
  }
}

run('leads:contract')
run('leads:admin:inbox')

const mig = readFileSync(join(root, 'supabase/migrations/002_leads_phase_b.sql'), 'utf8')
if (/^\s*truncate\b/im.test(mig) || /^\s*drop\s+table\s+public\.leads\b/im.test(mig)) {
  console.error('MIGRATION_VALIDATION_FAILED')
  process.exit(1)
}

if (!existsSync(join(root, 'docs/legal/DATENSCHUTZ_PHASE_B_DRAFT.md'))) {
  console.error('PRIVACY_DRAFT_MISSING')
  process.exit(1)
}

console.log('PHASE_B_VERIFY=PASS')
console.log('MIGRATION_REMOTE_APPLIED=NO')
console.log('LIVE_MAIL_ENABLED=NO')
