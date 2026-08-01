#!/usr/bin/env node
/**
 * DTH-09D1 — Career path must position self-employed partner, not employment application.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const FAIL = []

const files = [
  'components/sections/CareerSection.jsx',
  'app/karriere/page.js',
  'components/sections/JobDescription.jsx',
]

const FORBIDDEN = [
  /\bBewerbung senden\b/i,
  /\bBewerbung abschicken\b/i,
  /\bBewerbung gesendet\b/i,
  /\bJetzt bewerben\b/i,
  /\bBewerber\b/i,
  /\bBeschäftigungsverhältnis\b/i,
  /\bArbeitnehmer\b/i,
  /\bArbeitgeber\b/i,
  /\bArbeitsvertrag\b/i,
  /JobPosting/,
  /employmentType/,
  /FULL_TIME/,
]

const REQUIRED_ANY = [
  /selbstständ/i,
  /Partneranfrage|Interesse senden|Partner werden/i,
  /kein Arbeitsverhältnis/i,
]

for (const f of files) {
  const text = readFileSync(join(ROOT, f), 'utf8')
  for (const re of FORBIDDEN) {
    if (re.test(text)) FAIL.push(`${f}: forbidden ${re}`)
  }
}

const career = readFileSync(join(ROOT, 'components/sections/CareerSection.jsx'), 'utf8')
for (const re of REQUIRED_ANY) {
  if (!re.test(career)) FAIL.push(`CareerSection.jsx: missing required theme ${re}`)
}
if (!/careersApiUrl|\/api\/careers/.test(career) && !/careersApiUrl/.test(career)) {
  FAIL.push('CareerSection.jsx: career API channel missing')
}
if (!/Partneranfrage senden|Interesse senden/.test(career)) {
  FAIL.push('CareerSection.jsx: CTA must be Partneranfrage/Interesse')
}
if (/type=["']file["']|input.*file|Lebenslauf|CV upload/i.test(career)) {
  FAIL.push('CareerSection.jsx: file upload must not be present')
}
if (!/zur Kenntnis genommen/.test(career)) {
  FAIL.push('CareerSection.jsx: privacy acknowledgement missing')
}

const page = readFileSync(join(ROOT, 'app/karriere/page.js'), 'utf8')
if (/JobPosting|employmentType|FULL_TIME|PART_TIME/.test(page)) {
  FAIL.push('app/karriere/page.js: employment JobPosting schema must not remain')
}
if (!/selbstständ|Partneranfrage|Vertriebspartner/.test(page)) {
  FAIL.push('app/karriere/page.js: partner positioning missing in metadata')
}

if (FAIL.length) {
  console.error('CAREER_PARTNER_POSITIONING=FAIL')
  for (const x of FAIL) console.error(' -', x)
  process.exit(1)
}
console.log('CAREER_PARTNER_POSITIONING=PASS')
console.log('CAREER_RELATIONSHIP_TYPE=SELF_EMPLOYED_SALES_PARTNER_OR_COMMERCIAL_AGENT')
console.log('SECTION_26_BDSG=NOT_APPLICABLE')
console.log('CAREER_FILE_UPLOADS=NO')
process.exit(0)
