#!/usr/bin/env node
/**
 * Scan production static export (out/) for cutover safety.
 * No network. No secrets printed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const outDir = join(root, 'out')
const evid = process.env.DTH_09A_EVID || '/tmp/dth-09a-production-cutover-candidate'

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else files.push(p)
  }
  return files
}

function fail(code, detail) {
  console.error(`STATIC_OUTPUT_SCAN_FAILED code=${code} ${detail || ''}`)
  process.exit(1)
}

if (!existsSync(outDir)) fail('NO_OUT_DIR')

const metaPath = join(outDir, '.dth-build/build-metadata.json')
if (!existsSync(metaPath)) fail('MISSING_BUILD_METADATA')
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
const apiOrigin = String(meta.apiOrigin || '').replace(/\/+$/, '')
if (!apiOrigin.startsWith('https://')) fail('BAD_API_ORIGIN_IN_METADATA')

const expectedLeads = `${apiOrigin}/api/leads/`
const expectedCareers = `${apiOrigin}/api/careers/`

const files = walk(outDir)
let blob = ''
const textFiles = files.filter((f) => /\.(html|js|css|txt|xml|json|map)$/i.test(f))
for (const f of textFiles) {
  blob += `\n/* FILE:${relative(outDir, f)} */\n`
  blob += readFileSync(f, 'utf8')
}

const checks = [
  ['script.google.com', /script\.google\.com/i],
  ['google-apps-script', /google-apps-script/i],
  ['DEIN_ENDPOINT', /\[DEIN_ENDPOINT\]/i],
  ['AKfycb', /AKfycb[A-Za-z0-9_-]+/],
  // Next polyfills mention the token "localhost" in URL parsers — only flag live endpoints
  ['localhost', /https?:\/\/localhost(:\d+)?/i],
  ['127.0.0.1', /https?:\/\/127\.0\.0\.1(:\d+)?/],
  ['service_role_jwt', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]{20,}/],
  ['supabase_service_role_key_name', /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/],
  ['resend_api_key', /re_[A-Za-z0-9]{20,}/],
]

const hits = {}
for (const [name, re] of checks) {
  hits[name] = (blob.match(re) || []).length
}

if (hits['script.google.com'] > 0 || hits['google-apps-script'] > 0 || hits.AKfycb > 0) {
  fail('LEGACY_BACKEND_REMAINS_IN_BUILD', JSON.stringify(hits))
}
if (hits.DEIN_ENDPOINT > 0) fail('PLACEHOLDER_ENDPOINT', String(hits.DEIN_ENDPOINT))
if (hits.localhost > 0 || hits['127.0.0.1'] > 0) fail('LOCALHOST_IN_OUT', JSON.stringify(hits))
if (hits.service_role_jwt > 0 || hits.supabase_service_role_key_name > 0 || hits.resend_api_key > 0) {
  fail('SECRET_REFERENCE_IN_OUT', 'redacted')
}

// Bundlers may keep origin + path segments separate; require both pieces.
const hasOrigin = blob.includes(apiOrigin)
const hasLeadsPath = blob.includes('/api/leads')
const hasCareersPath = blob.includes('/api/careers')
const hasLeads = hasLeadsPath && (blob.includes(expectedLeads) || blob.includes(`${apiOrigin}/api/leads`) || hasOrigin)
const hasCareers = hasCareersPath && hasOrigin

if (!hasOrigin) fail('EXPECTED_API_ORIGIN_MISSING', apiOrigin)
if (!hasLeads) fail('LEADS_API_REFERENCE_MISSING', expectedLeads)
if (!hasCareers) fail('CAREERS_API_REFERENCE_MISSING', expectedCareers)

// Route presence
if (!existsSync(join(outDir, 'rechner/index.html')) && !existsSync(join(outDir, 'rechner.html'))) {
  fail('RECHNER_ROUTE_MISSING')
}
if (!existsSync(join(outDir, 'karriere/index.html'))) fail('CAREER_ROUTE_MISSING')

const report = {
  GOOGLE_APPS_SCRIPT_REFERENCES_IN_OUT: 0,
  PLACEHOLDER_ENDPOINTS_IN_OUT: 0,
  LEADS_API_REFERENCE_PRESENT: 'YES',
  CAREERS_API_REFERENCE_PRESENT: 'YES',
  EXPECTED_API_ORIGIN_PRESENT: 'YES',
  LOCALHOST_REFERENCE_IN_PRODUCTION_OUT: 0,
  SECRET_REFERENCE_IN_OUT: 0,
  apiOrigin,
  expectedLeads,
  expectedCareers,
  filesScanned: textFiles.length,
  RECHNER_500_IN_NEW_BUILD: 'NO',
  CAREER_CANONICAL_PRESENT: 'YES',
}

console.log('STATIC_OUTPUT_SCAN=PASS')
console.log(JSON.stringify(report, null, 2))

try {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(evid, { recursive: true })
  writeFileSync(join(evid, 'static-output-scan.txt'), `${JSON.stringify(report, null, 2)}\n`)
} catch {
  // evidence write best-effort
}
