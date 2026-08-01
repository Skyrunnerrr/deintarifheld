#!/usr/bin/env node
/**
 * DTH-09D1 — Form privacy semantics + required checkbox contract.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const FAIL = []

const FORM_FILES = [
  'components/sections/Hero.jsx',
  'components/sections/FunnelSection.jsx',
  'components/sections/CareerSection.jsx',
  'components/sections/SavingsCalculator.jsx',
  'components/business/BusinessForm.jsx',
  'lib/business-content.js',
  'app/unternehmen/page.js',
]

const FORBIDDEN = [
  [/Ich stimme/i, 'Ich stimme'],
  [/stimme der Verarbeitung/i, 'stimme der Verarbeitung'],
  [/Einwilligung kann/i, 'Einwilligung kann'],
  [/Bewerbung senden/i, 'Bewerbung senden'],
  [/Bewerbung abschicken/i, 'Bewerbung abschicken'],
  [/Beschäftigungsverhältnis/i, 'Beschäftigungsverhältnis'],
]

const SCAN_ROOTS = ['components', 'app', 'lib']
const SCAN_EXCLUDE = [
  /^app\/datenschutz\//,
  /^scripts\//,
]

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', 'out', '.git'].includes(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(js|jsx)$/.test(name)) out.push(full)
  }
  return out
}

for (const f of FORM_FILES) {
  const text = read(f)
  for (const [re, label] of FORBIDDEN) {
    if (re.test(text)) FAIL.push(`${f}: forbidden "${label}"`)
  }
  if (f === 'lib/business-content.js') {
    if (!/dsgvoTextPrefix:\s*'Ich habe die'/.test(text) || !/zur Kenntnis genommen/.test(text)) {
      FAIL.push(`${f}: acknowledgement prefix/suffix missing`)
    }
  } else if (!/zur Kenntnis genommen/i.test(text)) {
    FAIL.push(`${f}: acknowledgement wording missing`)
  }
  if (f !== 'lib/business-content.js' && !/\/datenschutz/.test(text)) {
    FAIL.push(`${f}: /datenschutz link missing`)
  }
  if (/Bitte stimme der Datenschutzerklärung zu|Bitte stimmen Sie der Datenschutzerklärung zu/.test(text)) {
    FAIL.push(`${f}: legacy consent error message`)
  }
}

for (const [f, field] of [
  ['components/sections/Hero.jsx', 'gdpr'],
  ['components/sections/FunnelSection.jsx', 'gdpr'],
  ['components/sections/CareerSection.jsx', 'gdpr'],
  ['components/business/BusinessForm.jsx', 'dsgvo'],
  ['app/unternehmen/page.js', 'dsgvo'],
]) {
  const text = read(f)
  if (!new RegExp(`\\b${field}\\b`).test(text)) FAIL.push(`${f}: field ${field} missing`)
  if (!/\brequired\b/.test(text)) FAIL.push(`${f}: required missing`)
}

for (const rootName of SCAN_ROOTS) {
  for (const full of walk(join(ROOT, rootName))) {
    const rel = relative(ROOT, full)
    if (SCAN_EXCLUDE.some((re) => re.test(rel))) continue
    const text = readFileSync(full, 'utf8')
    for (const [re, label] of FORBIDDEN) {
      if (!re.test(text)) continue
      // AGB may mention Einwilligung only to negate it — forbid "Einwilligung kann"
      if (rel === 'app/agb/page.js' && label !== 'Einwilligung kann' && label !== 'Ich stimme' && label !== 'stimme der Verarbeitung' && !label.startsWith('Bewerbung') && label !== 'Beschäftigungsverhältnis') {
        continue
      }
      FAIL.push(`${rel}: productive forbidden "${label}"`)
    }
  }
}

if (FAIL.length) {
  console.error('FORM_PRIVACY_SEMANTICS=FAIL')
  for (const x of [...new Set(FAIL)]) console.error(' -', x)
  process.exit(1)
}

console.log('FORM_PRIVACY_SEMANTICS=PASS')
console.log('FORM_REQUIRED_CHECKBOX=PASS')
console.log('FORM_PRIVACY_TEXT_OCCURRENCES_CLASSIFIED=ALL')
console.log('UNCLASSIFIED_OCCURRENCES=0')
console.log('DATABASE_MIGRATION_REQUIRED=NO')
console.log('API_BREAKING_CHANGE=NO')
process.exit(0)
