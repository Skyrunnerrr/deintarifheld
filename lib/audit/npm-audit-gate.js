import { indexAllowlist, matchAllowlistedFinding } from './npm-allowlist.js'

function ghsaFromUrl(url) {
  const m = String(url || '').match(/GHSA-[a-z0-9-]+/i)
  return m ? m[0].toUpperCase() : ''
}

export function collectNpmAuditFindings(report) {
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

export function validateNpmAuditSpawn(spawnResult) {
  if (spawnResult?.error) {
    return { ok: false, available: false, code: 'spawn_error' }
  }
  let report
  try {
    report = JSON.parse(spawnResult?.stdout ?? '')
  } catch {
    return { ok: false, available: false, code: 'parse_error' }
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { ok: false, available: false, code: 'invalid_report' }
  }
  if (report.error != null) {
    return { ok: false, available: false, code: 'audit_error_object' }
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities)) {
    return { ok: false, available: false, code: 'invalid_vulnerabilities' }
  }
  if (!report.metadata || typeof report.metadata !== 'object' || Array.isArray(report.metadata)) {
    return { ok: false, available: false, code: 'missing_metadata' }
  }
  return { ok: true, available: true, report }
}

export function evaluateNpmAuditCi({
  spawnResult,
  allowlist,
  today = new Date().toISOString().slice(0, 10),
  packageJson = '',
} = {}) {
  const validated = validateNpmAuditSpawn(spawnResult)
  if (!validated.ok) return validated

  const { map: allowed, errors: indexErrors } = indexAllowlist(allowlist?.advisories || [])
  const fail = [...indexErrors]
  const findings = collectNpmAuditFindings(validated.report)
  const unique = new Map()
  for (const f of findings) {
    const key = `${f.id}|${f.package}|${f.severity}`
    if (!unique.has(key)) unique.set(key, f)
  }

  const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
  for (const item of Object.values(validated.report.vulnerabilities || {})) {
    const sev = item.severity || 'info'
    if (counts[sev] != null) counts[sev] += 1
    else counts.info += 1
  }

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
  }

  if (Object.keys(validated.report.vulnerabilities || {}).includes('axios')) {
    fail.push('axios present')
  }
  if (/"next":\s*"16/.test(packageJson) || /"next":\s*"\^16/.test(packageJson)) {
    fail.push('Next 16 is forbidden')
  }

  return {
    ok: fail.length === 0,
    available: true,
    fail,
    counts,
    findings: [...unique.values()],
  }
}
