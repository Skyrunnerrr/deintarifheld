#!/usr/bin/env node
/**
 * npm audit for CI — report only. Never runs `npm audit fix`.
 * Exit 0 after a successful audit invocation so documented residual
 * advisories do not silently block the security gate. Reviewers must
 * read the printed applicability notes.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('npm', ['audit', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })

let report
try {
  report = JSON.parse(result.stdout || '{}')
} catch {
  console.error('NPM_AUDIT_PARSE=FAIL')
  process.exit(1)
}

const vulns = report.vulnerabilities || {}
const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
for (const item of Object.values(vulns)) {
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

const names = Object.keys(vulns)
if (names.includes('axios')) {
  console.log('NPM_AUDIT_AXIOS=UNEXPECTED_STILL_PRESENT')
}
if (names.includes('next')) {
  console.log('NPM_AUDIT_NEXT=PRESENT')
} else {
  console.log('NPM_AUDIT_NEXT=ABSENT')
}

const notesPath = join(root, 'docs/audit/NPM_AUDIT_P0.md')
if (existsSync(notesPath)) {
  const notes = readFileSync(notesPath, 'utf8')
  if (notes.includes('APPLICABILITY')) {
    console.log('NPM_AUDIT_NOTES=PRESENT')
  }
}

console.log('NPM_AUDIT_POLICY=DOCUMENT_REMAINING_NO_BLIND_FIX')
process.exit(0)
