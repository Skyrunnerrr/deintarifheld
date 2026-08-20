/**
 * A12 content policy + control gate. KillDomain.AUTOMATION_ENGINE (no 9th domain).
 */
import {
  KillDomain,
  ContentStrategyPolicyV1,
  BrandPolicyV1,
  ContentRiskPolicyV1,
  ContentApprovalPolicyV1,
  ContentKillDomain,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';

export { ContentStrategyPolicyV1, BrandPolicyV1, ContentRiskPolicyV1, ContentApprovalPolicyV1 };

export function mergeContentStrategyPolicy(over = {}) {
  if (over.liveChannelsAllowed === true || over.autoPublish === true) {
    const err = new Error('LIVE_CONTENT_POLICY_FORBIDDEN');
    err.code = 'LIVE_CONTENT_POLICY_FORBIDDEN';
    throw err;
  }
  return Object.freeze({
    ...ContentStrategyPolicyV1,
    ...over,
    liveChannelsAllowed: false,
    autoPublish: false,
    aiIsCandidateOnly: true,
  });
}

export function mergeContentApprovalPolicy(over = {}) {
  return Object.freeze({
    ...ContentApprovalPolicyV1,
    ...over,
    bindToRevisionAndHashAndPolicy: true,
    staleApprovalReuseForbidden: true,
  });
}

export async function contentControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'CONTENT_DOMAIN_KILL',
        snap,
        killDomain: ContentKillDomain,
      };
    }
    return { ok: true, snap, killDomain: ContentKillDomain };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}
