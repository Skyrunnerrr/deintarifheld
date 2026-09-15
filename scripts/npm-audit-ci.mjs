#!/usr/bin/env node
/**
 * npm audit CI gate.
 * Never runs `npm audit fix`.
 * Match allowlist on id AND package AND severity.
 * Unknown new Critical or High → FAIL.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexAllowlist, matchAllowlistedFinding } from '../lib/audit/npm-allowlist.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const allowlistPath = join(root, 'docs/audit/NPM_ADVISORY_ALLOWLIST.json')
const today = new Date().toISOString().slice(0, 10)

function ghsaFromUrl(url) {
  const m = String(url || '').match(/GHSA-[a-z0-9-]+/i)
  return m ? m[0].toUpperCase() : ''
}

function collectFindings(report) {
  const findings = []
  const vulns = report.vulnerabilities || {}
  for (const [pkg, item] of Object.entries(vulns)) {
    for (const via of item.via || []) {
      if (!via || typeof via !== 'object') continue
      const id = ghsaFromUrl(via.url) || String(via.source || '')
      if (!id) continue
      findings.push({
        id,
        package: pkg,
        severity: String(via.severity || item.severity || 'info').toLowerCase(),
        url: via.url || `https://github.com/advisories/${id}`,
        cve: via.cve || '',
        title: via.title || '',
      })
    }
  }
  return findings
}

if (!existsSync(allowlistPath)) {
  console.error('NPM_ADVISORY_REGISTER=FAIL')
  console.error('allowlist file missing')
  process.exit(1)
}

let allowlist
try {
  allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))
} catch {
  console.error('NPM_ADVISORY_REGISTER=FAIL')
  console.error('allowlist parse failed')
  process.exit(1)
}

const { map: allowed, errors: indexErrors } = indexAllowlist(allowlist.advisories || [])
const fail = [...indexErrors]

const result = spawnSync('npm', ['audit', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
})

let report
try {
  report = JSON.parse(result.stdout || '{}')
} catch {
  console.error('NPM_AUDIT_PARSE=FAIL')
  process.exit(1)
}

const findings = collectFindings(report)
const unique = new Map()
for (const f of findings) {
  const key = `${f.id}|${f.package}|${f.severity}`
  if (!unique.has(key)) unique.set(key, f)
}

const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
for (const item of Object.values(report.vulnerabilities || {})) {
  const sev = item.severity || 'info'
  if (counts[sev] != null) counts[sev] += 1
  else counts.info += 1
}

console.log(`NPM_AUDIT_CRITICAL=${counts.critical}`)
console.log(`NPM_AUDIT_HIGH=${counts.high}`)
console.log(`NPM_AUDIT_MODERATE=${counts.moderate}`)
console.log(`NPM_AUDIT_LOW=${counts.low}`)
console.log('NPM_AUDIT_FIX=NOT_RUN')
console.log('CUSTOMER_MAIL_ENABLED=NO')

for (const f of unique.values()) {
  if (f.severity !== 'high' && f.severity !== 'critical') continue
  const row = matchAllowlistedFinding(f, allowed)
  if (!row) {
    fail.push(`unknown ${f.severity} ${f.id} (${f.package}) ${f.url}`)
    continue
  }
  const expires = String(row.expires_at || '')
  if (!expires || expires < today) {
    fail.push(`expired allowlist ${f.id} ${f.package} expires_at=${expires || 'missing'}`)
  }
  console.log(`NPM_ALLOWLISTED=${f.id} ${f.package} ${f.severity} expires=${expires}`)
}

if (Object.keys(report.vulnerabilities || {}).includes('axios')) {
  fail.push('axios present')
}

const nextPin = readFileSync(join(root, 'package.json'), 'utf8')
if (/"next":\s*"16/.test(nextPin) || /"next":\s*"\^16/.test(nextPin)) {
  fail.push('Next 16 is forbidden')
}

console.log(`NPM_ADVISORY_REGISTER=${fail.length ? 'FAIL' : 'PASS'}`)
console.log(`NPM_UNKNOWN_HIGH_CRITICAL_CI_GATE=${fail.length ? 'FAIL' : 'PASS'}`)
console.log(`NPM_ALLOWLIST_ID_MATCH=${fail.length ? 'FAIL' : 'PASS'}`)
console.log(`NPM_ALLOWLIST_PACKAGE_MATCH=${fail.length ? 'FAIL' : 'PASS'}`)
console.log(`NPM_ALLOWLIST_SEVERITY_MATCH=${fail.length ? 'FAIL' : 'PASS'}`)

if (fail.length) {
  console.error('NPM_AUDIT_CI=FAIL')
  for (const line of fail) console.error(' -', line)
  process.exit(1)
}

console.log('NPM_AUDIT_CI=PASS')
console.log('NPM_AUDIT_POLICY=ALLOWLIST_ID_PACKAGE_SEVERITY')
process.exit(0)
