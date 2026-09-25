const DEFAULT_RETENTION_DAYS = 90
const DEFAULT_CAREER_RETENTION_DAYS = 183
const MIN_RETENTION_DAYS = 1
const MAX_RETENTION_DAYS = 3650

function parseDays(raw, fallback) {
  const value = String(raw ?? '').trim()
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return null
  if (parsed < MIN_RETENTION_DAYS || parsed > MAX_RETENTION_DAYS) return null
  return parsed
}

export function resolveRetentionConfig(env = process.env) {
  const retentionDays = parseDays(env.LEADS_RETENTION_DAYS, DEFAULT_RETENTION_DAYS)
  if (retentionDays === null) return { ok: false, code: 'retention-config-invalid' }

  const privateRetentionDays = parseDays(
    env.LEADS_PRIVATE_RETENTION_DAYS,
    retentionDays,
  )
  if (privateRetentionDays === null) return { ok: false, code: 'retention-config-invalid' }

  const careerRetentionDays = parseDays(
    env.LEADS_CAREER_RETENTION_DAYS,
    DEFAULT_CAREER_RETENTION_DAYS,
  )
  if (careerRetentionDays === null) return { ok: false, code: 'retention-config-invalid' }

  return {
    ok: true,
    retentionDays,
    privateRetentionDays,
    careerRetentionDays,
  }
}
