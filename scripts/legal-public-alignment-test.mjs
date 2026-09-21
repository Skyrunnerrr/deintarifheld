#!/usr/bin/env node
/**
 * Repo public legal pages vs implemented production behavior.
 * Concept checks only — not a legal opinion and not brittle paragraph snapshots.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const datenschutz = readFileSync(join(root, 'app/datenschutz/page.js'), 'utf8')
const agb = readFileSync(join(root, 'app/agb/page.js'), 'utf8')
const pub = readFileSync(join(root, 'docs/compliance/PUBLIC_LEGAL_ALIGNMENT.md'), 'utf8')
const matrix = readFileSync(join(root, 'docs/compliance/LEGAL_ALIGNMENT_MATRIX.md'), 'utf8')
const FAIL = []

function requireMatch(label, text, re) {
  if (!re.test(text)) FAIL.push(`missing ${label}`)
}

function forbid(label, text, re) {
  if (re.test(text)) FAIL.push(`forbidden ${label}`)
}

requireMatch('datenschutz reCAPTCHA', datenschutz, /reCAPTCHA/)
requireMatch('datenschutz v3', datenschutz, /v3/)
requireMatch('datenschutz Enterprise Assessment', datenschutz, /Enterprise Assessment/)
requireMatch('datenschutz assessment / token flow', datenschutz, /Assessment/)
forbid('datenschutz classic siteverify path', datenschutz, /klassische siteverify/)
requireMatch('datenschutz ProvenExpert local', datenschutz, /lokales[\s\S]*ProvenExpert|ProvenExpert-Siegel/)
requireMatch('datenschutz ProvenExpert network', datenschutz, /s\.provenexpert\.net/)
requireMatch('datenschutz th_consent', datenschutz, /th_consent/)
requireMatch('datenschutz localStorage (not called a cookie)', datenschutz, /localStorage-Schlüssel th_consent/)
requireMatch('datenschutz PE sessionStorage flag', datenschutz, /dth_pe_withdraw_reload/)
requireMatch('datenschutz sessionStorage named as such', datenschutz, /sessionStorage-Schlüssel dth_pe_withdraw_reload/)
requireMatch('datenschutz redaction wording', datenschutz, /redigiert\/minimiert|Redaktion\/Minimierung/)
requireMatch('datenschutz legal_hold skip', datenschutz, /legal_hold/)
requireMatch('datenschutz not legal anonymisation', datenschutz, /keine rechtliche\s+Anonymisierung/)
requireMatch('datenschutz post-redaction email', datenschutz, /ursprüngliche E-Mail-Adresse technisch nicht mehr möglich/)
requireMatch('datenschutz no customer confirmation', datenschutz, /keine[\s\S]{0,40}automatische Bestätigungs-E-Mail/)

forbid('datenschutz als gelöscht gekennzeichnet', datenschutz, /als gelöscht gekennzeichnet/)
forbid('datenschutz invented DPA signed', datenschutz, /Auftragsverarbeitungsvertrag (ist|wurde) abgeschlossen/)
forbid('datenschutz invented SCC deployed', datenschutz, /Standardvertragsklauseln als geeignete Garantie eingesetzt werden/)
forbid('datenschutz internal recaptcha audit aside', datenschutz, /Wir treffen hier keine Aussage zu Speicherdauern/)
forbid('datenschutz internal transfer-proof aside', datenschutz, /abgeschlossener Nachweis aller Drittlandtransfers/)
requireMatch('datenschutz statutory transfer framing', datenschutz, /gesetzlichen Voraussetzungen/)
requireMatch('datenschutz transfer details on request', datenschutz, /teilen wir auf Anfrage mit/)
requireMatch('datenschutz historic stocks separated', datenschutz, /getrennt vom\s+aktuellen System/)
forbid('datenschutz public ops-decision leak', datenschutz, /gesonderte operative\s+Entscheidung/)

requireMatch('AGB no automatic confirmation promise', agb, /kein vertraglicher Anspruch auf eine automatische\s+Eingangsbestätigung/)
requireMatch('AGB contact via supplied data', agb, /angegebenen Kontaktdaten/)
requireMatch('AGB TDDDG', agb, /TDDDG/)
requireMatch('AGB prior TTDSG only as historical name', agb, /zuvor TTDSG/)

forbid('AGB promised automatic confirmation with order number', agb, /Auftragsnummer/)
forbid('AGB promised data summary mail', agb, /Zusammenfassung der (übermittelten|gesendeten) Daten/)
forbid('AGB current-only TTDSG without TDDDG', agb, /dem TTDSG(?! \()/)
if (/TTDSG/.test(agb) && !/TDDDG/.test(agb)) {
  FAIL.push('AGB still names TTDSG without TDDDG')
}

requireMatch('docs PUBLIC_LEGAL_ALIGNMENT=PASS', pub, /PUBLIC_LEGAL_ALIGNMENT=PASS/)
requireMatch('docs LEGAL_TEXT_CODE_MISMATCH=NO', pub, /LEGAL_TEXT_CODE_MISMATCH=NO/)
requireMatch('docs LEGAL_REVIEW_REQUIRED=YES', pub, /LEGAL_REVIEW_REQUIRED=YES/)
requireMatch('matrix PUBLIC_LEGAL_ALIGNMENT=PASS', matrix, /PUBLIC_LEGAL_ALIGNMENT=PASS/)
requireMatch('matrix LEGAL_TEXT_CODE_MISMATCH=NO', matrix, /LEGAL_TEXT_CODE_MISMATCH=NO/)
requireMatch('matrix LEGAL_REVIEW_REQUIRED=YES', matrix, /LEGAL_REVIEW_REQUIRED=YES/)
forbid('docs fake legal review complete', pub, /LEGAL_REVIEW_REQUIRED=NO/)
forbid('docs fake processor evidence PASS', matrix, /GDPR_PROCESSOR_EVIDENCE=PASS/)

if (FAIL.length) {
  console.error('LEGAL_PUBLIC_ALIGNMENT=FAIL')
  for (const x of FAIL) console.error(' -', x)
  process.exit(1)
}

console.log('LEGAL_PUBLIC_ALIGNMENT=PASS')
console.log('DATENSCHUTZ_RECAPTCHA=PASS')
console.log('DATENSCHUTZ_PROVENEXPERT=PASS')
console.log('DATENSCHUTZ_STORAGE=PASS')
console.log('RETENTION_WORDING=PASS')
console.log('POST_REDACTION_RIGHTS_WORDING=PASS')
console.log('AGB_CUSTOMER_MAIL_ALIGNMENT=PASS')
console.log('AGB_TDDDG_ALIGNMENT=PASS')
console.log('LEGAL_TEXT_CODE_MISMATCH=NO')
console.log('LEGAL_REVIEW_REQUIRED=YES')
process.exit(0)
