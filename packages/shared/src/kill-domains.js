/**
 * P3-F6 — closed kill-domain registry (exactly 8).
 * Domains name control surfaces only; they do not implement capabilities.
 */

export const KillDomain = Object.freeze({
  PUBLIC_INTAKE: 'PUBLIC_INTAKE',
  API_PROCESSING: 'API_PROCESSING',
  INTERNAL_MAIL: 'INTERNAL_MAIL',
  MARKETING_MAIL: 'MARKETING_MAIL',
  AUTOMATION_ENGINE: 'AUTOMATION_ENGINE',
  DATA_IMPORT: 'DATA_IMPORT',
  PARTNER_ACCESS: 'PARTNER_ACCESS',
  COMMAND_CENTER_WRITE_ACTIONS: 'COMMAND_CENTER_WRITE_ACTIONS',
});

export const KILL_DOMAINS = Object.freeze(Object.values(KillDomain));

export const KILL_DOMAIN_COUNT = 8;

export function isKillDomain(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KillDomain, value);
}

export function assertExactKillDomainSet(domains) {
  const set = new Set(domains);
  if (set.size !== KILL_DOMAIN_COUNT) {
    throw new Error(`KILL_DOMAIN_COUNT_MISMATCH:${set.size}`);
  }
  for (const d of KILL_DOMAINS) {
    if (!set.has(d)) throw new Error(`KILL_DOMAIN_MISSING:${d}`);
  }
  return true;
}
