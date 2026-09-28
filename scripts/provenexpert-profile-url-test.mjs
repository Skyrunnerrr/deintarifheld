#!/usr/bin/env node
/**
 * Static guard: live ProvenExpert profile URL, consent-gated script, CSP hosts.
 * Does not load the network script and does not send mail.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldLoadProvenExpertScript } from '../lib/consent/third-party.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

export const CANONICAL_PE_PROFILE_URL = 'https://www.provenexpert.com/de-de/dein-tarifheld/'

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'out', 'coverage'])
const SOURCE_EXT = /\.(js|jsx|mjs|cjs|md|html|json)$/

function collectSourceFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) collectSourceFiles(abs, acc)
    else if (SOURCE_EXT.test(name) || name === '.htaccess') acc.push(abs)
  }
  return acc
}

export function assertProvenExpertProfileUrls() {
  const thirdParty = read('lib/consent/third-party.js')
  assert.match(
    thirdParty,
    /export const PROVENEXPERT_PROFILE_URL = 'https:\/\/www\.provenexpert\.com\/de-de\/dein-tarifheld\/'/,
  )
  assert.match(thirdParty, /export const PROVENEXPERT_SCRIPT_URL = 'https:\/\/s\.provenexpert\.net\/seals\/proseal-v2\.js'/)
  assert.equal(shouldLoadProvenExpertScript(undefined), false)
  assert.equal(shouldLoadProvenExpertScript(''), false)
  assert.equal(shouldLoadProvenExpertScript(JSON.stringify({ essential: true, provenexpert: false })), false)
  assert.equal(shouldLoadProvenExpertScript(JSON.stringify({ essential: true, provenexpert: true })), true)

  const layout = read('app/layout.js')
  assert.match(layout, /import \{ PROVENEXPERT_PROFILE_URL \} from '@\/lib\/consent\/third-party'/)
  assert.match(layout, /sameAs:\s*\[\s*PROVENEXPERT_PROFILE_URL,\s*\]/)

  const widget = read('components/ui/ProSealWidget.js')
  assert.match(widget, /PROVENEXPERT_PROFILE_URL/)
  assert.match(widget, /useState\(false\)/)
  assert.match(widget, /if \(!plan\.loadScript\) return undefined/)
  assert.match(widget, /script\.src = PROVENEXPERT_SCRIPT_URL/)
  assert.match(widget, /!loadExternal && \(/)
  assert.match(widget, /href=\{PROVENEXPERT_PROFILE_URL\}/)
  assert.match(widget, /target="_blank"/)
  assert.match(widget, /rel="noopener noreferrer"/)
  assert.match(widget, /aria-label="Bewertungssiegel ProvenExpert, zu den Bewertungen"/)
  assert.doesNotMatch(widget, /href=["']\/datenschutz["']/)
  assert.doesNotMatch(widget, /setLoadExternal\(true\)/)

  const htaccess = read('public/.htaccess')
  assert.match(htaccess, /script-src[^;"]*https:\/\/s\.provenexpert\.net/)
  assert.match(htaccess, /img-src[^;"]*https:\/\/www\.provenexpert\.com/)
  assert.match(htaccess, /img-src[^;"]*https:\/\/s\.provenexpert\.net/)
  assert.match(htaccess, /connect-src[^;"]*https:\/\/s\.provenexpert\.net/)
  assert.match(htaccess, /connect-src[^;"]*https:\/\/d\.provenexpert\.net/)
  assert.doesNotMatch(htaccess, /script-src[^;"]*https:\/\/d\.provenexpert\.net/)

  const datenschutz = read('app/datenschutz/page.js')
  assert.match(datenschutz, /lokales[\s\S]{0,80}ProvenExpert-Siegel/)
  assert.match(datenschutz, /ohne Laden des externen ProvenExpert-Scripts/)
  assert.match(datenschutz, /s\.provenexpert\.net/)
  assert.match(datenschutz, /d\.provenexpert\.net/)
  assert.match(datenschutz, /öffentliche\s+Profil/)

  const deadProfilePath = 'provenexpert.com/' + 'deintarifheld'
  const hits = []
  for (const file of collectSourceFiles(root)) {
    const text = readFileSync(file, 'utf8')
    if (text.includes(deadProfilePath)) hits.push(file.slice(root.length + 1))
  }
  assert.deepEqual(hits, [], `dead ProvenExpert profile slug still referenced: ${hits.join(', ')}`)
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
  assertProvenExpertProfileUrls()
  console.log('PROVENEXPERT_PROFILE_URL=PASS')
  console.log('PROVENEXPERT_CONSENT_GATE=PASS')
  console.log('PROVENEXPERT_CSP_HOSTS=PASS')
}
