export const REQUIRED_ALLOWLIST_FIELDS = Object.freeze([
  'id',
  'package',
  'severity',
  'url',
  'reason',
  'production_reachable',
  'owner',
  'reviewed_at',
  'expires_at',
])

export function allowlistKey(id, pkg, severity) {
  return `${String(id || '').toUpperCase()}|${String(pkg || '')}|${String(severity || '').toLowerCase()}`
}

export function allowlistRowFieldErrors(row) {
  const missing = []
  for (const field of REQUIRED_ALLOWLIST_FIELDS) {
    if (field === 'production_reachable') {
      if (typeof row?.production_reachable !== 'boolean') missing.push(field)
      continue
    }
    if (row?.[field] == null || String(row[field]).trim() === '') missing.push(field)
  }
  return missing
}

export function indexAllowlist(advisories) {
  const map = new Map()
  const errors = []
  for (const [i, row] of (advisories || []).entries()) {
    const missing = allowlistRowFieldErrors(row)
    if (missing.length) {
      errors.push(`row ${i} missing ${missing.join(',')}`)
      continue
    }
    map.set(allowlistKey(row.id, row.package, row.severity), row)
  }
  return { map, errors }
}

export function matchAllowlistedFinding(finding, map) {
  if (!finding) return null
  return map.get(allowlistKey(finding.id, finding.package, finding.severity)) || null
}
