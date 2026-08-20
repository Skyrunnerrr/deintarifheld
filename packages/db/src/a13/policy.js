/**
 * A13 destination allowlist, attribution/budget policy, control gate.
 * KillDomain.AUTOMATION_ENGINE (no 9th domain).
 */
import {
  KillDomain,
  AcquisitionKillDomain,
  AcquisitionAttributionPolicyV1,
  AcquisitionBudgetPolicyV1,
  AcquisitionApprovalPolicyV1,
  ALLOWED_ACQUISITION_DESTINATION_HOSTS,
  ALLOWED_ACQUISITION_DESTINATION_PATH_PREFIXES,
  A13_TEST_PROVIDER_ID,
  A13_TEST_PROVIDER_ACCOUNT,
  LIVE_AD_SPEND_EUR,
  LIVE_AD_PROVIDER_CALLS,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';

export {
  AcquisitionAttributionPolicyV1,
  AcquisitionBudgetPolicyV1,
  AcquisitionApprovalPolicyV1,
};

export function isAllowedAcquisitionDestination(url) {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return { ok: false, code: 'INVALID_DESTINATION_URL' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, code: 'DESTINATION_HTTPS_REQUIRED' };
  if (!ALLOWED_ACQUISITION_DESTINATION_HOSTS.includes(parsed.hostname)) {
    return { ok: false, code: 'DESTINATION_HOST_NOT_ALLOWLISTED' };
  }
  const pathOk = ALLOWED_ACQUISITION_DESTINATION_PATH_PREFIXES.some(
    (p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`),
  );
  if (!pathOk) return { ok: false, code: 'DESTINATION_PATH_NOT_ALLOWLISTED' };
  return { ok: true, normalized: `${parsed.origin}${parsed.pathname}` };
}

export function resolveServerProviderAccount(clientHint = null) {
  // Client/AI cannot choose account. Hint ignored.
  void clientHint;
  return {
    providerCode: A13_TEST_PROVIDER_ID,
    providerAccountRef: A13_TEST_PROVIDER_ACCOUNT,
  };
}

export function assertNoLiveAcquisition() {
  if (LIVE_AD_SPEND_EUR !== 0) throw new Error('LIVE_AD_SPEND_FORBIDDEN');
  if (LIVE_AD_PROVIDER_CALLS !== 0) throw new Error('LIVE_AD_PROVIDER_FORBIDDEN');
}

export async function acquisitionControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'ACQUISITION_DOMAIN_KILL',
        snap,
        killDomain: AcquisitionKillDomain,
      };
    }
    return { ok: true, snap, killDomain: AcquisitionKillDomain };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}
