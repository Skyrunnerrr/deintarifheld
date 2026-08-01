#!/usr/bin/env node
/**
 * DTH-09D1 — AGB must not claim the form checkbox is DSGVO consent.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const text = readFileSync(join(process.cwd(), 'app/agb/page.js'), 'utf8')
const FAIL = []

if (/DSGVO-Einwilligung/.test(text)) {
  FAIL.push('title/phrase DSGVO-Einwilligung still present')
}
if (/Art\.\s*6\s*Abs\.\s*1\s*S\.\s*1\s*lit\.\s*a/.test(text) && /Checkbox/.test(text)) {
  FAIL.push('AGB still ties checkbox to Art. 6 lit. a consent')
}
if (/Ohne diese Einwilligung ist eine Absendung/.test(text)) {
  FAIL.push('AGB still requires consent for submit')
}
if (/datenschutzrechtliche Einwilligung \(DSGVO\) kann jederzeit/.test(text)) {
  FAIL.push('AGB §8 still frames form processing via consent withdrawal')
}
if (!/Kenntnisnahme der Datenschutzerklärung/.test(text)) {
  FAIL.push('AGB missing Kenntnisnahme confirmation wording')
}
if (!/stellt keine\s+datenschutzrechtliche Einwilligung dar/.test(text)) {
  FAIL.push('AGB must clarify checkbox is not consent')
}

if (FAIL.length) {
  console.error('AGB_CONSISTENCY=FAIL')
  for (const x of FAIL) console.error(' -', x)
  process.exit(1)
}
console.log('AGB_CONSISTENCY=PASS')
process.exit(0)
