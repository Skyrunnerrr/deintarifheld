import { isSecretStrong } from './secret-compare.js'

const CANONICAL_OPS_RECIPIENT = 'kontakt@deintarifheld.de'

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validHttpsUrl(value) {
  if (!nonEmpty(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function singleEmail(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw || raw.includes(',') || /[\r\n\u0000-\u001F\u007F]/.test(raw)) return ''
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(raw) ? raw : ''
}

function senderEmail(value) {
  const raw = String(value || '').trim()
  if (!raw || /[\r\n\u0000-\u001F\u007F]/.test(raw)) return ''
  const email = raw.match(/<([^<>]+)>\s*$/)?.[1]?.trim() || raw
  return singleEmail(email)
}

function strongSalt(value) {
  const raw = String(value || '').trim()
  return raw.length >= 24 && raw !== 'dth-leads-rl-v1'
}

/**
 * Build-time guard for the Vercel production API deployment.
 * Returns variable/problem names only; never returns or logs secret values.
 */
export function productionApiEnvProblems(env = process.env) {
  const problems = []

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  if (!validHttpsUrl(supabaseUrl)) problems.push('SUPABASE_URL')
  if (!nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)) problems.push('SUPABASE_SERVICE_ROLE_KEY')

  if (!nonEmpty(env.RECAPTCHA_PROJECT_ID)) problems.push('RECAPTCHA_PROJECT_ID')
  if (!nonEmpty(env.RECAPTCHA_API_KEY)) problems.push('RECAPTCHA_API_KEY')
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(String(env.NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY || ''))) {
    problems.push('NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY')
  }
  if (nonEmpty(env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) || nonEmpty(env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY)) {
    problems.push('LEGACY_RECAPTCHA_PUBLIC_ENV')
  }

  if (!isSecretStrong(env.LEADS_ADMIN_SECRET)) problems.push('LEADS_ADMIN_SECRET')
  if (!isSecretStrong(env.CRON_SECRET)) problems.push('CRON_SECRET')
  if (env.LEADS_ADMIN_SECRET?.trim() === env.CRON_SECRET?.trim()) problems.push('ADMIN_CRON_SECRET_REUSE')

  if (!strongSalt(env.LEADS_RATE_LIMIT_SALT)) problems.push('LEADS_RATE_LIMIT_SALT')
  if (!strongSalt(env.AUDIT_EMAIL_HASH_SALT)) problems.push('AUDIT_EMAIL_HASH_SALT')
  if (
    nonEmpty(env.LEADS_RATE_LIMIT_SALT) &&
    env.LEADS_RATE_LIMIT_SALT.trim() === String(env.AUDIT_EMAIL_HASH_SALT || '').trim()
  ) {
    problems.push('AUDIT_RATE_SALT_REUSE')
  }

  if ((env.LEADS_RATE_LIMIT_PROVIDER || 'supabase').trim().toLowerCase() !== 'supabase') {
    problems.push('LEADS_RATE_LIMIT_PROVIDER')
  }
  if (String(env.LEADS_ALLOW_MEMORY_RATE_LIMIT || '').trim().toUpperCase() === 'YES') {
    problems.push('LEADS_ALLOW_MEMORY_RATE_LIMIT')
  }
  if (String(env.LEADS_ALLOW_SMOKE_BYPASS || '').trim().toUpperCase() === 'YES') {
    problems.push('LEADS_ALLOW_SMOKE_BYPASS')
  }

  if (nonEmpty(env.LEADS_ALLOWED_ORIGINS)) {
    const configuredOrigins = String(env.LEADS_ALLOWED_ORIGINS)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .sort()
    const canonicalOrigins = [
      'https://deintarifheld.de',
      'https://www.deintarifheld.de',
    ].sort()
    if (
      configuredOrigins.length !== canonicalOrigins.length ||
      configuredOrigins.some((origin, index) => origin !== canonicalOrigins[index])
    ) {
      problems.push('LEADS_ALLOWED_ORIGINS')
    }
  }

  if ((env.LEADS_MAIL_MODE || '').trim().toLowerCase() !== 'live') problems.push('LEADS_MAIL_MODE')
  if (String(env.ALLOW_CUSTOMER_MAIL || '').trim().toUpperCase() !== 'YES') problems.push('ALLOW_CUSTOMER_MAIL')
  if (!nonEmpty(env.RESEND_API_KEY)) problems.push('RESEND_API_KEY')

  const from = senderEmail(env.LEADS_FROM_EMAIL)
  if (!from || !from.endsWith('@deintarifheld.de')) problems.push('LEADS_FROM_EMAIL')

  const to = singleEmail(env.LEADS_TO_EMAIL)
  if (!to || to !== CANONICAL_OPS_RECIPIENT) problems.push('LEADS_TO_EMAIL')

  return [...new Set(problems)]
}

export function assertProductionApiEnv(env = process.env) {
  const problems = productionApiEnvProblems(env)
  if (problems.length) {
    throw new Error(`DTH production API environment invalid: ${problems.join(', ')}`)
  }
  return true
}
