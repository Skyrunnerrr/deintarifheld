#!/usr/bin/env node
/**
 * npm audit CI gate.
 * Never runs `npm audit fix`.
 * Match allowlist on id AND package AND severity.
 * Unknown new Critical or High → FAIL.
 * Audit service/registry/command failure → NPM_AUDIT_AVAILABLE=FAIL (fail-closed).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateNpmAuditCi } from '../lib/audit/npm-audit-gate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const allowlistPath = join(root, 'docs/audit/NPM_ADVISORY_ALLOWLIST.json')
const today = new Date().toISOString().slice(0, 10)

if (!existsSync(allowlistPath)) {
  console.error('NPM_ADVISORY_REGISTER=FAIL')
  console.error('NPM_AUDIT_AVAILABLE=FAIL')
  console.error('allowlist file missing')
  process.exit(1)
}

let allowlist
try {
  allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))
} catch {
  console.error('NPM_ADVISORY_REGISTER=FAIL')
  console.error('NPM_AUDIT_AVAILABLE=FAIL')
  console.error('allowlist parse failed')
  process.exit(1)
}

const result = spawnSync('npm', ['audit', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
})

const packageJson = readFileSync(join(root, 'package.json'), 'utf8')
const scored = evaluateNpmAuditCi({
  spawnResult: result,
  allowlist,
  today,
  packageJson,
})

if (!scored.available) {
  console.error('NPM_AUDIT_AVAILABLE=FAIL')
  console.error(`NPM_AUDIT_AVAILABLE_REASON=${scored.code}`)
  console.error('NPM_AUDIT_CI=FAIL')
  process.exit(1)
}

console.log('NPM_AUDIT_AVAILABLE=PASS')
console.log(`NPM_AUDIT_CRITICAL=${scored.counts.critical}`)
console.log(`NPM_AUDIT_HIGH=${scored.counts.high}`)
console.log(`NPM_AUDIT_MODERATE=${scored.counts.moderate}`)
console.log(`NPM_AUDIT_LOW=${scored.counts.low}`)
console.log('NPM_AUDIT_FIX=NOT_RUN')

for (const f of scored.findings || []) {
  if (f.severity !== 'high' && f.severity !== 'critical') continue
  const row = (allowlist.advisories || []).find(
    (a) => String(a.id).toUpperCase() === String(f.id).toUpperCase()
      && a.package === f.package
      && String(a.severity).toLowerCase() === f.severity,
  )
  if (row) console.log(`NPM_ALLOWLISTED=${f.id} ${f.package} ${f.severity} expires=${row.expires_at}`)
}

console.log(`NPM_ADVISORY_REGISTER=${scored.ok ? 'PASS' : 'FAIL'}`)
console.log(`NPM_UNKNOWN_HIGH_CRITICAL_CI_GATE=${scored.ok ? 'PASS' : 'FAIL'}`)
console.log(`NPM_ALLOWLIST_ID_MATCH=${scored.ok ? 'PASS' : 'FAIL'}`)
console.log(`NPM_ALLOWLIST_PACKAGE_MATCH=${scored.ok ? 'PASS' : 'FAIL'}`)
console.log(`NPM_ALLOWLIST_SEVERITY_MATCH=${scored.ok ? 'PASS' : 'FAIL'}`)

if (!scored.ok) {
  console.error('NPM_AUDIT_CI=FAIL')
  for (const line of scored.fail || []) console.error(' -', line)
  process.exit(1)
}

console.log('NPM_AUDIT_CI=PASS')
console.log('NPM_AUDIT_POLICY=ALLOWLIST_ID_PACKAGE_SEVERITY')
process.exit(0)
